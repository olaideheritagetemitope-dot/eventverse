begin;

create type public.venue_application_status as enum ('PENDING','APPROVED','REJECTED');
create type public.venue_availability_status as enum ('AVAILABLE','BOOKED','PENDING','BLOCKED');
create type public.venue_booking_status as enum ('PENDING','CONFIRMED','REJECTED','CANCELLED','COMPLETED');

create table if not exists public.venue_manager_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  reason text not null,
  status public.venue_application_status not null default 'PENDING',
  rejection_reason text,
  activated_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venues add column if not exists description text;
alter table public.venues add column if not exists venue_type text;
alter table public.venues add column if not exists amenities jsonb not null default '[]'::jsonb;
alter table public.venues add column if not exists rules text;
alter table public.venues add column if not exists contact_phone text;
alter table public.venues add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.venues add column if not exists pricing jsonb not null default '{}'::jsonb;
alter table public.venues add column if not exists cancellation_policy text;

create table if not exists public.venue_availability (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.venue_availability_status not null default 'AVAILABLE',
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (venue_id, starts_at, ends_at)
);

create table if not exists public.venue_bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete restrict,
  organizer_id uuid not null references auth.users(id) on delete restrict,
  event_id uuid references public.events(id) on delete set null,
  event_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  expected_attendance integer not null check (expected_attendance > 0),
  additional_requirements text,
  status public.venue_booking_status not null default 'PENDING',
  rejection_reason text,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists venue_bookings_active_time_unique on public.venue_bookings (venue_id, starts_at, ends_at) where status in ('PENDING','CONFIRMED');
create index if not exists venue_bookings_venue_status_idx on public.venue_bookings (venue_id, status, starts_at);
create index if not exists venue_availability_venue_time_idx on public.venue_availability (venue_id, starts_at, ends_at);

alter table public.venue_manager_applications enable row level security;
alter table public.venue_availability enable row level security;
alter table public.venue_bookings enable row level security;

drop policy if exists "venue applications own read" on public.venue_manager_applications;
create policy "venue applications own read" on public.venue_manager_applications for select using (user_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
drop policy if exists "venue applications own insert" on public.venue_manager_applications;
create policy "venue applications own insert" on public.venue_manager_applications for insert with check (user_id = auth.uid());
drop policy if exists "venue owners availability" on public.venue_availability;
create policy "venue owners availability" on public.venue_availability for all using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
drop policy if exists "venue bookings parties read" on public.venue_bookings;
create policy "venue bookings parties read" on public.venue_bookings for select using (organizer_id = auth.uid() or exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
drop policy if exists "venue organizer booking insert" on public.venue_bookings;
create policy "venue organizer booking insert" on public.venue_bookings for insert with check (organizer_id = auth.uid() and public.has_any_app_role(array['ORGANIZER'::public.app_role,'ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
drop policy if exists "venue owners booking update" on public.venue_bookings;
create policy "venue owners booking update" on public.venue_bookings for update using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()) or organizer_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()) or organizer_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));

create or replace function public.apply_as_venue_manager(p_display_name text, p_reason text)
returns public.venue_manager_applications language plpgsql security definer set search_path = public as $$
declare v public.venue_manager_applications;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_display_name),'') is null or nullif(trim(p_reason),'') is null then raise exception 'Display name and reason are required'; end if;
  insert into public.venue_manager_applications(user_id,display_name,reason)
  values(auth.uid(),trim(p_display_name),trim(p_reason))
  on conflict (user_id) do update set display_name=excluded.display_name, reason=excluded.reason, status='PENDING', rejection_reason=null, updated_at=now()
  returning * into v;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'venue_manager.application_submitted','venue_manager_application',v.id,jsonb_build_object('status',v.status));
  return v;
end; $$;
revoke all on function public.apply_as_venue_manager(text,text) from public;
grant execute on function public.apply_as_venue_manager(text,text) to authenticated;

