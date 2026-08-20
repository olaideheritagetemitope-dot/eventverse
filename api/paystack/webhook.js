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

async function findArtistTransactionByReference(reference) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/artist_fee_transactions?select=id,amount,status,transaction_type,user_id,artist_id&provider=eq.paystack&provider_reference=eq.${encodeURIComponent(reference)}&limit=1`, { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Unable to find artist transaction");
  return payload?.[0] || null;
}

async function markArtistFailure(transaction) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const now = new Date().toISOString();
  const transactionUrl = `${SUPABASE_URL}/rest/v1/artist_fee_transactions?id=eq.${encodeURIComponent(transaction.id)}`;
  await fetch(transactionUrl, { method: "PATCH", headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: "FAILED", updated_at: now }) });
  const table = transaction.transaction_type === "REGISTRATION" ? "artist_registrations" : "artist_verifications";
  const key = transaction.transaction_type === "REGISTRATION" ? "transaction_id" : "transaction_id";
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${key}=eq.${encodeURIComponent(transaction.id)}`, { method: "PATCH", headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: "FAILED", failure_reason: "Paystack reported a failed or disputed charge", updated_at: now }) });
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
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(String(signature), "utf8");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function logWebhook(level, payload) {
  const safe = {
    event: payload.event || null,
    reference: payload.reference || null,
    payment_id: payload.payment_id || null,
    order_id: payload.order_id || null,
    transaction_id: payload.transaction_id || null,
    failure_category: payload.failure_category || null,
  };
  (console[level] || console.log)(JSON.stringify({ scope: "paystack_webhook", timestamp: new Date().toISOString(), ...safe }));
}

function isExpectedCurrency(data) {
  return String(data?.currency || "").toUpperCase() === "NGN";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 503, { error: "Payment verification is not configured" });
  }

  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (!verifySignature(rawBody, req.headers["x-paystack-signature"])) {
      logWebhook("warn", { failure_category: "invalid_signature" });
      return json(res, 401, { error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    const reference = event?.data?.reference;
    if (!reference) return json(res, 200, { received: true, ignored: true });

    const artistTransaction = await findArtistTransactionByReference(reference);
    if (artistTransaction) {
      const expectedKobo = Math.round(Number(artistTransaction.amount) * 100);
      const receivedKobo = Number(event?.data?.amount);
      if (event.event === "charge.success") {
        if (event?.data?.status !== "success" || receivedKobo !== expectedKobo || !isExpectedCurrency(event?.data)) {
          logWebhook("warn", { event: event.event, reference, transaction_id: artistTransaction.id, failure_category: "artist_amount_currency_or_status_mismatch" });
          return json(res, 400, { error: "Artist payment amount, currency, or status mismatch" });
        }
        logWebhook("info", { event: event.event, reference, transaction_id: artistTransaction.id });
        const result = await supabaseRpc("activate_artist_fee_transaction", { p_transaction_id: artistTransaction.id, p_provider_reference: reference });
        return json(res, 200, { received: true, result });
      }
      if (["charge.failed", "charge.dispute.create"].includes(event.event)) {
        logWebhook("warn", { event: event.event, reference, transaction_id: artistTransaction.id, failure_category: "artist_charge_failed_or_disputed" });
        await markArtistFailure(artistTransaction);
        return json(res, 200, { received: true, failed: true });
      }
      return json(res, 200, { received: true, ignored: true });
    }

    const payment = await findPaymentByReference(reference);
    if (!payment) return json(res, 200, { received: true, ignored: true });

    const expectedKobo = Math.round(Number(payment.amount) * 100);
    const receivedKobo = Number(event?.data?.amount);
    if (event.event === "charge.success") {
      if (event?.data?.status !== "success" || receivedKobo !== expectedKobo || !isExpectedCurrency(event?.data)) {
        logWebhook("warn", { event: event.event, reference, payment_id: payment.id, order_id: payment.order_id, failure_category: "amount_currency_or_status_mismatch" });
        return json(res, 400, { error: "Payment amount, currency, or status mismatch" });
      }
      logWebhook("info", { event: event.event, reference, payment_id: payment.id, order_id: payment.order_id });
      const result = await supabaseRpc("verify_payment_and_issue_tickets", {
        p_payment_id: payment.id,
        p_provider_reference: reference,
      });
      return json(res, 200, { received: true, result });
    }

    if (["charge.failed", "charge.dispute.create"].includes(event.event)) {
      logWebhook("warn", { event: event.event, reference, payment_id: payment.id, order_id: payment.order_id, failure_category: "charge_failed_or_disputed" });
      const result = await supabaseRpc("mark_payment_failed", {
        p_payment_id: payment.id,
        p_provider_reference: reference,
      });
      return json(res, 200, { received: true, result });
    }

    return json(res, 200, { received: true, ignored: true });
  } catch (error) {
    logWebhook("error", { failure_category: "webhook_processing_error" });
    return json(res, 500, { error: "Webhook processing failed" });
  }
}
