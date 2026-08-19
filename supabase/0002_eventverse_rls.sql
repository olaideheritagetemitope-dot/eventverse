create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = required_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('ADMIN') or public.has_role('SUPER_ADMIN');
$$;

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.event_categories enable row level security;
alter table public.event_artists enable row level security;
alter table public.ticket_types enable row level security;
alter table public.ticket_reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

 drop policy if exists "roles public read" on public.roles;
create policy "roles public read" on public.roles for select using (true);
 drop policy if exists "permissions public read" on public.permissions;
create policy "permissions public read" on public.permissions for select using (true);
 drop policy if exists "role permissions public read" on public.role_permissions;
create policy "role permissions public read" on public.role_permissions for select using (true);

 drop policy if exists "users read own role assignments" on public.user_roles;
create policy "users read own role assignments" on public.user_roles for select using (auth.uid() = user_id or public.is_admin());
 drop policy if exists "admins manage role assignments" on public.user_roles;
create policy "admins manage role assignments" on public.user_roles for all using (public.is_admin()) with check (public.is_admin());
 drop policy if exists "admins manage role permissions" on public.role_permissions;
create policy "admins manage role permissions" on public.role_permissions for all using (public.is_admin()) with check (public.is_admin());

 drop policy if exists "published event categories read" on public.event_categories;
create policy "published event categories read" on public.event_categories for select using (exists (select 1 from public.events e where e.id = event_id and e.status in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED')));
 drop policy if exists "event owners manage categories" on public.event_categories;
create policy "event owners manage categories" on public.event_categories for all using (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) with check (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));
 drop policy if exists "published event artists read" on public.event_artists;
create policy "published event artists read" on public.event_artists for select using (exists (select 1 from public.events e where e.id = event_id and e.status in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED')));
 drop policy if exists "event owners manage artists" on public.event_artists;
create policy "event owners manage artists" on public.event_artists for all using (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) with check (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

 drop policy if exists "published ticket types read" on public.ticket_types;
create policy "published ticket types read" on public.ticket_types for select using (exists (select 1 from public.events e where e.id = event_id and e.status in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED')));
 drop policy if exists "event owners manage ticket types" on public.ticket_types;
create policy "event owners manage ticket types" on public.ticket_types for all using (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) with check (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

 drop policy if exists "users manage own reservations" on public.ticket_reservations;
create policy "users manage own reservations" on public.ticket_reservations for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
 drop policy if exists "users manage own reservation items" on public.reservation_items;
create policy "users manage own reservation items" on public.reservation_items for all using (exists (select 1 from public.ticket_reservations r where r.id = reservation_id and (r.user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.ticket_reservations r where r.id = reservation_id and (r.user_id = auth.uid() or public.is_admin())));
 drop policy if exists "users manage own order items" on public.order_items;
create policy "users manage own order items" on public.order_items for all using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
 drop policy if exists "users view own payments" on public.payments;
create policy "users view own payments" on public.payments for select using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
 drop policy if exists "admins manage payments" on public.payments;
create policy "admins manage payments" on public.payments for update using (public.is_admin()) with check (public.is_admin());
 drop policy if exists "admins view audit logs" on public.audit_logs;
create policy "admins view audit logs" on public.audit_logs for select using (public.is_admin());

 drop policy if exists "organizers view owned event orders" on public.orders;
create policy "organizers view owned event orders" on public.orders for select using (auth.uid() = user_id or public.is_admin() or exists (select 1 from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id join public.events e on e.id = tt.event_id where oi.order_id = orders.id and e.organizer_id = auth.uid()));
 drop policy if exists "organizers view owned event tickets" on public.tickets;
create policy "organizers view owned event tickets" on public.tickets for select using (auth.uid() = owner_id or public.is_admin() or exists (select 1 from public.ticket_types tt join public.events e on e.id = tt.event_id where tt.id = tickets.ticket_type_id and e.organizer_id = auth.uid()));
