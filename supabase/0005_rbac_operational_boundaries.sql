-- Atizzy RBAC and operational access boundaries
create or replace function public.has_app_role(required_role public.app_role)
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

create or replace function public.has_any_app_role(required_roles public.app_role[])
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
    where ur.user_id = auth.uid() and r.code = any(required_roles)
  );
$$;

alter table public.user_roles enable row level security;
alter table public.roles enable row level security;
alter table public.ticket_types enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "users view own role assignments" on public.user_roles;
drop policy if exists "authenticated users view role definitions" on public.roles;
drop policy if exists "public can view ticket types for published events" on public.ticket_types;
drop policy if exists "organizers manage own ticket types" on public.ticket_types;
drop policy if exists "users view own payments" on public.payments;
drop policy if exists "authorized users view operational payments" on public.payments;
drop policy if exists "authorized users view audit logs" on public.audit_logs;
drop policy if exists "organizers manage own events" on public.events;
drop policy if exists "artists manage own profile" on public.artists;
drop policy if exists "artists manage own songs" on public.songs;
drop policy if exists "venue managers manage own venues" on public.venues;
drop policy if exists "organizers view own orders" on public.orders;

create policy "users view own role assignments" on public.user_roles for select using (auth.uid() = user_id or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "authenticated users view role definitions" on public.roles for select using (auth.uid() is not null);
create policy "public can view ticket types for published events" on public.ticket_types for select using (exists (select 1 from public.events e where e.id = event_id and e.status in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED')));
create policy "organizers manage own ticket types" on public.ticket_types for all using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) with check (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));
create policy "users view own payments" on public.payments for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "authorized users view operational payments" on public.payments for select using (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role,'ORGANIZER'::public.app_role]));
create policy "authorized users view audit logs" on public.audit_logs for select using (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "organizers manage own events" on public.events for all using (organizer_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (organizer_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "artists manage own profile" on public.artists for update using (user_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (user_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "artists manage own songs" on public.songs for all using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "venue managers manage own venues" on public.venues for all using (owner_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (owner_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "organizers view own orders" on public.orders for select using (user_id = auth.uid() or exists (select 1 from public.events e join public.ticket_types tt on tt.event_id = e.id join public.order_items oi on oi.ticket_type_id = tt.id where oi.order_id = orders.id and e.organizer_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
