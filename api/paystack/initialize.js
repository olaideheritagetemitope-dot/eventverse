import crypto from "node:crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function json(res, status, body) {
  res.status(status).json(body);
}

async function supabaseRpc(name, args, authorization) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Supabase request failed");
  return payload;
}

async function updatePayment(paymentId, patch) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.hint || "Unable to persist payment checkout");
  }
}

function getAuthorizationUrl(payment) {
  return payment?.authorization_url || payment?.authorizationUrl || payment?.checkout_url || payment?.checkoutUrl || null;
}

async function paystackInitialize({ email, amount, reference, callbackUrl }) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(Number(amount) * 100),
      currency: "NGN",
      reference,
      callback_url: callbackUrl,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) {
    throw new Error(payload?.message || "Paystack transaction initialization failed");
  }
  return payload.data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json(res, 503, { error: "Payment provider is not configured" });

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });

  try {
    const { orderId, email, callbackUrl } = req.body || {};
    if (!orderId || !email) return json(res, 400, { error: "orderId and email are required" });

    const payment = await supabaseRpc(
      "initialize_order_payment",
      {
        p_order_id: orderId,
        p_provider: "paystack",
        p_idempotency_key: `paystack-${orderId}`,
      },
      authorization,
    );

    const persistedAuthorizationUrl = getAuthorizationUrl(payment);
    if (persistedAuthorizationUrl && payment?.access_code) {
      return json(res, 200, {
        paymentId: payment.payment_id,
        orderId: payment.order_id,
        reference: payment.provider_reference || null,
        authorizationUrl: persistedAuthorizationUrl,
        authorization_url: persistedAuthorizationUrl,
        accessCode: payment.access_code,
        access_code: payment.access_code,
        amount: payment.amount,
        currency: payment.currency,
        replayed: true,
      });
    }

    const reference = payment.provider_reference || `ATZ-${payment.payment_id}`;
    const paystack = await paystackInitialize({
      email,
      amount: payment.amount,
      reference,
      callbackUrl: callbackUrl || `${req.headers.origin || "https://eventverse-eight.vercel.app"}/?payment=callback`,
    });

    const serviceAuthorization = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
    await supabaseRpc(
      "attach_payment_provider_reference",
      { p_payment_id: payment.payment_id, p_provider_reference: paystack.reference },
      serviceAuthorization,
    );
    await updatePayment(payment.payment_id, {
      provider_reference: paystack.reference,
      checkout_url: paystack.authorization_url || null,
      access_code: paystack.access_code || null,
    });

    return json(res, 200, {
      paymentId: payment.payment_id,
      orderId: payment.order_id,
      reference: paystack.reference,
      authorizationUrl: paystack.authorization_url || null,
      authorization_url: paystack.authorization_url || null,
      accessCode: paystack.access_code || null,
      access_code: paystack.access_code || null,
      amount: payment.amount,
      currency: payment.currency,
      replayed: Boolean(payment.replayed),
    });
  } catch (error) {
    console.error("Paystack initialization error", error);
    return json(res, 400, { error: error instanceof Error ? error.message : "Unable to initialize payment" });
  }
}
