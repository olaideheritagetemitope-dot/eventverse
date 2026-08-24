-- Premium Artist is a promotion product, not Artist-role verification.
-- It requires an active Artist role and owns a separate entitlement lifecycle.
create table if not exists public.artist_premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id uuid not null references public.premium_plans(id),
  payment_id uuid references public.premium_payments(id),
  status text not null check (status in ('ACTIVE','EXPIRED','REVOKED')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists artist_premium_entitlements_active_idx
  on public.artist_premium_entitlements(status, ends_at);
alter table public.artist_premium_entitlements enable row level security;
drop policy if exists "artist premium owner read" on public.artist_premium_entitlements;
create policy "artist premium owner read" on public.artist_premium_entitlements
  for select using (user_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));

create or replace function public.has_artist_premium_access(p_user_id uuid default auth.uid())
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if p_user_id is null then return false; end if;
  update public.artist_premium_entitlements
  set status = 'EXPIRED', updated_at = now()
  where user_id = p_user_id and status = 'ACTIVE' and ends_at <= now();
  return exists (
    select 1 from public.artist_premium_entitlements e
    where e.user_id = p_user_id and e.status = 'ACTIVE'
      and e.starts_at <= now() and e.ends_at > now()
      and exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id and r.code='ARTIST')
  );
end; $$;

-- Preserve the existing attendee Premium contract, while exposing independent Artist state.
create or replace function public.get_premium_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_subscription jsonb;
  v_plans jsonb;
  v_entitlement jsonb;
  v_artist_entitlement jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform public.has_premium_access(v_user);
  perform public.has_artist_premium_access(v_user);
  select to_jsonb(s) into v_subscription from public.premium_subscriptions s where s.user_id=v_user order by s.updated_at desc limit 1;
  select to_jsonb(e) into v_entitlement from public.premium_entitlements e where e.user_id=v_user and e.status='ACTIVE' and e.ends_at > now();
  select to_jsonb(e) into v_artist_entitlement from public.artist_premium_entitlements e where e.user_id=v_user and e.status='ACTIVE' and e.ends_at > now();
  select coalesce(jsonb_agg(to_jsonb(p) order by p.amount), '[]'::jsonb) into v_plans from public.premium_plans p where p.is_active=true;
  return jsonb_build_object(
    'plans',v_plans,
    'subscription',coalesce(v_subscription,'null'::jsonb),
    'entitlement',coalesce(v_entitlement,'null'::jsonb),
    'artistEntitlement',coalesce(v_artist_entitlement,'null'::jsonb),
    'hasPremium',public.has_premium_access(v_user),
    'hasArtistPremium',public.has_artist_premium_access(v_user),
    'isArtist',exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=v_user and r.code='ARTIST')
  );
end; $$;

-- The generic initializer is wrapped so ordinary users cannot start Artist Premium checkout.
alter function public.initialize_premium_payment(uuid,text) rename to initialize_premium_payment_legacy;
create or replace function public.initialize_premium_payment(p_plan_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select upper(code) into v_code from public.premium_plans where id=p_plan_id;
  if v_code = 'ARTIST_PREMIUM' and not exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=v_user and r.code='ARTIST') then
    raise exception 'Artist role required before Premium Artist checkout';
  end if;
  return public.initialize_premium_payment_legacy(p_plan_id, p_idempotency_key);
end; $$;

-- Authorize Artist Premium activation into its own entitlement table; preserve all other plans.
alter function public.activate_premium_payment(uuid,text,numeric,text) rename to activate_premium_payment_legacy;
create or replace function public.activate_premium_payment(p_payment_id uuid,p_provider_reference text,p_paid_amount numeric,p_paid_currency text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_plan public.premium_plans; v_payment public.premium_payments; v_days integer;
  v_end timestamptz;
begin
  select p.* into v_payment from public.premium_payments p where p.id=p_payment_id for update;
  if not found then raise exception 'Premium payment not found'; end if;
  select * into v_plan from public.premium_plans where id=v_payment.plan_id;
  if upper(v_plan.code) <> 'ARTIST_PREMIUM' then
    return public.activate_premium_payment_legacy(p_payment_id,p_provider_reference,p_paid_amount,p_paid_currency);
  end if;
  v_user := v_payment.user_id;
  if not exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=v_user and r.code='ARTIST') then raise exception 'Artist role required'; end if;
  if p_paid_currency is null or upper(p_paid_currency) <> upper(v_plan.currency) then raise exception 'Payment currency mismatch'; end if;
  if p_paid_amount is null or p_paid_amount <> v_plan.amount then raise exception 'Payment amount mismatch'; end if;
  if v_payment.status in ('PAID','COMPLETED') and exists (select 1 from public.artist_premium_entitlements where payment_id=p_payment_id and status='ACTIVE') then
    return jsonb_build_object('ok',true,'replayed',true,'artistPremium',true);
  end if;
  update public.premium_payments set status='PAID', provider_reference=coalesce(provider_reference,p_provider_reference), updated_at=now() where id=p_payment_id;
  v_days := case upper(coalesce(v_plan.interval,'MONTH')) when 'YEAR' then 365 when 'WEEK' then 7 else 30 end;
  v_end := now() + make_interval(days => v_days);
  insert into public.artist_premium_entitlements(user_id,plan_id,payment_id,status,starts_at,ends_at,updated_at)
  values(v_user,v_plan.id,p_payment_id,'ACTIVE',now(),v_end,now())
  on conflict (user_id) do update set plan_id=excluded.plan_id,payment_id=excluded.payment_id,status='ACTIVE',starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now();
  return jsonb_build_object('ok',true,'replayed',false,'artistPremium',true,'endsAt',v_end);
end; $$;

revoke all on function public.has_artist_premium_access(uuid) from public;
grant execute on function public.has_artist_premium_access(uuid) to authenticated;
revoke all on function public.initialize_premium_payment(uuid,text) from public;
grant execute on function public.initialize_premium_payment(uuid,text) to authenticated;
revoke all on function public.activate_premium_payment(uuid,text,numeric,text) from public;
grant execute on function public.activate_premium_payment(uuid,text,numeric,text) to service_role;
