-- Atizzy artist registration and verification workflow
create table if not exists public.platform_settings (
  key text primary key,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_fee_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  artist_id uuid references public.artists(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('REGISTRATION','VERIFICATION')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  provider text not null default 'paystack',
  provider_reference text unique,
  idempotency_key text unique not null,
  status text not null default 'INITIALIZED' check (status in ('INITIALIZED','PROVIDER_PENDING','VERIFIED_SUCCESS','FAILED','EXPIRED','CANCELLED')),
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  transaction_id uuid references public.artist_fee_transactions(id) on delete set null,
  artist_id uuid unique references public.artists(id) on delete set null,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','PENDING_PAYMENT','ACTIVATING','ACTIVE','FAILED','CANCELLED')),
  failure_reason text,
  submitted_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_verifications (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null unique references public.artists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  transaction_id uuid references public.artist_fee_transactions(id) on delete set null,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','PENDING_PAYMENT','ACTIVATING','VERIFIED','FAILED','CANCELLED')),
  failure_reason text,
  requested_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, amount, currency, description)
values
  ('artist_registration_fee', 0, 'NGN', 'Fee to activate an artist profile'),
  ('artist_verification_fee', 0, 'NGN', 'Fee to verify an artist profile')
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;
alter table public.artist_fee_transactions enable row level security;
alter table public.artist_registrations enable row level security;
alter table public.artist_verifications enable row level security;

create policy "public can view artist fees" on public.platform_settings for select using (key in ('artist_registration_fee','artist_verification_fee'));
create policy "super admins manage artist fees" on public.platform_settings for all using (public.has_any_app_role(array['SUPER_ADMIN'::public.app_role])) with check (public.has_any_app_role(array['SUPER_ADMIN'::public.app_role]));
create policy "users view own artist fee transactions" on public.artist_fee_transactions for select using (auth.uid() = user_id or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "users view own artist registration" on public.artist_registrations for select using (auth.uid() = user_id or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "users view own artist verification" on public.artist_verifications for select using (auth.uid() = user_id or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));

create index if not exists artist_fee_transactions_user_idx on public.artist_fee_transactions(user_id, transaction_type, status, created_at desc);
create index if not exists artist_fee_transactions_reference_idx on public.artist_fee_transactions(provider_reference);
create index if not exists artist_registrations_status_idx on public.artist_registrations(status);
create index if not exists artist_verifications_status_idx on public.artist_verifications(status);

create or replace function public.initialize_artist_fee_payment(p_transaction_type text, p_idempotency_key text)
returns public.artist_fee_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_setting public.platform_settings;
  v_artist public.artists;
  v_existing public.artist_fee_transactions;
  v_transaction public.artist_fee_transactions;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_transaction_type not in ('REGISTRATION','VERIFICATION') then raise exception 'Invalid artist transaction type'; end if;
  if coalesce(trim(p_idempotency_key), '') = '' then raise exception 'Idempotency key is required'; end if;

  select * into v_existing from public.artist_fee_transactions where idempotency_key = p_idempotency_key limit 1;
  if v_existing.id is not null then return v_existing; end if;

  select * into v_setting from public.platform_settings where key = case when p_transaction_type = 'REGISTRATION' then 'artist_registration_fee' else 'artist_verification_fee' end for share;
  if v_setting.key is null then raise exception 'Artist fee is not configured'; end if;

  if p_transaction_type = 'REGISTRATION' then
    if exists (select 1 from public.artists where user_id = v_user) then raise exception 'Artist profile already exists'; end if;
    if exists (select 1 from public.artist_registrations where user_id = v_user and status in ('PENDING_PAYMENT','ACTIVATING','ACTIVE')) then raise exception 'Artist registration already exists'; end if;
  else
    select * into v_artist from public.artists where user_id = v_user limit 1;
    if v_artist.id is null then raise exception 'Artist profile is required before verification'; end if;
    if v_artist.verified then raise exception 'Artist is already verified'; end if;
    if exists (select 1 from public.artist_verifications where artist_id = v_artist.id and status in ('PENDING_PAYMENT','ACTIVATING','VERIFIED')) then raise exception 'Artist verification already exists'; end if;
  end if;

  insert into public.artist_fee_transactions(user_id, artist_id, transaction_type, amount, currency, idempotency_key, status)
  values (v_user, case when p_transaction_type = 'VERIFICATION' then v_artist.id else null end, p_transaction_type, v_setting.amount, v_setting.currency, p_idempotency_key, 'PROVIDER_PENDING')
  returning * into v_transaction;

  if p_transaction_type = 'REGISTRATION' then
    insert into public.artist_registrations(user_id, transaction_id, status, submitted_at)
    values (v_user, v_transaction.id, 'PENDING_PAYMENT', now())
    on conflict (user_id) do update set transaction_id = excluded.transaction_id, status = 'PENDING_PAYMENT', failure_reason = null, updated_at = now();
  else
    insert into public.artist_verifications(artist_id, user_id, transaction_id, status, requested_at)
    values (v_artist.id, v_user, v_transaction.id, 'PENDING_PAYMENT', now())
    on conflict (artist_id) do update set transaction_id = excluded.transaction_id, status = 'PENDING_PAYMENT', failure_reason = null, updated_at = now();
  end if;
  return v_transaction;
end;
$$;

create or replace function public.activate_artist_fee_transaction(p_transaction_id uuid, p_provider_reference text)
returns public.artist_fee_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.artist_fee_transactions;
  v_artist public.artists;
  v_role_id bigint;
begin
  select * into v_tx from public.artist_fee_transactions where id = p_transaction_id for update;
  if v_tx.id is null then raise exception 'Artist transaction not found'; end if;
  if v_tx.status = 'VERIFIED_SUCCESS' then return v_tx; end if;
  if coalesce(trim(p_provider_reference), '') = '' then raise exception 'Provider reference is required'; end if;

  update public.artist_fee_transactions set status = 'VERIFIED_SUCCESS', provider_reference = p_provider_reference, verified_at = coalesce(verified_at, now()), updated_at = now() where id = v_tx.id returning * into v_tx;

  if v_tx.transaction_type = 'REGISTRATION' then
    select * into v_artist from public.artists where user_id = v_tx.user_id limit 1;
    if v_artist.id is null then
      insert into public.artists(user_id, name, bio, verified) values (v_tx.user_id, coalesce((select full_name from public.user_profiles where id = v_tx.user_id), 'New Artist'), null, false) returning * into v_artist;
    end if;
    select id into v_role_id from public.roles where code = 'ARTIST' limit 1;
    insert into public.user_roles(user_id, role_id) values (v_tx.user_id, v_role_id) on conflict do nothing;
    update public.artist_registrations set artist_id = v_artist.id, status = 'ACTIVE', activated_at = coalesce(activated_at, now()), updated_at = now() where transaction_id = v_tx.id;
  else
    update public.artists set verified = true, updated_at = now() where id = v_tx.artist_id;
    update public.artist_verifications set status = 'VERIFIED', verified_at = coalesce(verified_at, now()), updated_at = now() where transaction_id = v_tx.id;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (v_tx.user_id, case when v_tx.transaction_type = 'REGISTRATION' then 'artist_registration_activated' else 'artist_verified' end, 'artist_fee_transaction', v_tx.id, jsonb_build_object('amount', v_tx.amount, 'currency', v_tx.currency, 'provider_reference', p_provider_reference));
  return v_tx;
end;
$$;

revoke all on function public.initialize_artist_fee_payment(text,text) from public;
grant execute on function public.initialize_artist_fee_payment(text,text) to authenticated;
revoke all on function public.activate_artist_fee_transaction(uuid,text) from public;
grant execute on function public.activate_artist_fee_transaction(uuid,text) to service_role;

drop policy if exists "artists view own bookings" on public.artist_booking_requests;
create policy "artists view own bookings" on public.artist_booking_requests for select using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()) or auth.uid() = requester_id or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
drop policy if exists "artists update own bookings" on public.artist_booking_requests;
create policy "artists update own bookings" on public.artist_booking_requests for update using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
