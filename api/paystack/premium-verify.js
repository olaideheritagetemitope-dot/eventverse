const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
function json(res, status, body) { res.status(status).json(body); }
async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: SUPABASE_ANON_KEY, ...(options.headers || {}) } });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}
async function supabaseRpc(name, body, headers) {
  const { response, payload } = await supabaseFetch(`/rest/v1/rpc/${name}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(payload?.message || payload?.hint || `Supabase RPC ${name} failed`);
  return payload;
}
async function paystackVerify(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) throw new Error(payload?.message || "Paystack verification failed");
  return payload.data;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) return json(res, 503, { error: "Premium payment provider is not configured" });
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });
  try {
    const { paymentId, reference } = req.body || {};
    if (!paymentId || !reference) return json(res, 400, { error: "paymentId and reference are required" });
    const paymentResult = await supabaseFetch(`/rest/v1/premium_payments?id=eq.${encodeURIComponent(paymentId)}&select=id,user_id,plan_id,amount,currency,status,provider_reference&limit=1`, { headers: { Authorization: authorization } });
    if (!paymentResult.response.ok || !paymentResult.payload?.[0]) return json(res, 404, { error: "Premium payment not found" });
    const payment = paymentResult.payload[0];
    const userResult = await supabaseFetch("/auth/v1/user", { headers: { Authorization: authorization } });
    if (!userResult.response.ok || userResult.payload?.id !== payment.user_id) return json(res, 403, { error: "Premium payment access denied" });
    const normalizedReference = String(reference).trim();
    if (payment.provider_reference && payment.provider_reference !== normalizedReference) return json(res, 409, { error: "Payment reference does not match this payment attempt" });
    if (payment.status === "SUCCESS") return json(res, 200, { verified: true, replayed: true });
    const verified = await paystackVerify(normalizedReference);
    if (verified?.status !== "success") return json(res, 402, { error: `Paystack transaction status is ${verified?.status || "not successful"}` });
    if (Number(verified.amount) !== Math.round(Number(payment.amount) * 100)) return json(res, 409, { error: "Verified payment amount does not match the Premium plan" });
    if (verified.currency && payment.currency && String(verified.currency).toUpperCase() !== String(payment.currency).toUpperCase()) return json(res, 409, { error: "Verified payment currency does not match the Premium plan" });
    const activation = await supabaseRpc("activate_premium_payment", { p_payment_id: payment.id, p_provider_reference: verified.reference || normalizedReference, p_paid_amount: payment.amount, p_paid_currency: payment.currency }, { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` });
    return json(res, 200, { verified: true, activation, providerReference: verified.reference || normalizedReference });
  } catch (error) {
    console.error("Premium Paystack verification error", error);
    return json(res, 400, { error: error instanceof Error ? error.message : "Unable to verify Premium payment" });
  }
}
export const config = { api: { bodyParser: true } };
