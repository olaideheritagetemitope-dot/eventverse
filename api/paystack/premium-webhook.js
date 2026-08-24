import crypto from "node:crypto";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
function json(res, status, body) { res.status(status).json(body); }
async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, ...(options.headers || {}) } });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}
async function paystackVerify(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) throw new Error(payload?.message || "Paystack live verification failed");
  return payload.data || {};
}
async function activate(payment, providerReference, paidAmount, paidCurrency) {
  const { response, payload } = await supabaseFetch("/rest/v1/rpc/activate_premium_payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_payment_id: payment.id, p_provider_reference: providerReference, p_paid_amount: Number(paidAmount) / 100, p_paid_currency: paidCurrency || payment.currency }) });
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Unable to activate Premium entitlement");
  return payload;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) return json(res, 503, { error: "Premium webhook is not configured" });
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  const signature = req.headers["x-paystack-signature"];
  const expected = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  if (typeof signature !== "string" || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return json(res, 401, { error: "Invalid webhook signature" });
  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (payload.event !== "charge.success") return json(res, 200, { ignored: true });
    const data = payload.data || {};
    const reference = String(data.reference || "").trim();
    if (!reference) return json(res, 400, { error: "Webhook reference is required" });
    const paymentResult = await supabaseFetch(`/rest/v1/premium_payments?select=id,amount,currency,status,provider_reference&or=(transaction_reference.eq.${encodeURIComponent(reference)},provider_reference.eq.${encodeURIComponent(reference)})&limit=1`);
    if (!paymentResult.response.ok || !paymentResult.payload?.[0]) return json(res, 202, { accepted: true, ignored: true });
    const payment = paymentResult.payload[0];
    if (payment.status === "SUCCESS") return json(res, 200, { processed: true, replayed: true });
    const verified = await paystackVerify(reference);
    const verifiedReference = String(verified.reference || reference).trim();
    if (verifiedReference !== reference || verified.status !== "success") return json(res, 402, { error: `Paystack transaction status is ${verified.status || "not successful"}` });
    if (Number(verified.amount) !== Math.round(Number(payment.amount) * 100)) return json(res, 409, { error: "Verified Paystack amount does not match Premium payment" });
    if (String(verified.currency || "").toUpperCase() !== String(payment.currency || "").toUpperCase()) return json(res, 409, { error: "Verified Paystack currency does not match Premium payment" });
    const activation = await activate(payment, verifiedReference, verified.amount, verified.currency);
    return json(res, 200, { processed: true, activation });
  } catch (error) {
    console.error("Premium Paystack webhook error", error);
    return json(res, 500, { error: error instanceof Error ? error.message : "Unable to process Premium webhook" });
  }
}
export const config = { api: { bodyParser: false } };