create or replace function public.create_owned_venue(p_name text,p_city text,p_address text,p_capacity integer,p_description text,p_venue_type text,p_amenities jsonb,p_rules text,p_contact_phone text,p_image_urls jsonb,p_pricing jsonb,p_cancellation_policy text)
returns public.venues language plpgsql security definer set search_path = public as $$
declare v public.venues;
begin
  if auth.uid() is null or not public.has_any_app_role(array['VENUE_MANAGER'::public.app_role,'ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then raise exception 'Venue Manager role required'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_city),'') is null or coalesce(p_capacity,0) <= 0 then raise exception 'Venue name, city, and positive capacity are required'; end if;
  insert into public.venues(owner_id,name,city,address,capacity,description,venue_type,amenities,rules,contact_phone,image_urls,pricing,cancellation_policy)
  values(auth.uid(),trim(p_name),trim(p_city),nullif(trim(p_address),''),p_capacity,nullif(trim(p_description),''),nullif(trim(p_venue_type),''),coalesce(p_amenities,'[]'::jsonb),nullif(trim(p_rules),''),nullif(trim(p_contact_phone),''),coalesce(p_image_urls,'[]'::jsonb),coalesce(p_pricing,'{}'::jsonb),nullif(trim(p_cancellation_policy),'')) returning * into v;
  return v;
end; $$;
revoke all on function public.create_owned_venue(text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text) from public;
grant execute on function public.create_owned_venue(text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text) to authenticated;

create or replace function public.request_venue_booking(p_venue_id uuid,p_event_id uuid,p_event_name text,p_starts_at timestamptz,p_ends_at timestamptz,p_expected_attendance integer,p_additional_requirements text)
returns public.venue_bookings language plpgsql security definer set search_path = public as $$
declare v public.venue_bookings; v_capacity integer;
begin
  if auth.uid() is null or not public.has_any_app_role(array['ORGANIZER'::public.app_role,'ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then raise exception 'Organizer role required'; end if;
  select capacity into v_capacity from public.venues where id=p_venue_id;
  if v_capacity is null then raise exception 'Venue not found'; end if;
  if p_ends_at <= p_starts_at or p_starts_at <= now() then raise exception 'Booking times are invalid'; end if;
  if p_expected_attendance > v_capacity then raise exception 'Expected attendance exceeds venue capacity'; end if;
  if exists(select 1 from public.venue_bookings where venue_id=p_venue_id and status in ('PENDING','CONFIRMED') and tstzrange(starts_at,ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'Venue has a conflicting pending or confirmed booking'; end if;
  insert into public.venue_bookings(venue_id,organizer_id,event_id,event_name,starts_at,ends_at,expected_attendance,additional_requirements) values(p_venue_id,auth.uid(),p_event_id,trim(p_event_name),p_starts_at,p_ends_at,p_expected_attendance,nullif(trim(p_additional_requirements),'')) returning * into v;
  return v;
end; $$;
revoke all on function public.request_venue_booking(uuid,uuid,text,timestamptz,timestamptz,integer,text) from public;
grant execute on function public.request_venue_booking(uuid,uuid,text,timestamptz,timestamptz,integer,text) to authenticated;

create or replace function public.respond_venue_booking(p_booking_id uuid,p_status public.venue_booking_status,p_reason text default null)
returns public.venue_bookings language plpgsql security definer set search_path = public as $$
declare v public.venue_bookings;
begin
  select * into v from public.venue_bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if not (exists(select 1 from public.venues venue where venue.id=v.venue_id and venue.owner_id=auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) then raise exception 'Not authorized for this venue'; end if;
  if v.status <> 'PENDING' or p_status not in ('CONFIRMED','REJECTED') then raise exception 'Invalid booking transition'; end if;
  if p_status='CONFIRMED' and exists(select 1 from public.venue_bookings other where other.id<>v.id and other.venue_id=v.venue_id and other.status='CONFIRMED' and tstzrange(other.starts_at,other.ends_at,'[)') && tstzrange(v.starts_at,v.ends_at,'[)')) then raise exception 'Venue conflict detected'; end if;
  update public.venue_bookings set status=p_status,rejection_reason=case when p_status='REJECTED' then nullif(trim(p_reason),'') else null end,responded_at=now(),updated_at=now() where id=p_booking_id returning * into v;
  return v;
end; $$;
revoke all on function public.respond_venue_booking(uuid,public.venue_booking_status,text) from public;
grant execute on function public.respond_venue_booking(uuid,public.venue_booking_status,text) to authenticated;

commit;
