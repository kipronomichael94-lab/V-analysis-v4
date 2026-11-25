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
    const payment = await api("/api/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(trackingId), { method: "GET" });
    const state = String(payment.payment_status_description || payment.status || "").toUpperCase();
    const completed = state === "COMPLETED";
    const failed = state === "FAILED" || state === "INVALID";
    await db.request("/rest/v1/payment_orders?merchant_reference=eq." + encodeURIComponent(reference), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: completed ? "COMPLETED" : failed ? "FAILED" : "PENDING", pesapal_tracking_id: trackingId })
    });
    if (completed) {
      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + 1);
      await db.request("/rest/v1/subscriptions?user_id=eq." + encodeURIComponent(rows[0].user_id), {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: rows[0].user_id, plan: "monthly", status: "active", starts_at: now.toISOString(), expires_at: expiry.toISOString(), updated_at: now.toISOString() })
      });
    }
    return res.status(200).send("OK");
  } catch (error) {
    console.error("Pesapal IPN error:", error.message);
    return res.status(500).send("Notification processing failed");
  }
};