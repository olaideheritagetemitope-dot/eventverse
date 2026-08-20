# Atizzy Orders RLS Investigation

## Live project

- Supabase project: EventVerse
- Project ref: `blalvoelllndmbppbkcy`
- Region: `eu-west-1`
- Status at inspection: `ACTIVE_HEALTHY`
- Database: PostgreSQL 17.6.1.155

## Initial verified schema findings

The live `public` schema has RLS enabled on `orders`, `payments`, `tickets`, `user_roles`, `roles`, and related operational tables. `orders` is related to `order_items`, `payments`, and ticket fulfillment through foreign keys. `user_roles` references `roles`, and role/permission tables are also RLS-enabled.

The repository’s `0005_rbac_operational_boundaries.sql` contains the following relevant policies:

- `users view own payments` on `public.payments`: checks `exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())`.
- `authorized users view operational payments` on `public.payments`: checks `public.has_any_app_role(...)`.
- `organizers view own orders` on `public.orders`: checks ownership, an event/ticket/order-items ownership join, or `public.has_any_app_role(...)`.

These cross-table policy references are a likely contributor to the reported orders recursion and must be verified against the live policy/function definitions before migration.

## Confirmed recursion chain

The live policy catalog confirms that `public.orders` has three SELECT policies. Two policies directly join `orders` to `order_items`, `ticket_types`, and `events`, while related `public.order_items` policies query `public.orders` to determine ownership. The live `public.payments` ownership policy also queries `public.orders`. This creates the indirect cycle reported by the directive: orders policy evaluation can reach order-items policy evaluation, which reaches orders again.

The live helpers `has_role`, `has_app_role`, `has_any_app_role`, and `is_admin` are all owned by `postgres`, marked `SECURITY DEFINER`, and use `search_path = public`. The repair therefore adds two similarly constrained helpers: `order_is_owned_by_current_user(uuid)` and `order_is_visible_to_current_user(uuid)`. Orders, payments, and order-items policies call those helpers instead of directly selecting from RLS-protected orders. Order-item mutation remains limited to the current order owner or admin; organizer visibility remains read-only and event-scoped; no RLS table is disabled and no payment or ticket schema is changed.
