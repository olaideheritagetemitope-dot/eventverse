begin;

-- 0104: repair Premium payment initialization on databases where pgcrypto's
-- the prior byte-generator dependency is not exposed to the public function search path.
-- Premium payments use the same authoritative reference registry as every other
-- payment domain. Idempotency remains stable for retries of one attempt, while
-- a new idempotency key receives a new server-minted reference.

alter table public.payment_transaction_references
  drop constraint if exists payment_transaction_references_payment_domain_check;

alter table public.payment_transaction_references
  add constraint payment_transaction_references_payment_domain_check
  check (payment_domain in ('TICKET','ARTIST','ROLE_APPLICATION','VENUE','PREMIUM'));

-- Reconcile any Premium rows created by the earlier implementation into the
-- global registry without changing their existing references or payment state.
insert into public.payment_transaction_references(transaction_reference, payment_domain, payment_id)
select p.transaction_reference, 'PREMIUM', p.id
from public.premium_payments p
where not exists (
  select 1
  from public.payment_transaction_references r
  where r.transaction_reference = p.transaction_reference
);

create or replace function public.mint_payment_transaction_reference(p_domain text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := upper(trim(coalesce(p_domain, '')));
  v_reference text;
  v_attempt integer;
begin
  if v_domain not in ('TICKET','ARTIST','ROLE_APPLICATION','VENUE','PREMIUM') then
    raise exception 'Unsupported payment domain';
  end if;

  for v_attempt in 1..12 loop
    v_reference := 'ATZ-' || v_domain || '-' || upper(replace(gen_random_uuid()::text, '-', ''));
    begin
      insert into public.payment_transaction_references(transaction_reference, payment_domain)
      values (v_reference, v_domain);
      return v_reference;
    exception when unique_violation then
      -- Retry with a fresh UUID if an astronomically unlikely collision occurs.
    end;
  end loop;

  raise exception 'Unable to mint a unique payment transaction reference';
end;
$$;

revoke all on function public.mint_payment_transaction_reference(text) from public, anon, authenticated;
grant execute on function public.mint_payment_transaction_reference(text) to service_role;

create or replace function public.initialize_premium_payment(p_plan_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.premium_plans;
  v_payment public.premium_payments;
  v_reference text;
  v_key text := nullif(trim(p_idempotency_key), '');
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if v_key is null then
    raise exception 'Idempotency key is required';
  end if;

  select * into v_plan
  from public.premium_plans
  where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Premium plan is unavailable';
  end if;

  select * into v_payment
  from public.premium_payments
  where user_id = v_user and idempotency_key = v_key
  limit 1;
  if found then
    return jsonb_build_object('payment', to_jsonb(v_payment), 'plan', to_jsonb(v_plan), 'reused', true);
  end if;

  v_reference := public.mint_payment_transaction_reference('PREMIUM');
  insert into public.premium_payments(
    user_id, plan_id, transaction_reference, idempotency_key,
    amount, currency, status
  )
  values (
    v_user, p_plan_id, v_reference, v_key,
    v_plan.amount, v_plan.currency, 'PENDING'
  )
  returning * into v_payment;

  update public.payment_transaction_references
  set payment_id = v_payment.id
  where transaction_reference = v_reference;

  return jsonb_build_object('payment', to_jsonb(v_payment), 'plan', to_jsonb(v_plan), 'reused', false);
exception when unique_violation then
  -- A concurrent retry with the same idempotency key replays its existing row.
  select * into v_payment
  from public.premium_payments
  where user_id = v_user and idempotency_key = v_key
  limit 1;
  if found then
    select * into v_plan from public.premium_plans where id = p_plan_id limit 1;
    return jsonb_build_object('payment', to_jsonb(v_payment), 'plan', to_jsonb(v_plan), 'reused', true);
  end if;
  raise;
end;
$$;

grant execute on function public.initialize_premium_payment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
