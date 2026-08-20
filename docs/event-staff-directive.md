# Event Staff Directive Reconciliation

## Sources

- Shared ChatGPT directive: https://chatgpt.com/s/t_6a86b647238c81918be90959efd636f9
- User attachment: `/home/ubuntu/upload/pasted_content.txt`

## Binding implementation requirements

The implementation must begin with an audit of the existing repository and must preserve the existing UI and architecture. Existing UI should be connected to live Supabase data rather than removed when the database is empty. Event Staff must be an event-scoped operational role, not a platform-wide organizer-like role.

The required authorization chain is `auth.uid() -> staff assignment -> event_id -> event operation`, and a staff member assigned to Event A must be denied access to Event B even when they know Event B's ID. Organizers manage staff assignments for events they own; Super Admin remains platform-level administration and is not required for ordinary staff assignment.

Required staff capabilities include viewing assigned event details, schedules, venue information, operational instructions, assigned tasks, notifications, and authorized ticket scanning/check-in. Check-in must validate tickets, show results, prevent duplicates, and follow the existing ticket architecture. Responsibilities should be event-level assignments such as check-in, security, registration, coordinator, or general staff rather than a proliferation of global roles.

Event Staff must not change organizer or admin roles, platform settings, event ownership, event prices, payment status, venue ownership, artist verification, or access unassigned/other organizers' events or Super Admin functions.

Required implementation sequence: inspect existing code; determine what already exists; implement only missing functionality; connect existing UI to live data; implement event-scoped authorization; implement Organizer staff management; implement check-in/attendance; implement RLS and server-side authorization; remove only production mock data while preserving UI; run tests; run the production build; deploy; provide a report separating implementation/build/deployment status from formal verification status. Do not claim full production verification unless it has actually been performed.
