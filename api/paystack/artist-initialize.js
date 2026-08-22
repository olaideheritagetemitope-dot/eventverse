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

async function attachProviderReference(transactionId, reference) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/artist_fee_transactions?id=eq.${encodeURIComponent(transactionId)}`, {
    method: "PATCH",
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ provider_reference: reference, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Unable to attach payment provider reference");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json(res, 503, { error: "Artist payment provider is not configured" });
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });
  try {
    const { transactionType, email, idempotencyKey, callbackUrl } = req.body || {};
    if (!transactionType || !email || !idempotencyKey || !["REGISTRATION", "VERIFICATION"].includes(transactionType)) return json(res, 400, { error: "transactionType, email, and idempotencyKey are required" });
    const transaction = await supabaseRpc("initialize_artist_fee_payment", { p_transaction_type: transactionType, p_idempotency_key: idempotencyKey }, authorization);
    const reference = transaction.transaction_reference;
    if (!reference) throw new Error("Server did not return a transaction reference");
    const paystack = await paystackInitialize({ email, amount: transaction.amount, reference, callbackUrl: callbackUrl || `${req.headers.origin || "https://eventverse-eight.vercel.app"}/?artist-payment=callback` });
    await attachProviderReference(transaction.id, paystack.reference);
    return json(res, 200, { transactionId: transaction.id, reference: paystack.reference, transactionReference: transaction.transaction_reference, authorizationUrl: paystack.authorization_url, accessCode: paystack.access_code, amount: transaction.amount, currency: transaction.currency, transactionType });
  } catch (error) {
    console.error("Artist Paystack initialization error", error);
    return json(res, 400, { error: error instanceof Error ? error.message : "Unable to initialize artist payment" });
  }
}
