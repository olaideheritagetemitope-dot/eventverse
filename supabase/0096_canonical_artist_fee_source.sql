begin;

create or replace function public.initialize_artist_fee_payment(p_transaction_type text, p_idempotency_key text)
returns public.artist_fee_transactions
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_policy public.role_fee_policies;
  v_artist public.artists;
  v_existing public.artist_fee_transactions;
  v_transaction public.artist_fee_transactions;
  v_ref text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_transaction_type not in ('REGISTRATION','VERIFICATION') then raise exception 'Invalid artist transaction type'; end if;
  if coalesce(trim(p_idempotency_key), '') = '' then raise exception 'Idempotency key is required'; end if;

  select * into v_existing
    from public.artist_fee_transactions
   where user_id = v_user
     and idempotency_key = p_idempotency_key
   limit 1;
  if found then return v_existing; end if;

  select * into v_policy
    from public.role_fee_policies
   where role_code = 'ARTIST'
     and enabled
   for share;
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

  v_ref := public.mint_payment_transaction_reference('ARTIST');
  insert into public.artist_fee_transactions(user_id, artist_id, transaction_type, amount, currency, idempotency_key, transaction_reference, status)
  values (v_user, case when p_transaction_type = 'VERIFICATION' then v_artist.id else null end, p_transaction_type, v_policy.amount, v_policy.currency, p_idempotency_key, v_ref, 'PROVIDER_PENDING')
  returning * into v_transaction;

  update public.payment_transaction_references
     set payment_id = v_transaction.id
   where transaction_reference = v_ref;

  if p_transaction_type = 'REGISTRATION' then
    insert into public.artist_registrations(user_id, transaction_id, status, submitted_at)
    values (v_user, v_transaction.id, 'PENDING_PAYMENT', now())
    on conflict (user_id) do update
      set transaction_id = excluded.transaction_id,
          status = 'PENDING_PAYMENT',
          failure_reason = null,
          updated_at = now();
  else
    insert into public.artist_verifications(artist_id, user_id, transaction_id, status, requested_at)
    values (v_artist.id, v_user, v_transaction.id, 'PENDING_PAYMENT', now())
    on conflict (artist_id) do update
      set transaction_id = excluded.transaction_id,
          status = 'PENDING_PAYMENT',
          failure_reason = null,
          updated_at = now();
  end if;
  return v_transaction;
exception when unique_violation then
  select * into v_existing
    from public.artist_fee_transactions
   where user_id = v_user
     and idempotency_key = p_idempotency_key
   limit 1;
  if found then return v_existing; end if;
  raise;
end;
$fn$;

revoke all on function public.initialize_artist_fee_payment(text, text) from public, anon, authenticated;
grant execute on function public.initialize_artist_fee_payment(text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
