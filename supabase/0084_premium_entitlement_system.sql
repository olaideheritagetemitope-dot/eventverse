-- Atizzy Premium entitlement system.
-- Premium is a subscription/entitlement layer, never an application role.

create table if not exists public.premium_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NGN' check (currency in ('NGN','USD','GBP','EUR')),
  interval text not null default 'MONTH' check (interval in ('MONTH','YEAR')),
  interval_count integer not null default 1 check (interval_count > 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.premium_plans(id),
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','CANCELLED','EXPIRED','PAST_DUE','FAILED')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists premium_one_live_subscription_idx
  on public.premium_subscriptions(user_id)
  where status in ('PENDING','ACTIVE','PAST_DUE');
create index if not exists premium_subscriptions_user_status_idx
  on public.premium_subscriptions(user_id,status,updated_at desc);

create table if not exists public.premium_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.premium_subscriptions(id) on delete set null,
  plan_id uuid not null references public.premium_plans(id),
  provider text not null default 'paystack',
  transaction_reference text not null unique,
  idempotency_key text not null unique,
  provider_reference text unique,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  status text not null default 'PENDING' check (status in ('PENDING','INITIALIZED','SUCCESS','FAILED','CANCELLED')),
  checkout_url text,
  access_code text,
  failure_reason text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists premium_payments_user_created_idx
  on public.premium_payments(user_id,created_at desc);

create table if not exists public.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.premium_subscriptions(id) on delete cascade,
  plan_id uuid not null references public.premium_plans(id),
  status text not null check (status in ('ACTIVE','EXPIRED','REVOKED')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists premium_entitlements_active_idx
  on public.premium_entitlements(status,ends_at);

alter table public.ticket_types add column if not exists premium_early_access_starts_at timestamptz;
alter table public.ticket_types add column if not exists public_release_at timestamptz;
alter table public.ticket_types add column if not exists premium_only boolean not null default false;
create index if not exists ticket_types_premium_release_idx
  on public.ticket_types(event_id,premium_only,premium_early_access_starts_at,public_release_at);

alter table public.premium_plans enable row level security;
alter table public.premium_subscriptions enable row level security;
alter table public.premium_payments enable row level security;
alter table public.premium_entitlements enable row level security;

drop policy if exists "premium active plans public read" on public.premium_plans;
create policy "premium active plans public read" on public.premium_plans for select using (is_active or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
drop policy if exists "premium subscriptions owner read" on public.premium_subscriptions;
create policy "premium subscriptions owner read" on public.premium_subscriptions for select using (user_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
drop policy if exists "premium payments owner read" on public.premium_payments;
create policy "premium payments owner read" on public.premium_payments for select using (user_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
drop policy if exists "premium entitlements owner read" on public.premium_entitlements;
create policy "premium entitlements owner read" on public.premium_entitlements for select using (user_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));

create or replace function public.has_premium_access(p_user_id uuid default auth.uid())
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if p_user_id is null then return false; end if;
  update public.premium_entitlements
  set status = 'EXPIRED', updated_at = now()
  where user_id = p_user_id and status = 'ACTIVE' and ends_at <= now();
  return exists (
    select 1 from public.premium_entitlements e
    where e.user_id = p_user_id and e.status = 'ACTIVE' and e.starts_at <= now() and e.ends_at > now()
  );
end; $$;

create or replace function public.premium_feature_enabled(p_feature text, p_user_id uuid default auth.uid())
returns boolean language sql volatile security definer set search_path = public as $$
  select public.has_premium_access(p_user_id)
    and coalesce((select (p.features -> p_feature)::boolean from public.premium_entitlements e join public.premium_plans p on p.id=e.plan_id where e.user_id=p_user_id and e.status='ACTIVE' and e.ends_at > now()), true);
$$;

create or replace function public.get_premium_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_subscription jsonb; v_plans jsonb; v_entitlement jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  perform public.has_premium_access(v_user);
  select to_jsonb(s) into v_subscription from public.premium_subscriptions s where s.user_id=v_user order by s.updated_at desc limit 1;
  select to_jsonb(e) into v_entitlement from public.premium_entitlements e where e.user_id=v_user;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.amount), '[]'::jsonb) into v_plans from public.premium_plans p where p.is_active=true;
  return jsonb_build_object('plans',v_plans,'subscription',coalesce(v_subscription,'null'::jsonb),'entitlement',coalesce(v_entitlement,'null'::jsonb),'hasPremium',public.has_premium_access(v_user));
end; $$;

create or replace function public.initialize_premium_payment(p_plan_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_plan public.premium_plans; v_payment public.premium_payments; v_reference text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'Idempotency key is required'; end if;
  select * into v_plan from public.premium_plans where id=p_plan_id and is_active=true;
  if not found then raise exception 'Premium plan is unavailable'; end if;
  select * into v_payment from public.premium_payments where user_id=v_user and idempotency_key=p_idempotency_key limit 1;
  if found then return jsonb_build_object('payment',to_jsonb(v_payment),'plan',to_jsonb(v_plan),'reused',true); end if;
  v_reference := 'ATZPREM-' || upper(encode(gen_random_bytes(16),'hex'));
  insert into public.premium_payments(user_id,plan_id,transaction_reference,idempotency_key,amount,currency,status)
  values(v_user,p_plan_id,v_reference,p_idempotency_key,v_plan.amount,v_plan.currency,'PENDING') returning * into v_payment;
  return jsonb_build_object('payment',to_jsonb(v_payment),'plan',to_jsonb(v_plan),'reused',false);
end; $$;

create or replace function public.attach_premium_checkout(p_payment_id uuid,p_provider_reference text,p_checkout_url text,p_access_code text)
returns public.premium_payments language plpgsql security definer set search_path = public as $$
declare v_payment public.premium_payments;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.premium_payments p set provider_reference=coalesce(p.provider_reference,p_provider_reference),checkout_url=p_checkout_url,access_code=p_access_code,status='INITIALIZED',updated_at=now()
  where p.id=p_payment_id and p.user_id=auth.uid() and p.status in ('PENDING','INITIALIZED') returning p.* into v_payment;
  if not found then raise exception 'Premium payment access denied or already completed'; end if;
  return v_payment;
end; $$;

create or replace function public.activate_premium_payment(p_payment_id uuid,p_provider_reference text,p_paid_amount numeric,p_paid_currency text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payment public.premium_payments; v_plan public.premium_plans; v_subscription public.premium_subscriptions; v_start timestamptz:=now(); v_end timestamptz;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Only the payment service can activate Premium'; end if;
  select * into v_payment from public.premium_payments where id=p_payment_id for update;
  if not found then raise exception 'Premium payment not found'; end if;
  if v_payment.status='SUCCESS' then return jsonb_build_object('payment',to_jsonb(v_payment),'alreadyActivated',true); end if;
  select * into v_plan from public.premium_plans where id=v_payment.plan_id;
  if p_provider_reference is null or p_paid_amount <> v_payment.amount or upper(p_paid_currency) <> upper(v_payment.currency) then raise exception 'Premium payment verification mismatch'; end if;
  if v_plan.interval='YEAR' then v_end:=v_start + make_interval(months=>12*v_plan.interval_count); else v_end:=v_start + make_interval(months=>v_plan.interval_count); end if;
  update public.premium_payments set provider_reference=coalesce(provider_reference,p_provider_reference),status='SUCCESS',verified_at=now(),updated_at=now() where id=v_payment.id returning * into v_payment;
  select * into v_subscription from public.premium_subscriptions where user_id=v_payment.user_id and status in ('PENDING','ACTIVE','PAST_DUE') order by updated_at desc limit 1 for update;
  if found then update public.premium_subscriptions set plan_id=v_plan.id,status='ACTIVE',current_period_start=v_start,current_period_end=v_end,cancel_at_period_end=false,cancelled_at=null,updated_at=now() where id=v_subscription.id returning * into v_subscription;
  else insert into public.premium_subscriptions(user_id,plan_id,status,current_period_start,current_period_end) values(v_payment.user_id,v_plan.id,'ACTIVE',v_start,v_end) returning * into v_subscription; end if;
  update public.premium_payments set subscription_id=v_subscription.id where id=v_payment.id;
  insert into public.premium_entitlements(user_id,subscription_id,plan_id,status,starts_at,ends_at,updated_at) values(v_payment.user_id,v_subscription.id,v_plan.id,'ACTIVE',v_start,v_end,now()) on conflict(user_id) do update set subscription_id=excluded.subscription_id,plan_id=excluded.plan_id,status='ACTIVE',starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now();
  insert into public.user_notifications(user_id,type,title,message,metadata) values(v_payment.user_id,'PREMIUM_ACTIVATED','Premium is active','Your Premium access is now active.',jsonb_build_object('subscription_id',v_subscription.id,'ends_at',v_end));
  return jsonb_build_object('payment',to_jsonb(v_payment),'subscription',to_jsonb(v_subscription),'entitlement',to_jsonb((select e from public.premium_entitlements e where e.user_id=v_payment.user_id)),'alreadyActivated',false);
end; $$;

create or replace function public.cancel_premium_subscription(p_at_period_end boolean default true)
returns public.premium_subscriptions language plpgsql security definer set search_path = public as $$
declare v_subscription public.premium_subscriptions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_subscription from public.premium_subscriptions where user_id=auth.uid() and status in ('ACTIVE','PAST_DUE') order by updated_at desc limit 1 for update;
  if found then update public.premium_subscriptions set cancel_at_period_end=p_at_period_end,cancelled_at=case when p_at_period_end then null else now() end,status=case when p_at_period_end then status else 'CANCELLED' end,updated_at=now() where id=v_subscription.id returning * into v_subscription; end if;
  if not found then raise exception 'No active Premium subscription'; end if;
  if not p_at_period_end then update public.premium_entitlements set status='REVOKED',updated_at=now() where user_id=auth.uid(); end if;
  return v_subscription;
end; $$;

create or replace function public.set_premium_plan(p_plan_id uuid,p_name text,p_amount numeric,p_currency text,p_interval text,p_features jsonb,p_is_active boolean)
returns public.premium_plans language plpgsql security definer set search_path = public as $$
declare v_plan public.premium_plans;
begin
  if not public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]) then raise exception 'Admin access required'; end if;
  update public.premium_plans set name=trim(p_name),amount=p_amount,currency=upper(p_currency),interval=upper(p_interval),features=coalesce(p_features,'{}'::jsonb),is_active=p_is_active,updated_at=now() where id=p_plan_id returning * into v_plan;
  if not found then raise exception 'Premium plan not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'PREMIUM_PLAN_UPDATED','premium_plans',p_plan_id,jsonb_build_object('amount',p_amount,'currency',p_currency,'interval',p_interval,'is_active',p_is_active));
  return v_plan;
end; $$;

create or replace function public.can_access_ticket_type(p_ticket_type_id uuid,p_user_id uuid default auth.uid())
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_ticket public.ticket_types; v_premium boolean; v_now timestamptz:=now();
begin
  select * into v_ticket from public.ticket_types where id=p_ticket_type_id;
  if not found then return false; end if;
  v_premium:=public.has_premium_access(p_user_id);
  if v_ticket.premium_only and not v_premium then return false; end if;
  if v_ticket.public_release_at is not null and v_now < v_ticket.public_release_at and not v_premium then return false; end if;
  if v_ticket.premium_early_access_starts_at is not null and v_now < v_ticket.premium_early_access_starts_at and not v_premium then return false; end if;
  return true;
end; $$;

grant execute on function public.get_premium_snapshot() to authenticated;
grant execute on function public.initialize_premium_payment(uuid,text) to authenticated;
grant execute on function public.attach_premium_checkout(uuid,text,text,text) to authenticated;
grant execute on function public.cancel_premium_subscription(boolean) to authenticated;
grant execute on function public.has_premium_access(uuid) to authenticated;
grant execute on function public.premium_feature_enabled(text,uuid) to authenticated;
grant execute on function public.can_access_ticket_type(uuid,uuid) to authenticated;
grant execute on function public.activate_premium_payment(uuid,text,numeric,text) to service_role;
grant execute on function public.set_premium_plan(uuid,text,numeric,text,text,jsonb,boolean) to authenticated;

insert into public.premium_plans(code,name,description,amount,currency,interval,interval_count,features,is_active)
select 'PREMIUM_MONTHLY','Premium Monthly','Premium attendee access',5000,'NGN','MONTH',1,jsonb_build_object('advanced_discovery',true,'recommendations',true,'premium_alerts',true,'early_access',true,'advanced_playlists',true,'personal_statistics',true,'follow_radar',true,'advanced_location',true,'ticket_perks',true,'planner',true,'smart_notifications',true,'premium_badge',true),false
where not exists (select 1 from public.premium_plans where code='PREMIUM_MONTHLY');

notify pgrst, 'reload schema';
