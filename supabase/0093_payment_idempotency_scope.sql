begin;

-- Idempotency keys identify one attempt within its payment owner/context.
-- A global per-table key unnecessarily rejects a new order/application when a
-- client happens to reuse a key and is not the correct replay boundary.
alter table public.payments drop constraint if exists payments_idempotency_key_key;
alter table public.artist_fee_transactions drop constraint if exists artist_fee_transactions_idempotency_key_key;
alter table public.role_application_payments drop constraint if exists role_application_payments_idempotency_key_key;
alter table public.venue_booking_payments drop constraint if exists venue_booking_payments_idempotency_key_key;
alter table public.premium_payments drop constraint if exists premium_payments_idempotency_key_key;

create unique index if not exists payments_order_idempotency_key
  on public.payments(order_id, idempotency_key);
create unique index if not exists artist_fee_transactions_user_idempotency_key
  on public.artist_fee_transactions(user_id, idempotency_key);
create unique index if not exists role_application_payments_application_idempotency_key
  on public.role_application_payments(application_id, idempotency_key);
create unique index if not exists venue_booking_payments_booking_idempotency_key
  on public.venue_booking_payments(booking_id, idempotency_key);
create unique index if not exists premium_payments_user_idempotency_key
  on public.premium_payments(user_id, idempotency_key);

-- Never let a caller replay an idempotency key belonging to another user.
create or replace function public.initialize_role_application_payment(p_application_id uuid,p_idempotency_key text)
returns public.role_application_payments language plpgsql security definer set search_path=public as $$
declare v_app public.role_applications; v_existing public.role_application_payments; v_payment public.role_application_payments; v_ref text; v_key text:=nullif(trim(p_idempotency_key),'');
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if v_key is null then raise exception 'Idempotency key is required'; end if;
 select * into v_app from public.role_applications where id=p_application_id and user_id=auth.uid() for update;
 if not found then raise exception 'Application not found'; end if;
 if v_app.status not in ('APPROVED','PENDING_PAYMENT') then raise exception 'Application is not approved for payment'; end if;
 if v_app.fee_amount<=0 then raise exception 'No payment is required for this application'; end if;
 if v_app.fee_status not in ('PENDING','FAILED') then raise exception 'Application payment is not available'; end if;
 select * into v_existing from public.role_application_payments where application_id=p_application_id and user_id=auth.uid() and idempotency_key=v_key limit 1;
 if found then return v_existing; end if;
 v_ref:=public.mint_payment_transaction_reference('ROLE_APPLICATION');
 insert into public.role_application_payments(application_id,user_id,role_code,amount,currency,idempotency_key,transaction_reference,status)
 values(v_app.id,v_app.user_id,v_app.role_code,v_app.fee_amount,v_app.fee_currency,v_key,v_ref,'PROVIDER_PENDING') returning * into v_payment;
 update public.payment_transaction_references set payment_id=v_payment.id where transaction_reference=v_ref;
 update public.role_applications set status='PENDING_PAYMENT',fee_status='PENDING',updated_at=now() where id=v_app.id;
 return v_payment;
exception when unique_violation then
 select * into v_existing from public.role_application_payments where application_id=p_application_id and user_id=auth.uid() and idempotency_key=v_key limit 1;
 if found then return v_existing; end if;
 raise;
end; $$;

create or replace function public.initialize_artist_fee_payment(p_transaction_type text,p_idempotency_key text)
returns public.artist_fee_transactions language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_setting public.platform_settings; v_artist public.artists; v_existing public.artist_fee_transactions; v_transaction public.artist_fee_transactions; v_ref text; v_key text:=nullif(trim(p_idempotency_key),'');
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_transaction_type not in ('REGISTRATION','VERIFICATION') then raise exception 'Invalid artist transaction type'; end if;
 if v_key is null then raise exception 'Idempotency key is required'; end if;
 select * into v_existing from public.artist_fee_transactions where user_id=v_user and idempotency_key=v_key limit 1;
 if found then return v_existing; end if;
 select * into v_setting from public.platform_settings where key=case when p_transaction_type='REGISTRATION' then 'artist_registration_fee' else 'artist_verification_fee' end for share;
 if v_setting.key is null then raise exception 'Artist fee is not configured'; end if;
 if p_transaction_type='REGISTRATION' then
   if exists(select 1 from public.artists where user_id=v_user) then raise exception 'Artist profile already exists'; end if;
 else
   select * into v_artist from public.artists where user_id=v_user limit 1;
   if v_artist.id is null then raise exception 'Artist profile is required before verification'; end if;
   if v_artist.verified then raise exception 'Artist is already verified'; end if;
 end if;
 v_ref:=public.mint_payment_transaction_reference('ARTIST');
 insert into public.artist_fee_transactions(user_id,artist_id,transaction_type,amount,currency,idempotency_key,transaction_reference,status)
 values(v_user,case when p_transaction_type='VERIFICATION' then v_artist.id else null end,p_transaction_type,v_setting.amount,v_setting.currency,v_key,v_ref,'PROVIDER_PENDING') returning * into v_transaction;
 update public.payment_transaction_references set payment_id=v_transaction.id where transaction_reference=v_ref;
 return v_transaction;
exception when unique_violation then
 select * into v_existing from public.artist_fee_transactions where user_id=v_user and idempotency_key=v_key limit 1;
 if found then return v_existing; end if;
 raise;
end; $$;

revoke all on function public.initialize_role_application_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.initialize_role_application_payment(uuid,text) to authenticated;
revoke all on function public.initialize_artist_fee_payment(text,text) from public,anon,authenticated;
grant execute on function public.initialize_artist_fee_payment(text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
