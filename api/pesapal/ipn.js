const { api } = require("../_lib/pesapal");
const db = require("../_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  try {
    const q = req.method === "GET" ? req.query : (req.body || {});
    const trackingId = q.OrderTrackingId || q.orderTrackingId;
    const reference = q.OrderMerchantReference || q.orderMerchantReference;
    if (!trackingId || !reference) return res.status(400).send("Missing transaction identifiers");
    const rows = await db.request("/rest/v1/payment_orders?merchant_reference=eq." + encodeURIComponent(reference) + "&select=*");
    if (!rows || !rows.length) return res.status(404).send("Order not found");
    const order = rows[0];
    if (order.pesapal_tracking_id && order.pesapal_tracking_id !== trackingId) {
      return res.status(409).send("Tracking ID mismatch");
    }
    const payment = await api("/api/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(trackingId), { method: "GET" });
    if (payment.merchant_reference && payment.merchant_reference !== reference) {
      return res.status(409).send("Merchant reference mismatch");
    }
    const state = String(payment.payment_status_description || payment.status || "").toUpperCase();
    if (state === "COMPLETED") {
      const amount = Number(payment.amount);
      const currency = String(payment.currency || "").toUpperCase();
      if (!Number.isFinite(amount) || !currency) return res.status(409).send("Verified payment details are incomplete");
      await db.request("/rest/v1/rpc/activate_v_analysis_payment", {
        method: "POST",
        body: JSON.stringify({ p_reference: reference, p_tracking_id: trackingId, p_amount: amount, p_currency: currency })
      });
    } else if (state === "FAILED" || state === "INVALID") {
      await db.request("/rest/v1/payment_orders?merchant_reference=eq." + encodeURIComponent(reference) + "&status=neq.COMPLETED", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "FAILED", pesapal_tracking_id: trackingId })
      });
    } else if (state === "REVERSED") {
      await db.request("/rest/v1/payment_orders?merchant_reference=eq." + encodeURIComponent(reference), {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "REVERSED" })
      });
      await db.request("/rest/v1/subscriptions?user_id=eq." + encodeURIComponent(order.user_id), {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() })
      });
    }
    return res.status(200).json({ orderNotificationType: q.OrderNotificationType || "IPNCHANGE", orderTrackingId: trackingId, orderMerchantReference: reference, status: 200 });
  } catch (error) {
    console.error("Pesapal IPN error:", error.message);
    return res.status(500).json({ status: 500, message: "Notification processing failed" });
  }
};
