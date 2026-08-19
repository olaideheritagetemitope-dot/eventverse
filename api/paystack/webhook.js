import crypto from "node:crypto";

const SUPABASE_URL = "https://blalvoelllndmbppbkcy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UPS5rb-O3q2hExK0RtPoBA_dn5X6aPf";

function json(res, status, body) {
  res.status(status).json(body);
}

async function supabaseRpc(name, args) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceRole || SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Supabase request failed");
  return payload;
}

async function findPaymentByReference(reference) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payments?select=id,amount,order_id,status&provider=eq.paystack&provider_reference=eq.${encodeURIComponent(reference)}&limit=1`,
    {
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Unable to find payment");
  return payload?.[0] || null;
}

function verifySignature(rawBody, signature) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const digest = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 503, { error: "Payment verification is not configured" });
  }

  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (!verifySignature(rawBody, req.headers["x-paystack-signature"])) return json(res, 401, { error: "Invalid signature" });

    const event = JSON.parse(rawBody);
    const reference = event?.data?.reference;
    if (!reference) return json(res, 200, { received: true, ignored: true });

    const payment = await findPaymentByReference(reference);
    if (!payment) return json(res, 200, { received: true, ignored: true });

    const expectedKobo = Math.round(Number(payment.amount) * 100);
    const receivedKobo = Number(event?.data?.amount);
    if (event.event === "charge.success") {
      if (event?.data?.status !== "success" || receivedKobo !== expectedKobo) {
        return json(res, 400, { error: "Payment amount or status mismatch" });
      }
      const result = await supabaseRpc("verify_payment_and_issue_tickets", {
        p_payment_id: payment.id,
        p_provider_reference: reference,
      });
      return json(res, 200, { received: true, result });
    }

    if (["charge.failed", "charge.dispute.create"].includes(event.event)) {
      const result = await supabaseRpc("mark_payment_failed", {
        p_payment_id: payment.id,
        p_provider_reference: reference,
      });
      return json(res, 200, { received: true, result });
    }

    return json(res, 200, { received: true, ignored: true });
  } catch (error) {
    console.error("Paystack webhook error", error);
    return json(res, 500, { error: "Webhook processing failed" });
  }
}
