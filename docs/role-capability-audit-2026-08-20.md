# Atizzy Role-Capability Audit — 2026-08-20

## Scope

Audited the extracted directive in `linked-directive-6a86ffa4-role-capabilities.md` against the active React/Vite application, Supabase migrations/RPCs/RLS, service wrappers, and live production catalog.

## Roles covered

The live system exposes the directive roles: `ATTENDEE`, `ARTIST`, `ORGANIZER`, `VENUE_MANAGER`, `EVENT_STAFF`, `ADMIN`, and `SUPER_ADMIN`.

The role hierarchy remains domain- and ownership-based. `SUPER_ADMIN` retains universal effective-role authority through the existing effective-role architecture. `ADMIN` is not automatically unlimited; administrative actions require delegated grants.

## Implemented in this milestone

- Added `admin_permission_grants` with expiry, revocation, grant actor, unique admin/permission pairs, RLS, and audit logging.
- Added protected `has_admin_permission`, `list_admin_permission_grants`, `set_admin_permission`, and `role_capability_matrix` RPCs.
- Replaced broad Admin gates in dashboard, user management, moderation, report, payment-support, and audit-log RPCs with capability-specific server checks.
- Added a live Admin capability catalog for the matrix while preserving `delegated_grant_required` enforcement semantics.
- Added `RoleCapabilities` UI with live role permission chips and Super Admin-only Admin grant/revoke controls.
- Added entry points from RoleCenter and Admin Operations so the capability module is visible in the existing UI.
- Preserved existing artist, organizer, venue-manager, event-staff, attendee, private-ticket, notification, and commerce workflows.

## Live verification

- Supabase migration `delegated_admin_capabilities` applied successfully.
- Supabase migration `admin_capability_catalog` applied successfully.
- Live catalog query confirmed the four new RPCs exist.
- Live permission catalog contains 25 canonical permission codes.
- Live role-permission query confirmed baseline mappings for Attendee, Artist, Organizer, Venue Manager, Event Staff, and Super Admin; Admin catalog mappings are now added by migration `0035`.

## Validation

- Vitest: 28 test files, 100 tests passed.
- TypeScript: passed.
- Vite production build: passed.
- Build emitted only the existing large-chunk advisory; no compilation or runtime build error was reported.
