begin;

alter table public.venue_bookings add column if not exists amount numeric(12,2);
alter table public.venue_bookings add column if not exists currency text not null default 'NGN';
alter table public.venue_bookings add column if not exists payment_status text not null default 'NOT_REQUIRED';
alter table public.venue_bookings add column if not exists payment_provider_reference text;

create table if not exists public.venue_booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.venue_bookings(id) on delete cascade,
  payer_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  provider text not null default 'paystack',
  provider_reference text unique,
  status text not null default 'INITIALIZED' check (status in ('INITIALIZED','SUCCESS','FAILED')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venue_booking_payments enable row level security;
drop policy if exists "venue booking payments parties read" on public.venue_booking_payments;
create policy "venue booking payments parties read" on public.venue_booking_payments for select using (
  payer_id = auth.uid() or exists (
    select 1 from public.venue_bookings b join public.venues v on v.id = b.venue_id
    where b.id = booking_id and v.owner_id = auth.uid()
  ) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])
);

create or replace function public.update_owned_venue(
  p_venue_id uuid,p_name text,p_city text,p_address text,p_capacity integer,p_description text,
  p_venue_type text,p_amenities jsonb,p_rules text,p_contact_phone text,p_image_urls jsonb,
  p_pricing jsonb,p_cancellation_policy text
) returns public.venues language plpgsql security definer set search_path = public as $$
declare v public.venues;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.venues where id = p_venue_id and (owner_id = auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]))) then raise exception 'Not authorized for this venue'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_city),'') is null or coalesce(p_capacity,0) <= 0 then raise exception 'Venue name, city, and positive capacity are required'; end if;
  update public.venues set name=trim(p_name),city=trim(p_city),address=nullif(trim(p_address),''),capacity=p_capacity,description=nullif(trim(p_description),''),venue_type=nullif(trim(p_venue_type),''),amenities=coalesce(p_amenities,'[]'::jsonb),rules=nullif(trim(p_rules),''),contact_phone=nullif(trim(p_contact_phone),''),image_urls=coalesce(p_image_urls,'[]'::jsonb),pricing=coalesce(p_pricing,'{}'::jsonb),cancellation_policy=nullif(trim(p_cancellation_policy),''),updated_at=now() where id=p_venue_id returning * into v;
  return v;
end; $$;
revoke all on function public.update_owned_venue(uuid,text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text) from public;
grant execute on function public.update_owned_venue(uuid,text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text) to authenticated;

create or replace function public.set_venue_availability(p_venue_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_status public.venue_availability_status,p_note text default null)
returns public.venue_availability language plpgsql security definer set search_path = public as $$
declare v public.venue_availability;
begin
  if auth.uid() is null or not exists (select 1 from public.venues where id=p_venue_id and (owner_id=auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]))) then raise exception 'Not authorized for this venue'; end if;
  if p_ends_at <= p_starts_at or p_starts_at <= now() then raise exception 'Availability times are invalid'; end if;
  if p_status = 'AVAILABLE' and exists(select 1 from public.venue_bookings b where b.venue_id=p_venue_id and b.status in ('PENDING','CONFIRMED') and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'Availability overlaps a booking'; end if;
  insert into public.venue_availability(venue_id,starts_at,ends_at,status,note,created_by) values(p_venue_id,p_starts_at,p_ends_at,p_status,nullif(trim(p_note),''),auth.uid()) returning * into v;
  return v;
end; $$;
revoke all on function public.set_venue_availability(uuid,timestamptz,timestamptz,public.venue_availability_status,text) from public;
grant execute on function public.set_venue_availability(uuid,timestamptz,timestamptz,public.venue_availability_status,text) to authenticated;

create or replace function public.initialize_venue_booking_payment(p_booking_id uuid,p_idempotency_key text)
returns public.venue_booking_payments language plpgsql security definer set search_path = public as $$
declare b public.venue_bookings; v public.venues; p public.venue_booking_payments; amount numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into b from public.venue_bookings where id=p_booking_id and organizer_id=auth.uid() for update;
  if not found then raise exception 'Booking not found or not owned by Organizer'; end if;
  if b.status <> 'CONFIRMED' then raise exception 'Venue booking must be confirmed before payment'; end if;
  select * into v from public.venues where id=b.venue_id;
  amount := coalesce((v.pricing->>'base')::numeric,(v.pricing->>'amount')::numeric,0);
  if amount <= 0 then raise exception 'Venue payment amount is not configured'; end if;
  insert into public.venue_booking_payments(booking_id,payer_id,amount,idempotency_key) values(b.id,auth.uid(),amount,trim(p_idempotency_key)) on conflict (idempotency_key) do update set updated_at=now() returning * into p;
  update public.venue_bookings set amount=p.amount,payment_status='INITIALIZED',updated_at=now() where id=b.id;
  return p;
end; $$;
revoke all on function public.initialize_venue_booking_payment(uuid,text) from public;
grant execute on function public.initialize_venue_booking_payment(uuid,text) to authenticated;

create or replace function public.verify_venue_booking_payment(p_payment_id uuid,p_provider_reference text)
returns public.venue_booking_payments language plpgsql security definer set search_path = public as $$
declare p public.venue_booking_payments;
begin
  select * into p from public.venue_booking_payments where id=p_payment_id for update;
  if not found then raise exception 'Venue payment not found'; end if;
  if p.status = 'SUCCESS' then return p; end if;
  update public.venue_booking_payments set status='SUCCESS',provider_reference=p_provider_reference,updated_at=now() where id=p_payment_id returning * into p;
  update public.venue_bookings set payment_status='SUCCESS',payment_provider_reference=p_provider_reference,updated_at=now() where id=p.booking_id;
  return p;
end; $$;
revoke all on function public.verify_venue_booking_payment(uuid,text) from public;
grant execute on function public.verify_venue_booking_payment(uuid,text) to service_role;

create or replace function public.get_venue_manager_metrics(p_user_id uuid)
returns jsonb language sql security definer set search_path = public as $$
select jsonb_build_object(
  'venues', (select count(*) from public.venues where owner_id=p_user_id),
  'pending', (select count(*) from public.venue_bookings b join public.venues v on v.id=b.venue_id where v.owner_id=p_user_id and b.status='PENDING'),
  'confirmed', (select count(*) from public.venue_bookings b join public.venues v on v.id=b.venue_id where v.owner_id=p_user_id and b.status='CONFIRMED'),
  'rejected', (select count(*) from public.venue_bookings b join public.venues v on v.id=b.venue_id where v.owner_id=p_user_id and b.status='REJECTED'),
  'history', (select count(*) from public.venue_bookings b join public.venues v on v.id=b.venue_id where v.owner_id=p_user_id and b.status in ('COMPLETED','CANCELLED')),
  'revenue', coalesce((select sum(p.amount) from public.venue_booking_payments p join public.venue_bookings b on b.id=p.booking_id join public.venues v on v.id=b.venue_id where v.owner_id=p_user_id and p.status='SUCCESS'),0)
);
$$;
revoke all on function public.get_venue_manager_metrics(uuid) from public;
grant execute on function public.get_venue_manager_metrics(uuid) to authenticated;

commit;
