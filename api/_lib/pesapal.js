const BASE = process.env.PESAPAL_ENV === "live"
  ? "https://pay.pesapal.com/v3"
  : "https://cybqa.pesapal.com/pesapalv3";

async function token() {
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("Pesapal credentials are not configured");
  const response = await fetch(BASE + "/api/Auth/RequestToken", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret })
  });
  const data = await response.json();
  if (!response.ok || !data.token) throw new Error("Pesapal authentication failed");
  return data.token;
}

async function api(path, options = {}) {
  const bearer = await token();
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + bearer,
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Pesapal API request failed");
  return data;
}
module.exports = { api };