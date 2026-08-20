# Organizer Production Hardening Audit

Source: https://chatgpt.com/s/t_6a86a65439d08191af0b24a8bd7939da

## Directive acceptance gates

The directive requires fix-in-place changes only: preserve existing UI, cards, routes, and framework; remove only production mock data; verify deployed Supabase state, migrations, RPCs, RLS, payment/webhook/ticket/attendee/check-in/analytics chains, Vercel deployment, responsive behavior, authentication, and existing role regressions. Static source-string tests are insufficient; runtime/integration evidence is required wherever possible.

Required security tests include unauthenticated and normal-user Organizer denial, cross-organizer event/ticket/attendee/analytics/artist-association isolation, no ADMIN/SUPER_ADMIN escalation, client amount manipulation rejection, fake payment rejection, duplicate webhook idempotency, concurrent inventory protection, and duplicate check-in rejection.

Required end-to-end chain: normal user -> Organizer -> event -> ticket type -> publish -> public discovery -> checkout -> Paystack -> webhook -> verified payment -> ticket -> attendee -> Organizer attendees -> check-in -> analytics.

## Current audit findings

1. Production Supabase function audit confirms these functions exist: `activate_artist_fee_transaction`, `apply_as_organizer`, `attach_payment_provider_reference`, `cancel_organizer_event`, `check_in_ticket`, `get_organizer_event_dashboard`, `initialize_artist_fee_payment`, `initialize_order_payment`, `publish_organizer_event`, and `verify_payment_and_issue_tickets`.
2. Migration `0013_directive_payment_checkin_reconcile.sql` is deployed and provides `verify_payment_and_issue_tickets` and `check_in_ticket`.
3. The deployed QR-token function in `0009_secure_ticket_qr_tokens.sql` still authorizes `check_in_ticket_with_token` by broad role membership only and does not scope Organizer callers to the ticket event’s organizer. The scanner path exposes this function, so it must be hardened with event ownership checks while preserving Admin/Super Admin behavior.
4. `api/paystack/webhook.js` verifies HMAC signature, provider reference lookup, status, and amount, but does not explicitly validate currency and does not emit structured safe identifiers for observability. These are remaining hardening targets.
5. Existing inventory reservation SQL uses row locks and idempotency; runtime race-condition evidence still needs focused coverage.
6. Existing credential tests validate Supabase and Paystack connectivity but do not prove the end-to-end production workflow; acceptance tests need to distinguish static contract checks from live integration evidence.
