# Live Atizzy Payment Reference Audit Findings — 2026-08-22

The live Supabase audit inspected payment-related columns, indexes, and function definitions for `payments`, `venue_booking_payments`, orders, wallet, and transaction-like tables. The complete connector result is preserved at `/home/ubuntu/.mcp/tool-results/2026-08-22_13-19-42.028825124_supabase_execute_sql_ca4450eb.json`.

## Confirmed payment contracts

`public.initialize_order_payment(uuid,text,text)` and its later definition in migration `0056_ticket_payment_checkout_idempotency.sql` accept `p_order_id`, provider, and a caller-provided `p_idempotency_key`. They reuse the row found by `(order_id, idempotency_key)` and insert into `public.payments`; the returned payload currently exposes `provider_reference`, but the initializer does not itself generate a server transaction reference.

`public.initialize_artist_fee_payment(text,text)` accepts a caller-provided idempotency key and reuses `artist_fee_transactions` by `idempotency_key`. It inserts a new transaction with no server-generated transaction reference in the audited definition. Registration and verification are separate transaction types.

`public.initialize_venue_booking_payment(uuid,text)` accepts a caller-provided idempotency key but uses `on conflict (booking_id) do update`, making the booking the idempotency scope rather than a distinct payment-attempt scope. The audited definition does not show a server-generated transaction reference.

`public.verify_payment_and_issue_tickets(uuid,text)` and `public.attach_payment_provider_reference(uuid,text)` attach the external provider reference after initialization. `public.activate_artist_fee_transaction(uuid,text)` similarly stores the provider reference after verification. `public.verify_venue_booking_payment(uuid,text)` stores a provider reference on the venue payment row.

## Root-risk indicators

The audited live definitions rely on caller-provided idempotency keys and payment/provider references. The audit result did not establish a universal unique constraint on all payment transaction references. Ticket and Artist initializers do not show a server-generated reference. Venue initialization is keyed by booking conflict behavior, which needs to be separated into same-attempt idempotency versus new-attempt reference generation.

## Required corrective design

1. Add a canonical server-generated transaction reference column/contract per payment domain, with a collision-safe generator using cryptographic randomness and a database uniqueness constraint.
2. Keep idempotency keys as the stable identity of one payment attempt. A retry with the same attempt key must return the existing row and its original reference; a newly created attempt must use a new key and receive a new server reference.
3. Apply this to ticket `payments`, Artist fee transactions, Venue booking payments, Organizer/role verification payments, wallet/debit/credit payment records, and any other live provider-payment tables.
4. Remove frontend or predictable reference generation and ensure callbacks/webhooks resolve by the stored server reference/payment identity without creating another payment row.
5. Reconcile existing duplicate references before creating unique constraints, and add regression tests for same-key replay, new-key uniqueness, concurrent initialization, callback replay, and all payment types.
