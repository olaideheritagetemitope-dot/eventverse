const SUPABASE_URL = "https://blalvoelllndmbppbkcy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UPS5rb-O3q2hExK0RtPoBA_dn5X6aPf";
function json(res, status, body) { res.status(status).json(body); }
async function supabaseRpc(name, args, authorization) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Supabase request failed");
  return Array.isArray(payload) ? payload[0] : payload;
}
async function paystackInitialize({ email, amount, reference, callbackUrl }) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, amount: Math.round(Number(amount) * 100), currency: "NGN", reference, callback_url: callbackUrl }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) throw new Error(payload?.message || "Paystack transaction initialization failed");
  return payload.data;
}
async function attachProviderReference(paymentId, reference) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/venue_booking_payments?id=eq.${encodeURIComponent(paymentId)}`, { method: "PATCH", headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ provider_reference: reference, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new Error("Unable to attach venue payment provider reference");
}
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return json(res, 503, { error: "Venue payment provider is not configured" });
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });
  try {
    const { bookingId, email, idempotencyKey, callbackUrl } = req.body || {};
    if (!bookingId || !email || !idempotencyKey) return json(res, 400, { error: "bookingId, email, and idempotencyKey are required" });
    const payment = await supabaseRpc("initialize_venue_booking_payment", { p_booking_id: bookingId, p_idempotency_key: idempotencyKey }, authorization);
    const reference = `ATZ-VENUE-${payment.id}`;
    const paystack = await paystackInitialize({ email, amount: payment.amount, reference, callbackUrl: callbackUrl || `${req.headers.origin || "https://eventverse-eight.vercel.app"}/?venue-payment=callback` });
    await attachProviderReference(payment.id, paystack.reference);
    return json(res, 200, { paymentId: payment.id, bookingId: payment.booking_id, reference: paystack.reference, authorizationUrl: paystack.authorization_url, accessCode: paystack.access_code, amount: payment.amount, currency: payment.currency });
  } catch (error) {
    console.error("Venue Paystack initialization error", error);
    return json(res, 400, { error: error instanceof Error ? error.message : "Unable to initialize venue payment" });
  }
}
