# Live Super Admin authority findings — 2026-08-22

Source: live Supabase project `blalvoelllndmbppbkcy` (EventVerse), inspected through the configured Supabase MCP `execute_sql` query against `pg_proc`.

## Confirmed live functions

- `admin_review_role_application(p_application_id uuid, p_status text, p_reason text)` requires `public.is_super_admin()` and allows `APPROVED`, `REJECTED`, `REQUEST_CHANGES`, `SUSPENDED`, and `BLOCKED`.
- On approval, the RPC sets `role_applications.status` to `APPROVED` when `fee_amount > 0`, otherwise `ACTIVE`; it sets `fee_status` to `PENDING` or `NOT_REQUIRED` accordingly, and records an `audit_logs` row.
- `admin_role_governance_snapshot()` requires `public.is_super_admin()` and returns users, applications, verification queue, fees, active questions, wallets, support, event lifecycle, ticket accounting, engagement, and analytics.
- `admin_list_users(p_search text)` is security-definer and gated by `has_admin_permission('users.manage')`; it returns authenticated users and aggregated role codes.
- `admin_recent_audit_logs()` is gated by `has_admin_permission('audit.view')`.
- `activate_role_application_payment(...)` inserts the role into `user_roles` with `ON CONFLICT DO NOTHING`, changes the application to `ACTIVE`, and creates/links Artist, Organizer, or Venue Manager profile data.

## Important implications

The inspected result was truncated before the role-mutation RPC definition. The next inspection must target the exact Super Admin mutation function(s), their argument signatures, and the `user_roles`, `roles`, role-status, permission, and audit-history columns. The authority requirement is to remove only artificial role-boundary restrictions for callers already proven to be Super Admin; ordinary users must remain unable to self-grant privileged roles. Audit logging must remain write-only evidence, not a permission blocker.

## Source artifact

The complete raw query result is stored at `/home/ubuntu/.mcp/tool-results/2026-08-22_12-47-37.682211980_supabase_execute_sql_414c9f5e.json`.
