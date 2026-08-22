begin;

-- role_fee_policies is the sole authoritative source for role onboarding
-- verification fees. platform_settings remains only as a compatibility ledger
-- for the retired Artist registration/verification screens.

create or replace function public.update_platform_setting_fee(p_key text, p_amount numeric)
returns public.platform_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_previous public.platform_settings;
  v_updated public.platform_settings;
  v_role public.role_fee_policies;
  v_role_code text := 'ARTIST';
begin
  if v_user is null or not public.is_super_admin() then
    raise exception 'Super Admin is required';
  end if;
  if p_key not in ('artist_registration_fee', 'artist_verification_fee') then
    raise exception 'Legacy Artist fee setting is read-only through this compatibility bridge';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Fee must be a non-negative amount';
  end if;

  select * into v_previous from public.platform_settings where key = p_key for update;
  if v_previous.key is null then raise exception 'Legacy Artist fee setting not found'; end if;

  update public.role_fee_policies
    set amount = p_amount,
        currency = coalesce(nullif(trim(v_previous.currency), ''), 'NGN'),
        updated_by = v_user,
        updated_at = now()
    where role_code = v_role_code
    returning * into v_role;
  if v_role.role_code is null then raise exception 'Canonical Artist role fee policy not found'; end if;

  -- Keep both retired rows aligned for old clients that may still read them;
  -- neither row is used by the canonical role onboarding or payment flow.
  update public.platform_settings
    set amount = p_amount, updated_by = v_user, updated_at = now()
    where key in ('artist_registration_fee', 'artist_verification_fee')
    returning * into v_updated;

  insert into public.audit_logs(actor_id, action, entity_type, metadata)
  values (v_user, 'role_fee_policy.updated_via_legacy_bridge', 'role_fee_policy',
    jsonb_build_object('role_code', v_role_code, 'legacy_key', p_key,
      'previous_amount', v_previous.amount, 'new_amount', p_amount,
      'currency', v_role.currency));
  return v_updated;
end;
$$;

create or replace function public.initialize_artist_fee_payment(p_transaction_type text, p_idempotency_key text)
returns public.artist_fee_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_policy public.role_fee_policies;
  v_artist public.artists;
  v_existing public.artist_fee_transactions;
  v_transaction public.artist_fee_transactions;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_transaction_type not in ('REGISTRATION','VERIFICATION') then raise exception 'Invalid artist transaction type'; end if;
  if coalesce(trim(p_idempotency_key), '') = '' then raise exception 'Idempotency key is required'; end if;
  select * into v_existing from public.artist_fee_transactions where idempotency_key = p_idempotency_key limit 1;
  if v_existing.id is not null then return v_existing; end if;

  select * into v_policy from public.role_fee_policies where role_code = 'ARTIST' and enabled for share;
  if v_policy.role_code is null then raise exception 'Artist role fee is not configured'; end if;

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
  values (v_user, case when p_transaction_type = 'VERIFICATION' then v_artist.id else null end, p_transaction_type, v_policy.amount, v_policy.currency, p_idempotency_key, 'PROVIDER_PENDING')
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

revoke all on function public.update_platform_setting_fee(text, numeric) from public;
grant execute on function public.update_platform_setting_fee(text, numeric) to authenticated;
revoke all on function public.initialize_artist_fee_payment(text, text) from public;
grant execute on function public.initialize_artist_fee_payment(text, text) to authenticated;

-- Record the one-time reconciliation without changing historical transactions.
insert into public.audit_logs(actor_id, action, entity_type, metadata)
select auth.uid(), 'role_fee_policy.legacy_artist_reconciled', 'role_fee_policy',
  jsonb_build_object('role_code','ARTIST','registration_legacy_amount',r.amount,'verification_legacy_amount',v.amount,'canonical_amount',p.amount,'currency',p.currency)
from public.role_fee_policies p
left join public.platform_settings r on r.key='artist_registration_fee'
left join public.platform_settings v on v.key='artist_verification_fee'
where p.role_code='ARTIST'
limit 1;

commit;
