# Admin directive reconciliation

Source: [ChatGPT shared directive](https://chatgpt.com/s/t_6a86bb057ea08191a6fd1cdce68df8a5)

The directive requires completing the Admin role before moving to another role. It instructs the implementation to inspect the current repository and Supabase architecture first; determine what Admin functionality already exists; reuse the existing architecture and preserve the existing UI; connect existing UI to live backend data; secure privileged operations; keep Admin strictly separate from Super Admin; remove mock data without removing UI; run tests; build; deploy; and provide a complete report covering the commit SHA, files changed, database changes, migrations, RLS policies, RPC/API changes, Admin role implementation, permission model, user management, moderation, reports, analytics, payment support, audit logging, mock data removal, UI preservation, responsive fixes, tests, build, deployment, remaining issues, and items reserved for later verification.

Current repository schema audit:

- `public.roles` already contains separate `ADMIN` and `SUPER_ADMIN` role codes.
- `public.user_profiles`, `public.user_roles`, and `public.roles` provide the existing identity/RBAC foundation.
- `public.events`, `public.orders`, `public.payments`, `public.tickets`, `public.artists`, and `public.venues` are the existing operational entities.
- `public.audit_logs` stores `actor_id`, `action`, `entity_type`, `entity_id`, `metadata`, and `created_at`.
- Existing RLS helper `public.has_any_app_role(...)` treats Admin and Super Admin as privileged, but Super Admin-only fee settings and analytics already exist and must remain separated.
- Existing UI includes a shared Role Center, Super Admin artist pricing, analytics, and audit history; no complete separate Admin operations workspace was found in the current route map.

Implementation target: add a separate Admin workspace and server-authoritative RPCs for user management, moderation, reports, analytics, payment support, and audit inspection, while explicitly excluding Super Admin-only fee changes and platform configuration.
