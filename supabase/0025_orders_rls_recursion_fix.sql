-- Atizzy orders RLS recursion fix
--
-- The previous orders and related-table policies queried each other through
-- RLS-protected tables. These SECURITY DEFINER helpers evaluate ownership and
-- event ownership once with the postgres owner, avoiding recursive policy
-- evaluation while preserving the existing authorization boundaries.

create or replace function public.order_is_owned_by_current_user(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and o.user_id = auth.uid()
  );
$$;

create or replace function public.order_is_visible_to_current_user(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.order_is_owned_by_current_user(target_order_id)
    or public.has_any_app_role(array['ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role])
    or exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      join public.ticket_types tt on tt.id = oi.ticket_type_id
      join public.events e on e.id = tt.event_id
      where o.id = target_order_id
        and e.organizer_id = auth.uid()
    );
$$;

revoke all on function public.order_is_owned_by_current_user(uuid) from public;
revoke all on function public.order_is_visible_to_current_user(uuid) from public;
grant execute on function public.order_is_owned_by_current_user(uuid) to authenticated;
grant execute on function public.order_is_visible_to_current_user(uuid) to authenticated;

drop policy if exists "users view own orders" on public.orders;
drop policy if exists "organizers view own orders" on public.orders;
drop policy if exists "organizers view owned event orders" on public.orders;

create policy "users view own orders"
on public.orders
for select
to authenticated
using (public.order_is_owned_by_current_user(id));

create policy "organizers view own orders"
on public.orders
for select
to authenticated
using (public.order_is_visible_to_current_user(id));

create policy "organizers view owned event orders"
on public.orders
for select
to authenticated
using (public.order_is_visible_to_current_user(id));

drop policy if exists "users view own payments" on public.payments;
create policy "users view own payments"
on public.payments
for select
to authenticated
using (public.order_is_owned_by_current_user(order_id));

drop policy if exists "users manage own order items" on public.order_items;
drop policy if exists "users view own order items" on public.order_items;

create policy "users manage own order items"
on public.order_items
for all
to authenticated
using (public.order_is_owned_by_current_user(order_id) or public.is_admin())
with check (public.order_is_owned_by_current_user(order_id) or public.is_admin());

create policy "users view own order items"
on public.order_items
for select
to authenticated
using (public.order_is_owned_by_current_user(order_id));
