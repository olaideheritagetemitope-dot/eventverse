const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
  res.status(status).json(body);
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: options.apiKey || SUPABASE_ANON_KEY,
      Authorization: options.authorization || `Bearer ${options.apiKey || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Supabase request failed");
  return payload;
}

async function paystackVerify(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) throw new Error(payload?.message || "Paystack verification failed");
  return payload.data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !process.env.PAYSTACK_SECRET_KEY) return json(res, 503, { error: "Payment verification is not configured" });

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });

  try {
    const { paymentId, reference } = req.body || {};
    if (!paymentId || !reference) return json(res, 400, { error: "paymentId and reference are required" });

    const user = await supabaseRequest("/auth/v1/user", { authorization });
    if (!user?.id) return json(res, 401, { error: "Authenticated user not found" });

    const payments = await supabaseRequest(`/rest/v1/payments?select=id,order_id,status,amount,currency,provider_reference,transaction_reference&id=eq.${encodeURIComponent(paymentId)}&limit=1`, { apiKey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` });
    const payment = payments?.[0];
    if (!payment) return json(res, 404, { error: "Payment not found" });

    const orders = await supabaseRequest(`/rest/v1/orders?select=id,user_id,total,currency&id=eq.${encodeURIComponent(payment.order_id)}`, { apiKey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` });
    const order = orders?.[0];
    if (!order || order.user_id !== user.id) return json(res, 403, { error: "Payment does not belong to the authenticated user" });

    const normalizedReference = String(reference).trim();
    const providerReference = String(payment.provider_reference || "").trim();
    if (providerReference && providerReference !== normalizedReference) return json(res, 409, { error: "Payment reference does not match this payment attempt" });

    if (payment.status === "VERIFIED_SUCCESS") {
      const issued = await supabaseRequest("/rest/v1/rpc/verify_payment_and_issue_tickets", {
        method: "POST",
        apiKey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        body: JSON.stringify({ p_payment_id: payment.id, p_provider_reference: normalizedReference }),
      });
      return json(res, 200, { verified: true, issuance: issued, replayed: true });
    }

    const verified = await paystackVerify(normalizedReference);
    if (verified?.status !== "success") return json(res, 402, { error: `Paystack transaction status is ${verified?.status || "not successful"}` });
    if (Number(verified.amount) !== Math.round(Number(payment.amount) * 100)) return json(res, 409, { error: "Verified payment amount does not match the order" });
    if (verified.currency && payment.currency && verified.currency !== payment.currency) return json(res, 409, { error: "Verified payment currency does not match the order" });

    const issuance = await supabaseRequest("/rest/v1/rpc/verify_payment_and_issue_tickets", {
      method: "POST",
      apiKey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      body: JSON.stringify({ p_payment_id: payment.id, p_provider_reference: verified.reference || normalizedReference }),
    });
    return json(res, 200, { verified: true, issuance, providerReference: verified.reference || normalizedReference });
  } catch (error) {
    console.error("Paystack verification error", error);
    return json(res, 400, { error: error instanceof Error ? error.message : "Unable to verify payment" });
  }
}

export const config = { api: { bodyParser: true } };
