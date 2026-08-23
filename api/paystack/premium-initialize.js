const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
function json(res, status, body) { res.status(status).json(body); }
async function supabaseRpc(name, body, authorization) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.hint || `Supabase RPC ${name} failed`);
  return payload;
}
async function paystackInitialize(email, amount, currency, reference, callbackUrl) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, amount: Math.round(Number(amount) * 100), currency, reference, callback_url: callbackUrl }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) throw new Error(payload?.message || "Paystack transaction initialization failed");
  return payload.data;
}
async function attachProvider(paymentId, providerReference, checkoutUrl, accessCode, authorization) {
  return supabaseRpc("attach_premium_checkout", { p_payment_id: paymentId, p_provider_reference: providerReference, p_checkout_url: checkoutUrl, p_access_code: accessCode }, authorization);
}
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) return json(res, 503, { error: "Premium payment provider is not configured" });
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });
  try {
    const { planId, idempotencyKey, email, callbackUrl } = req.body || {};
    if (!planId || !idempotencyKey || !email) return json(res, 400, { error: "planId, idempotencyKey, and email are required" });
    const initialized = await supabaseRpc("initialize_premium_payment", { p_plan_id: planId, p_idempotency_key: idempotencyKey }, authorization);
    const payment = initialized?.payment;
    const plan = initialized?.plan;
    if (!payment?.id || !payment.transaction_reference || !plan) throw new Error("Premium payment service returned an invalid payment attempt");
    if (payment.status === "INITIALIZED" && payment.checkout_url) return json(res, 200, { paymentId: payment.id, transactionReference: payment.transaction_reference, reference: payment.provider_reference || payment.transaction_reference, authorizationUrl: payment.checkout_url, accessCode: payment.access_code, amount: payment.amount, currency: payment.currency, replayed: true });
    const paystack = await paystackInitialize(email, plan.amount, plan.currency, payment.transaction_reference, callbackUrl || `${req.headers.origin || "https://eventverse-eight.vercel.app"}/?premium-payment=callback`);
    await attachProvider(payment.id, paystack.reference, paystack.authorization_url, paystack.access_code, authorization);
    return json(res, 200, { paymentId: payment.id, transactionReference: payment.transaction_reference, reference: paystack.reference, authorizationUrl: paystack.authorization_url, accessCode: paystack.access_code, amount: plan.amount, currency: plan.currency, replayed: Boolean(initialized.reused) });
  } catch (error) {
    console.error("Premium Paystack initialization error", error);
    return json(res, 400, { error: error instanceof Error ? error.message : "Unable to initialize Premium payment" });
  }
}
export const config = { api: { bodyParser: true } };
