const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function json(res, status, body) { res.status(status).json(body); }

async function supabaseRpc(name, args, authorization) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Supabase request failed");
  return Array.isArray(payload) ? payload[0] : payload;
}

async function paystackInitialize({ email, amount, reference, callbackUrl }) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, amount: Math.round(Number(amount) * 100), currency: "NGN", reference, callback_url: callbackUrl }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) throw new Error(payload?.message || "Paystack transaction initialization failed");
  return payload.data;
}

async function attachProviderCheckout(paymentId, reference, authorizationUrl, accessCode) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/attach_role_application_payment_provider`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_payment_id: paymentId,
      p_provider_reference: reference,
      p_authorization_url: authorizationUrl || null,
      p_access_code: accessCode || null,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Unable to persist role payment checkout");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json(res, 503, { error: "Role verification payment provider is not configured" });
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });
  try {
    const { applicationId, email, idempotencyKey, callbackUrl } = req.body || {};
    if (!applicationId || !email || !idempotencyKey) return json(res, 400, { error: "applicationId, email, and idempotencyKey are required" });
    const payment = await supabaseRpc("initialize_role_application_payment", { p_application_id: applicationId, p_idempotency_key: idempotencyKey }, authorization);
    if (payment.authorization_url || payment.provider_reference) return json(res, 200, { paymentId: payment.id, reference: payment.provider_reference || payment.transaction_reference, transactionReference: payment.transaction_reference, authorizationUrl: payment.authorization_url || null, accessCode: payment.access_code || null, amount: payment.amount, currency: payment.currency, roleCode: payment.role_code, replayed: true });
    const reference = payment.transaction_reference;
    if (!reference) throw new Error("Server did not return a transaction reference");
    const paystack = await paystackInitialize({ email, amount: payment.amount, reference, callbackUrl: callbackUrl || `${req.headers.origin || "https://eventverse-eight.vercel.app"}/?role-payment=callback` });
    await attachProviderCheckout(payment.id, paystack.reference, paystack.authorization_url, paystack.access_code);
    return json(res, 200, { paymentId: payment.id, reference: paystack.reference, transactionReference: payment.transaction_reference, authorizationUrl: paystack.authorization_url, accessCode: paystack.access_code, amount: payment.amount, currency: payment.currency, roleCode: payment.role_code, replayed: false });
  } catch (error) {
    console.error("Role application Paystack initialization error", error);
    return json(res, 400, { error: error instanceof Error ? error.message : "Unable to initialize role verification payment" });
  }
}
