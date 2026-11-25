const root = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

async function request(path, options = {}) {
  if (!root() || !key()) throw new Error("Supabase server environment is not configured");
  const response = await fetch(root() + path, {
    ...options,
    headers: {
      apikey: key(),
      Authorization: "Bearer " + key(),
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || body?.error || "Database request failed");
  return body;
}
async function currentUser(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const response = await fetch(root() + "/auth/v1/user", {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: authHeader }
  });
  if (!response.ok) return null;
  return response.json();
}
module.exports = { request, currentUser };