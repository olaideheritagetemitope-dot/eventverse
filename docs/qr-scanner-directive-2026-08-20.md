# Atizzy QR Ticket Scanner Directive — Implementation Evidence

## Scope

The QR scanner was rebuilt as an Atizzy-preserving, server-authoritative ticket-entry workflow. Existing scanner cards, responsive layout, camera framing, controls, and staff context remain in place; only the data and validation path were expanded.

## Implemented behavior

The scanner supports live camera decoding and local QR decoding from a selected picture. Selected pictures are decoded locally and are not converted into URL-based media records or uploaded as ticket evidence. Camera scanning can be paused and resumed, repeated scans are suppressed for a short window, and the result panel provides a Scan another ticket action.

Scanner navigation forwards the assigned event and assignment context. The service calls the `validate_ticket_qr` Supabase RPC with the decoded server-issued token and expected event ID. No client-side ticket status is trusted for entry decisions.

The live migration `supabase/0046_ticket_qr_validation_result_states.sql` was applied to Supabase project `blalvoelllndmbppbkcy`. The RPC uses `security definer`, requires an authenticated caller, enforces expected-event scope, checks Admin/Super Admin, organizer, venue-manager, and event-staff authorization, locks the ticket row with `FOR UPDATE`, performs an atomic check-in update, and writes audit events for successful and rejected verification attempts.

Explicit result states are represented for success, already-used, invalid QR, expired, cancelled, refunded, revoked/rejected, wrong event, unauthorized, network/server failure, and unknown responses. Existing Event Staff decision compatibility is retained, but the authoritative runtime validation path is the new RPC.

## Validation

TypeScript validation passed. The full suite passed with **39 test files and 136 tests**, with two credential-dependent checks skipped by design. The Vite production build passed; only the existing large-chunk advisory remains. Added coverage is in `tests/qr-scanner.directive.acceptance.test.js`.

The implementation preserves the no-mock-data contract and does not fabricate ticket, attendee, event, or attendance records in the frontend.
