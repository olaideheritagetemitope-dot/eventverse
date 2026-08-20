# Venue Manager Directive

Sources:
- Shared ChatGPT link: https://chatgpt.com/s/t_6a86aa5c3850819184a8087b6c67cadc
- Attached source: /home/ubuntu/upload/pasted_content.txt

## Product relationship
Normal User -> applies to become Venue Manager -> backend-controlled Venue Manager access -> Venue Manager Dashboard.

## Required workflows
1. Discover Become a Venue Manager from the authenticated user dashboard.
2. Submit a Venue Manager application with required information; browser must never self-assign VENUE_MANAGER.
3. Backend validates and activates authorization.
4. Venue Manager creates and owns a venue with supported fields only: name, description/address/location, capacity, venue type where supported, amenities/rules/contact/images where supported, pricing, availability, booking requirements, cancellation rules.
5. Manage availability states: AVAILABLE, BOOKED, PENDING, BLOCKED; confirmed bookings must prevent conflicts.
6. Organizer selects an available venue while creating an event; selection creates a proper booking request and never auto-books the venue.
7. Booking request includes venue, event, date, start/end time, expected attendance, and additional requirements; backend validates organizer ownership, venue existence, availability, time, capacity, and conflicts; initial state PENDING.
8. Venue Manager dashboard preserves current cards and shows pending, confirmed, rejected, upcoming, calendar, revenue, occupancy, event organizers, and booking history using live data and legitimate zero states.
9. Venue Manager accepts only owned-venue pending requests when still available; concurrent confirmation conflicts must be blocked.
10. Venue Manager rejects with a reason; booking remains in history.
11. Pricing and final amounts are server authoritative; never trust browser totals.
12. If supported by current payment architecture, confirmed venue booking payment uses Paystack -> webhook -> server verification of reference, amount, currency, booking, payer, status, and idempotency.
13. Confirmed Organizer Event -> Venue -> Booking relationship is visible to authorized parties only.
14. RLS/backend rules prevent cross-manager venue, booking, pricing, private analytics, role, payment-status, and fake-confirmation access.
15. Venue analytics use real database values: bookings, confirmed, cancelled, revenue, upcoming events, occupancy, history.
16. Implementation order: audit UI/schema/role; onboarding; venue management; availability; Organizer->Venue request; accept/reject; ownership/RLS; payment if supported; remove mock data; analytics; cross-role relationship; responsive preservation; tests; deploy. Verification remains a later backlog phase.

## Security boundaries
Venue Manager cannot change roles, modify Organizer/Artist verification/Super Admin, edit another manager's venue or pricing, approve another manager's booking, change payment status, create fake confirmed bookings, or access another manager's private analytics.

## Acceptance gates
Preserve existing UI/cards/routes/framework. Use live Supabase data and explicit loading/empty/error states. Validate RLS, conflict prevention, backend state transitions, Paystack webhook idempotency, runtime tests, responsive behavior, production build, and GitHub delivery. Do not claim completion for inaccessible shared-link content; the attached contents are the authoritative extracted source available in the workspace.
