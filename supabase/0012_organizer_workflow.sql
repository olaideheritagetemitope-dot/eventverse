-- Atizzy Organizer workflow: onboarding, event lifecycle, publishing validation, and dashboard metrics

create table if not exists public.organizer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('PENDING','ACTIVE','REJECTED','SUSPENDED')),
  display_name text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz
);

alter table public.organizer_applications enable row level security;
drop policy if exists "users view own organizer application" on public.organizer_applications;
create policy "users view own organizer application" on public.organizer_applications for select using (auth.uid() = user_id or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));

drop policy if exists "users create own organizer application" on public.organizer_applications;
create policy "users create own organizer application" on public.organizer_applications for insert with check (auth.uid() = user_id);

drop policy if exists "admins manage organizer applications" on public.organizer_applications;
create policy "admins manage organizer applications" on public.organizer_applications for update using (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));

create or replace function public.apply_as_organizer(p_display_name text, p_reason text default null)
returns public.organizer_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role_id bigint;
  v_application public.organizer_applications;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.organizer_applications(user_id, display_name, reason, status, activated_at, updated_at)
  values (v_user, nullif(trim(p_display_name), ''), nullif(trim(p_reason), ''), 'ACTIVE', now(), now())
  on conflict (user_id) do update set display_name = excluded.display_name, reason = excluded.reason, status = 'ACTIVE', activated_at = coalesce(organizer_applications.activated_at, now()), updated_at = now()
  returning * into v_application;
  select id into v_role_id from public.roles where code = 'ORGANIZER' limit 1;
  if v_role_id is null then raise exception 'Organizer role is not configured'; end if;
  insert into public.user_roles(user_id, role_id) values (v_user, v_role_id) on conflict do nothing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'organizer_application_activated', 'organizer_application', v_application.id, jsonb_build_object('status', v_application.status));
  return v_application;
end;
$$;

create or replace function public.publish_organizer_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_ticket_count integer;
begin
  select * into v_event from public.events where id = p_event_id and organizer_id = auth.uid() for update;
  if v_event.id is null then raise exception 'Event not found or not owned by current Organizer'; end if;
  if v_event.status not in ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED') then raise exception 'Event cannot be published from its current state'; end if;
  if nullif(trim(v_event.title), '') is null or nullif(trim(v_event.description), '') is null or nullif(trim(v_event.city), '') is null or v_event.starts_at is null then raise exception 'Event name, description, city, and start date are required'; end if;
  select count(*) into v_ticket_count from public.ticket_types where event_id = v_event.id and capacity > 0 and price >= 0;
  if v_ticket_count = 0 then raise exception 'At least one ticket type is required before publishing'; end if;
  update public.events set status = 'PUBLISHED', updated_at = now() where id = v_event.id returning * into v_event;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'organizer_event_published', 'event', v_event.id, jsonb_build_object('status', v_event.status));
  return v_event;
end;
$$;

create or replace function public.cancel_organizer_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id and organizer_id = auth.uid() for update;
  if v_event.id is null then raise exception 'Event not found or not owned by current Organizer'; end if;
  if v_event.status in ('COMPLETED','CANCELLED') then raise exception 'Event cannot be cancelled from its current state'; end if;
  update public.events set status = 'CANCELLED', updated_at = now() where id = v_event.id returning * into v_event;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'organizer_event_cancelled', 'event', v_event.id, '{}'::jsonb);
  return v_event;
end;
$$;

create or replace function public.get_organizer_event_dashboard(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_ticket_sold bigint;
  v_ticket_remaining bigint;
  v_revenue numeric;
  v_orders bigint;
  v_attendees bigint;
  v_checkins bigint;
begin
  select * into v_event from public.events where id = p_event_id and organizer_id = auth.uid();
  if v_event.id is null then raise exception 'Event not found or not owned by current Organizer'; end if;
  select coalesce(sum(tt.sold), 0), coalesce(sum(tt.capacity - tt.sold - tt.reserved), 0) into v_ticket_sold, v_ticket_remaining from public.ticket_types tt where tt.event_id = p_event_id;
  select coalesce(sum(o.total), 0), count(*) into v_revenue, v_orders from public.orders o join public.order_items oi on oi.order_id = o.id join public.ticket_types tt on tt.id = oi.ticket_type_id where tt.event_id = p_event_id and o.status in ('PAID','FULFILLED');
  select count(*) into v_attendees from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where tt.event_id = p_event_id and t.status <> 'CANCELLED';
  select count(*) into v_checkins from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where tt.event_id = p_event_id and t.status = 'CHECKED_IN';
  return jsonb_build_object('event', to_jsonb(v_event), 'tickets_sold', v_ticket_sold, 'tickets_remaining', v_ticket_remaining, 'gross_revenue', v_revenue, 'successful_orders', v_orders, 'attendees', v_attendees, 'check_ins', v_checkins);
end;
$$;

revoke all on function public.apply_as_organizer(text,text) from public;
grant execute on function public.apply_as_organizer(text,text) to authenticated;
revoke all on function public.publish_organizer_event(uuid) from public;
grant execute on function public.publish_organizer_event(uuid) to authenticated;
revoke all on function public.cancel_organizer_event(uuid) from public;
grant execute on function public.cancel_organizer_event(uuid) to authenticated;
revoke all on function public.get_organizer_event_dashboard(uuid) from public;
grant execute on function public.get_organizer_event_dashboard(uuid) to authenticated;
