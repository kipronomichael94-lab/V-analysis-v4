const { api } = require("../_lib/pesapal");
const db = require("../_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await db.currentUser(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Sign in before subscribing." });
    const { firstName, lastName, phone, currency } = req.body || {};
    const email = user.email;
    if (!firstName || !lastName || !phone || !email) {
      return res.status(400).json({ error: "First name, last name and phone number are required." });
    }
    const amount = Number(process.env.SUBSCRIPTION_AMOUNT || "150");
    const chargeCurrency = (currency || process.env.SUBSCRIPTION_CURRENCY || "USD").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(chargeCurrency)) {
      return res.status(500).json({ error: "Subscription price configuration is invalid." });
    }
    const ref = "VA4-" + crypto.randomUUID();
    const callback = process.env.PESAPAL_CALLBACK_URL;
    const ipnId = process.env.PESAPAL_IPN_ID;
    if (!callback || !ipnId) return res.status(503).json({ error: "Pesapal callback/IPN setup is incomplete." });

    await db.request("/rest/v1/payment_orders", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ merchant_reference: ref, user_id: user.id, email, amount, currency: chargeCurrency, status: "PENDING" })
    });
    const order = await api("/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      body: JSON.stringify({
        id: ref,
        currency: chargeCurrency,
        amount,
        description: "V Analysis V4 monthly subscription",
        callback_url: callback,
        cancellation_url: callback + "?cancelled=1",
        notification_id: ipnId,
        billing_address: {
          email_address: email,
          phone_number: phone,
          country_code: "KE",
          first_name: firstName,
          last_name: lastName
        }
      })
    });
    await db.request("/rest/v1/payment_orders?merchant_reference=eq." + encodeURIComponent(ref), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ pesapal_tracking_id: order.order_tracking_id })
    });
    return res.status(200).json({ redirect_url: order.redirect_url, reference: ref });
  } catch (error) {
    console.error("Pesapal order error:", error.message);
    return res.status(500).json({ error: "Could not start payment. Check server configuration and try again." });
  }
};