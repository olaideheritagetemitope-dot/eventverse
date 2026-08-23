begin;

create or replace function public.attach_role_application_payment_provider(
  p_payment_id uuid,
  p_provider_reference text,
  p_authorization_url text default null,
  p_access_code text default null
)
returns public.role_application_payments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_payment public.role_application_payments;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the payment service can attach provider references';
  end if;
  if nullif(trim(p_provider_reference), '') is null then
    raise exception 'Provider reference is required';
  end if;
  update public.role_application_payments
     set provider_reference = trim(p_provider_reference),
         authorization_url = coalesce(p_authorization_url, authorization_url),
         access_code = coalesce(p_access_code, access_code),
         status = case when status in ('INITIALIZED','PENDING_PAYMENT','PROVIDER_PENDING') then 'PROVIDER_PENDING' else status end,
         updated_at = now()
   where id = p_payment_id
     and (provider_reference is null or provider_reference = trim(p_provider_reference))
  returning * into v_payment;
  if not found then
    raise exception 'Role payment not found or provider reference is already bound to another attempt';
  end if;
  return v_payment;
end;
$fn$;

create or replace function public.attach_artist_fee_payment_provider(
  p_transaction_id uuid,
  p_provider_reference text,
  p_authorization_url text default null,
  p_access_code text default null
)
returns public.artist_fee_transactions
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_transaction public.artist_fee_transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the payment service can attach provider references';
  end if;
  if nullif(trim(p_provider_reference), '') is null then
    raise exception 'Provider reference is required';
  end if;
  update public.artist_fee_transactions
     set provider_reference = trim(p_provider_reference),
         authorization_url = coalesce(p_authorization_url, authorization_url),
         access_code = coalesce(p_access_code, access_code),
         updated_at = now()
   where id = p_transaction_id
     and (provider_reference is null or provider_reference = trim(p_provider_reference))
  returning * into v_transaction;
  if not found then
    raise exception 'Artist payment not found or provider reference is already bound to another attempt';
  end if;
  return v_transaction;
end;
$fn$;

create or replace function public.attach_venue_booking_payment_provider(
  p_payment_id uuid,
  p_provider_reference text,
  p_authorization_url text default null,
  p_access_code text default null
)
returns public.venue_booking_payments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_payment public.venue_booking_payments;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the payment service can attach provider references';
  end if;
  if nullif(trim(p_provider_reference), '') is null then
    raise exception 'Provider reference is required';
  end if;
  update public.venue_booking_payments
     set provider_reference = trim(p_provider_reference),
         authorization_url = coalesce(p_authorization_url, authorization_url),
         access_code = coalesce(p_access_code, access_code),
         updated_at = now()
   where id = p_payment_id
     and (provider_reference is null or provider_reference = trim(p_provider_reference))
  returning * into v_payment;
  if not found then
    raise exception 'Venue payment not found or provider reference is already bound to another attempt';
  end if;
  return v_payment;
end;
$fn$;

revoke all on function public.attach_role_application_payment_provider(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.attach_artist_fee_payment_provider(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.attach_role_application_payment_provider(uuid,text,text,text) to service_role;
grant execute on function public.attach_artist_fee_payment_provider(uuid,text,text,text) to service_role;

revoke all on function public.attach_venue_booking_payment_provider(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.attach_venue_booking_payment_provider(uuid,text,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
