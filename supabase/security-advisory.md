# Supabase security advisory

The EventVerse core migration created 12 tables with Row Level Security disabled: `roles`, `user_roles`, `permissions`, `role_permissions`, `event_categories`, `event_artists`, `ticket_types`, `ticket_reservations`, `reservation_items`, `order_items`, `payments`, and `audit_logs`.

These tables are exposed to the anon/authenticated database roles unless RLS is enabled. The migration must be followed by explicit policies. Planned policy rules are: public read-only access for event relationships, ticket types, and catalog role/permission metadata; owner-only access for reservations, order items, and payments; server-only or admin-only access for role assignment, permission mapping, and audit logs; and organizer/staff-scoped policies for event and ticket management. Do not enable RLS without policies.

Source: Supabase MCP table inspection for project `blalvoelllndmbppbkcy`, 2026-08-19.
