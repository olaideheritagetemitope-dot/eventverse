# EventVerse / Atizzy Master Implementation Directive

Source: https://chatgpt.com/s/t_6a85ad48427c8191964f8b02f6111db8

## Product objective
Transform the existing frontend/prototype and partially connected Supabase backend into a real, secure, responsive, persistent, role-aware full-stack application without unnecessarily redesigning the existing UI. The database must be the source of truth; frontend components must not duplicate fake production datasets.

## Required real workflows
Authentication, profiles, database-backed events, artists, venues, ticket types, inventory, reservations, orders, payments, digital tickets, QR tickets, scanning/check-in, favorites/follows, event creation, bookings, and role assignment must wait for actual backend results. No decorative buttons may pretend operations succeeded.

## Security and roles
Roles are never self-selected. Public signup creates an ATTENDEE. Privileged roles are attached to existing authenticated accounts through secure server-side provisioning. Required roles: ATTENDEE, ARTIST, ORGANIZER, VENUE_MANAGER, EVENT_STAFF, ADMIN, SUPER_ADMIN. Enforce authorization server-side and with RLS. Test role boundaries: attendees cannot access admin; artists cannot modify other artists; organizers cannot modify another organizer’s events; venue managers cannot modify another venue; staff cannot scan unrelated events; admins cannot perform SUPER_ADMIN operations.

## Payment architecture
Build a provider abstraction, order lifecycle, payment states, webhook architecture, safe development/test mode, verification, refunds, duplicate-webhook handling, and ticket issuance before live credentials arrive. Paystack credentials are a blocker for live payment activation only. Never fabricate, commit, or expose payment secrets.

## Data and backend
Inspect and reuse the existing schema, migrations, RLS, auth, environment variables, deployment configuration, and workflows before architectural changes. Extend incomplete schema through migrations. Keep seed data only for development/testing. Never commit secrets, service-role keys, Paystack secrets, Spotify client secrets, private certificates, or .env files.

## Implementation sequence
1. Repository/database/frontend audit
2. Authentication and profiles
3. Roles, permissions, and secure admin provisioning
4. Real catalog data
5. Event management
6. Ticket inventory and reservation
7. Orders and payment abstraction
8. Paystack integration when credentials are supplied
9. Digital tickets and check-in
10. Artists and booking
11. Music
12. Notifications
13. Admin operations
14. Venue manager
15. Event staff
16. Responsive/accessibility
17. Security/performance hardening
18. Automated testing
19. Production deployment
20. Full end-to-end verification

## Testing requirements
For each feature test happy path, invalid input, unauthorized user, wrong owner, expired state, duplicate request, network failure, database failure, mobile UI, and desktop UI. Authentication tests include signup, verification, login, logout, password reset, Spotify, and session restoration. Test every role and payment initialization/success/failure/cancellation/webhook/duplicate webhook/verification/refund/failed refund/ticket issuance.

## Production workflow
After each major milestone: build, deploy, verify, inspect logs, test production, verify database/RLS/UI/responsive/role behavior, and document changes. When blocked by missing credentials report exactly `BLOCKED — CREDENTIAL REQUIRED` and continue non-blocked work.

## Required audit documents
Produce and maintain: EVENTVERSE_IMPLEMENTATION_AUDIT.md, EVENTVERSE_FRONTEND_FUNCTIONAL_SPEC.md, EVENTVERSE_FRONTEND_GAPS.md, EVENTVERSE_ROLE_PERMISSION_MATRIX.md, EVENTVERSE_API_WORKFLOW.md, EVENTVERSE_DATABASE_ARCHITECTURE.md, EVENTVERSE_PAYMENT_ARCHITECTURE.md, and EVENTVERSE_PRODUCTION_CHECKLIST.md. Final reporting must include changed files, migrations, new functions, services, routes, permissions, RLS changes, tests, deployment status, and known blockers.

## Definition of done
A feature is complete only when frontend, backend, database, authentication, authorization, RLS, validation, error handling, loading states, persistence, audit logging where appropriate, testing, responsiveness, and security work together. Do not claim full functionality without actual end-to-end tests, hide incomplete features, mark unverified TODOs complete, leave mock production datasets, implement authorization only in React, expose secrets, or allow privileged role escalation.

## Required end-to-end flows
Normal user: signup -> verification -> ATTENDEE -> Home -> Explore -> Search -> Event -> Ticket -> Reservation -> Checkout -> Payment -> Ticket -> QR -> Event -> Check-in.

Artist: existing account/login -> ARTIST role -> artist dashboard -> profile/music/availability -> booking requests -> accept/reject/negotiate -> confirmed booking.

Organizer: existing account/login -> ORGANIZER role -> dashboard -> create event -> draft -> venue -> artists -> tickets -> submit -> admin review -> approval -> publish -> sales -> analytics/settlement.

Venue manager: existing account/login -> VENUE_MANAGER role -> venue dashboard -> manage venue -> availability -> event requests -> approved events -> venue operations.

Event staff: existing account/login -> EVENT_STAFF role -> assigned events -> scanner -> ticket validation -> check-in.

Admin: existing account/login -> ADMIN role -> admin dashboard -> users/events/artists/organizers/venues/tickets/payments/bookings/moderation/reports/audit.

Super admin: existing account/login -> SUPER_ADMIN role -> platform administration -> role provisioning -> system configuration -> security/audit -> authorized platform operations.
