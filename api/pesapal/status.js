const { api } = require("../_lib/pesapal");
const db = require("../_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await db.currentUser(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Sign in required." });
    const reference = String(req.query.reference || "");
    if (!/^VA4-[a-f0-9-]{36}$/i.test(reference)) return res.status(400).json({ error: "Invalid reference." });
    const rows = await db.request("/rest/v1/payment_orders?merchant_reference=eq." + encodeURIComponent(reference) + "&user_id=eq." + encodeURIComponent(user.id) + "&select=merchant_reference,pesapal_tracking_id,status");
    if (!rows.length || !rows[0].pesapal_tracking_id) return res.status(404).json({ error: "Payment not found yet." });
    const status = await api("/api/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(rows[0].pesapal_tracking_id), { method: "GET" });
    return res.status(200).json({ status: status.payment_status_description || status.status || rows[0].status });
  } catch (error) {
    console.error("Pesapal status error:", error.message);
    return res.status(500).json({ error: "Could not verify payment status." });
  }
};