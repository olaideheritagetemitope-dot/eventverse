import crypto from "node:crypto";
import { supabaseServerFetch, supabaseServerRpc, hasSupabaseServerConfig, SUPABASE_URL } from "../_lib/supabase-server.js";

function json(res, status, body) {
  res.status(status).json(body);
}

async function supabasePatch(path, body) {
  const { response, payload } = await supabaseServerFetch(path, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Supabase update failed");
  return payload;
}

async function findArtistTransactionByReference(reference) {
  const { response, payload } = await supabaseServerFetch(`/rest/v1/artist_fee_transactions?select=id,amount,status,transaction_type,user_id,artist_id&provider=eq.paystack&or=(provider_reference.eq.${encodeURIComponent(reference)},transaction_reference.eq.${encodeURIComponent(reference)})&limit=1`);
  if (!response.ok) throw new Error(payload?.message || "Unable to find artist transaction");
  return payload?.[0] || null;
}

async function markArtistFailure(transaction) {
  const now = new Date().toISOString();
  await supabasePatch(`/rest/v1/artist_fee_transactions?id=eq.${encodeURIComponent(transaction.id)}`, { status: "FAILED", updated_at: now });
  const table = transaction.transaction_type === "REGISTRATION" ? "artist_registrations" : "artist_verifications";
  await supabasePatch(`/rest/v1/${table}?transaction_id=eq.${encodeURIComponent(transaction.id)}`, { status: "FAILED", failure_reason: "Paystack reported a failed or disputed charge", updated_at: now });
}

async function findRoleApplicationPaymentByReference(reference) {
  const { response, payload } = await supabaseServerFetch(`/rest/v1/role_application_payments?select=id,application_id,amount,status&provider=eq.paystack&or=(provider_reference.eq.${encodeURIComponent(reference)},transaction_reference.eq.${encodeURIComponent(reference)})&limit=1`);
  if (!response.ok) throw new Error(payload?.message || "Unable to find role application payment");
  return payload?.[0] || null;
}

async function markRoleApplicationFailure(payment) {
  await supabasePatch(`/rest/v1/role_application_payments?id=eq.${encodeURIComponent(payment.id)}&status=neq.VERIFIED_SUCCESS`, { status: "FAILED", updated_at: new Date().toISOString() });
}

async function findVenuePaymentByReference(reference) {
  const { response, payload } = await supabaseServerFetch(`/rest/v1/venue_booking_payments?select=id,booking_id,amount,status&provider=eq.paystack&or=(provider_reference.eq.${encodeURIComponent(reference)},transaction_reference.eq.${encodeURIComponent(reference)})&limit=1`);
  if (!response.ok) throw new Error(payload?.message || "Unable to find venue payment");
  return payload?.[0] || null;
}

async function markVenueFailure(payment) {
  await supabasePatch(`/rest/v1/venue_booking_payments?id=eq.${encodeURIComponent(payment.id)}&status=neq.SUCCESS`, { status: "FAILED", updated_at: new Date().toISOString() });
}

async function findPaymentByReference(reference) {
  const { response, payload } = await supabaseServerFetch(
    `/rest/v1/payments?select=id,amount,order_id,status&provider=eq.paystack&or=(provider_reference.eq.${encodeURIComponent(reference)},transaction_reference.eq.${encodeURIComponent(reference)})&limit=1`,
  );
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

async function verifyPaystackTransaction(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) throw new Error(payload?.message || "Paystack live verification failed");
  return payload.data || {};
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
  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (!verifySignature(rawBody, req.headers["x-paystack-signature"])) {
      logWebhook("warn", { failure_category: "invalid_signature" });
      return json(res, 401, { error: "Invalid signature" });
    }
    if (!process.env.PAYSTACK_SECRET_KEY || !hasSupabaseServerConfig()) {
      return json(res, 503, { error: "Payment verification is not configured" });
    }

    const event = JSON.parse(rawBody);
    const reference = event?.data?.reference;
    if (!reference) return json(res, 200, { received: true, ignored: true });

    if (event.event === "charge.success") {
      const verified = await verifyPaystackTransaction(reference);
      const verifiedReference = String(verified.reference || "").trim();
      if (verifiedReference !== reference || verified.status !== "success") {
        logWebhook("warn", { event: event.event, reference, failure_category: "live_provider_status_not_success" });
        return json(res, 402, { error: `Paystack transaction status is ${verified.status || "not successful"}` });
      }
      event.data = { ...event.data, ...verified };
    }

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
        const result = await supabaseServerRpc("activate_artist_fee_transaction", { p_transaction_id: artistTransaction.id, p_provider_reference: reference });
        return json(res, 200, { received: true, result });
      }
      if (["charge.failed", "charge.dispute.create"].includes(event.event)) {
        logWebhook("warn", { event: event.event, reference, transaction_id: artistTransaction.id, failure_category: "artist_charge_failed_or_disputed" });
        await markArtistFailure(artistTransaction);
        return json(res, 200, { received: true, failed: true });
      }
      return json(res, 200, { received: true, ignored: true });
    }

    const roleApplicationPayment = await findRoleApplicationPaymentByReference(reference);
    if (roleApplicationPayment) {
      const expectedKobo = Math.round(Number(roleApplicationPayment.amount) * 100);
      const receivedKobo = Number(event?.data?.amount);
      if (event.event === "charge.success") {
        if (event?.data?.status !== "success" || receivedKobo !== expectedKobo || !isExpectedCurrency(event?.data)) {
          logWebhook("warn", { event: event.event, reference, payment_id: roleApplicationPayment.id, failure_category: "role_application_amount_currency_or_status_mismatch" });
          return json(res, 400, { error: "Role verification payment amount, currency, or status mismatch" });
        }
        const result = await supabaseServerRpc("activate_role_application_payment", { p_payment_id: roleApplicationPayment.id, p_provider_reference: reference });
        return json(res, 200, { received: true, result });
      }
      if (["charge.failed", "charge.dispute.create"].includes(event.event)) {
        await markRoleApplicationFailure(roleApplicationPayment);
        logWebhook("warn", { event: event.event, reference, payment_id: roleApplicationPayment.id, failure_category: "role_application_charge_failed_or_disputed" });
        return json(res, 200, { received: true, failed: true });
      }
      return json(res, 200, { received: true, ignored: true });
    }

    const venuePayment = await findVenuePaymentByReference(reference);
    if (venuePayment) {
      const expectedKobo = Math.round(Number(venuePayment.amount) * 100);
      const receivedKobo = Number(event?.data?.amount);
      if (event.event === "charge.success") {
        if (event?.data?.status !== "success" || receivedKobo !== expectedKobo || !isExpectedCurrency(event?.data)) {
          logWebhook("warn", { event: event.event, reference, payment_id: venuePayment.id, failure_category: "venue_amount_currency_or_status_mismatch" });
          return json(res, 400, { error: "Venue payment amount, currency, or status mismatch" });
        }
        const result = await supabaseServerRpc("verify_venue_booking_payment", { p_payment_id: venuePayment.id, p_provider_reference: reference });
        return json(res, 200, { received: true, result });
      }
      if (["charge.failed", "charge.dispute.create"].includes(event.event)) {
        await markVenueFailure(venuePayment);
        logWebhook("warn", { event: event.event, reference, payment_id: venuePayment.id, failure_category: "venue_charge_failed_or_disputed" });
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
      const result = await supabaseServerRpc("verify_payment_and_issue_tickets", {
        p_payment_id: payment.id,
        p_provider_reference: reference,
      });
      return json(res, 200, { received: true, result });
    }

    if (["charge.failed", "charge.dispute.create"].includes(event.event)) {
      logWebhook("warn", { event: event.event, reference, payment_id: payment.id, order_id: payment.order_id, failure_category: "charge_failed_or_disputed" });
      const result = await supabaseServerRpc("mark_payment_failed", {
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
