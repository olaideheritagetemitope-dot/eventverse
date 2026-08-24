# Paystack provider verification notes

Paystack official documentation reviewed on 2026-08-23:

- Webhooks: https://paystack.com/docs/payments/webhooks/
  - Webhook events include `x-paystack-signature`, an HMAC SHA512 signature of the event payload signed with the secret key.
  - The handler must validate the signature before processing.
  - Paystack expects a `200 OK` acknowledgement; in live mode it retries webhook events every 3 minutes for the first four attempts and hourly for up to 72 hours when acknowledgement is missing.
  - Official docs recommend webhooks for provider updates.
- Verify Payments: https://paystack.com/docs/payments/verify-payments/
  - Paystack currently sends webhooks for successful transactions only, so failed/abandoned/pending states require server-side verification or explicit reconciliation handling.
  - Transaction status is `response.data.status`, not the API envelope's `response.status`.
  - Statuses include abandoned, failed, ongoing, pending, processing, queued, reversed, and success.
  - Verification must be a server-side GET to `/transaction/verify/:reference` using the secret key.
  - Digital value must not be delivered twice when both redirect verification and webhooks are used.

Audit implication: provider-confirmed transaction success, matching reference, amount, and currency must be required before any entitlement, ticket issuance, role activation, or wallet credit; fulfillment must be idempotent and webhook signature validation must precede processing.
