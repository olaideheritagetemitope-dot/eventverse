begin;

-- 0062: strict payment transaction-reference root fix.
-- A payment attempt has two distinct identities:
--   * idempotency_key: stable for retries of that same attempt
--   * transaction_reference: minted once by the database for that attempt
-- New idempotency keys therefore create new references; retries replay the same row.

create table if not exists public.payment_transaction_references (
  transaction_reference text primary key,
  payment_domain text not null check (payment_domain in ('TICKET','ARTIST','ROLE_APPLICATION','VENUE')),
  payment_id uuid,
  created_at timestamptz not null default now()
);

alter table public.payment_transaction_references enable row level security;
drop policy if exists payment_transaction_references_service_only on public.payment_transaction_references;
create policy payment_transaction_references_service_only on public.payment_transaction_references
  for select to service_role using (true);

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
  if v_domain not in ('TICKET','ARTIST','ROLE_APPLICATION','VENUE') then
    raise exception 'Unsupported payment domain';
  end if;
  for v_attempt in 1..12 loop
    v_reference := 'ATZ-' || v_domain || '-' || upper(replace(gen_random_uuid()::text, '-', ''));
    begin
      insert into public.payment_transaction_references(transaction_reference, payment_domain)
      values (v_reference, v_domain);
      return v_reference;
    exception when unique_violation then
      -- Extremely unlikely UUID collision; retry with a fresh UUID.
    end;
  end loop;
  raise exception 'Unable to mint a unique payment transaction reference';
end;
$$;

revoke all on function public.mint_payment_transaction_reference(text) from public, anon, authenticated;
grant execute on function public.mint_payment_transaction_reference(text) to service_role;

alter table public.payments add column if not exists transaction_reference text;
alter table public.artist_fee_transactions add column if not exists transaction_reference text;
alter table public.role_application_payments add column if not exists transaction_reference text;
alter table public.venue_booking_payments add column if not exists transaction_reference text;

-- Backfill legacy rows into the same global registry before enforcing NOT NULL/UNIQUE.
do $$
declare r record; v_ref text;
begin
  for r in select id from public.payments where transaction_reference is null loop
    v_ref := public.mint_payment_transaction_reference('TICKET');
    update public.payments set transaction_reference = v_ref where id = r.id;
    update public.payment_transaction_references set payment_id = r.id where transaction_reference = v_ref;
  end loop;
  for r in select id from public.artist_fee_transactions where transaction_reference is null loop
    v_ref := public.mint_payment_transaction_reference('ARTIST');
    update public.artist_fee_transactions set transaction_reference = v_ref where id = r.id;
    update public.payment_transaction_references set payment_id = r.id where transaction_reference = v_ref;
  end loop;
  for r in select id from public.role_application_payments where transaction_reference is null loop
    v_ref := public.mint_payment_transaction_reference('ROLE_APPLICATION');
    update public.role_application_payments set transaction_reference = v_ref where id = r.id;
    update public.payment_transaction_references set payment_id = r.id where transaction_reference = v_ref;
  end loop;
  for r in select id from public.venue_booking_payments where transaction_reference is null loop
    v_ref := public.mint_payment_transaction_reference('VENUE');
    update public.venue_booking_payments set transaction_reference = v_ref where id = r.id;
    update public.payment_transaction_references set payment_id = r.id where transaction_reference = v_ref;
  end loop;
end $$;

alter table public.payments alter column transaction_reference set not null;
alter table public.artist_fee_transactions alter column transaction_reference set not null;
alter table public.role_application_payments alter column transaction_reference set not null;
alter table public.venue_booking_payments alter column transaction_reference set not null;

create unique index if not exists payments_transaction_reference_key on public.payments(transaction_reference);
create unique index if not exists artist_fee_transactions_transaction_reference_key on public.artist_fee_transactions(transaction_reference);
create unique index if not exists role_application_payments_transaction_reference_key on public.role_application_payments(transaction_reference);
create unique index if not exists venue_booking_payments_transaction_reference_key on public.venue_booking_payments(transaction_reference);

-- A new attempt is distinguished by a new idempotency key. The old order/application/
-- booking-level uniqueness constraints prevented that, so retries remain key-scoped
-- while a new key may create a fresh attempt.
alter table public.role_application_payments drop constraint if exists role_application_payments_application_id_key;
alter table public.venue_booking_payments drop constraint if exists venue_booking_payments_booking_id_key;

create or replace function public.initialize_order_payment(p_order_id uuid, p_provider text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_order record; v_payment record; v_provider text:=lower(trim(coalesce(p_provider,''))); v_ref text;
begin
 if v_user is null then raise exception using errcode='28000',message='Authentication required'; end if;
 if p_order_id is null or nullif(trim(p_idempotency_key),'') is null or length(trim(p_idempotency_key))<8 then raise exception 'A valid order and idempotency key are required'; end if;
 if v_provider not in ('paystack','card','bank','ussd') then raise exception 'Unsupported payment provider'; end if;
 select id,user_id,reservation_id,status,total,currency into v_order from public.orders where id=p_order_id and user_id=v_user for update;
 if not found then raise exception 'Order not found'; end if;
 select p.id,p.order_id,p.provider,p.status,p.amount,p.currency,p.provider_reference,p.transaction_reference,p.checkout_url,p.access_code into v_payment from public.payments p where p.order_id=p_order_id and p.idempotency_key=trim(p_idempotency_key);
 if found then return jsonb_build_object('payment_id',v_payment.id,'order_id',v_payment.order_id,'provider',v_payment.provider,'status',v_payment.status,'amount',v_payment.amount,'currency',v_payment.currency,'provider_reference',v_payment.provider_reference,'transaction_reference',v_payment.transaction_reference,'authorization_url',v_payment.checkout_url,'access_code',v_payment.access_code,'checkout_url',v_payment.checkout_url,'development_mode',false,'replayed',true); end if;
 if v_order.status not in ('RESERVED','PENDING_PAYMENT') then raise exception 'Order is not available for payment'; end if;
 if v_order.reservation_id is null or not exists(select 1 from public.ticket_reservations r where r.id=v_order.reservation_id and r.user_id=v_user and r.status='ACTIVE' and r.expires_at>now()) then raise exception 'Ticket reservation has expired'; end if;
 v_ref:=public.mint_payment_transaction_reference('TICKET');
 insert into public.payments(order_id,provider,idempotency_key,transaction_reference,status,amount,currency) values(p_order_id,v_provider,trim(p_idempotency_key),v_ref,'INITIALIZED',v_order.total,v_order.currency) returning id,order_id,provider,status,amount,currency,provider_reference,transaction_reference,checkout_url,access_code into v_payment;
 update public.payment_transaction_references set payment_id=v_payment.id where transaction_reference=v_ref;
 update public.orders set status='PENDING_PAYMENT',updated_at=now() where id=p_order_id;
 return jsonb_build_object('payment_id',v_payment.id,'order_id',v_payment.order_id,'provider',v_payment.provider,'status',v_payment.status,'amount',v_payment.amount,'currency',v_payment.currency,'provider_reference',v_payment.provider_reference,'transaction_reference',v_payment.transaction_reference,'authorization_url',v_payment.checkout_url,'access_code',v_payment.access_code,'checkout_url',v_payment.checkout_url,'development_mode',false,'replayed',false);
exception when unique_violation then
 select p.id,p.order_id,p.provider,p.status,p.amount,p.currency,p.provider_reference,p.transaction_reference,p.checkout_url,p.access_code into v_payment from public.payments p where p.order_id=p_order_id and p.idempotency_key=trim(p_idempotency_key);
 if found then return jsonb_build_object('payment_id',v_payment.id,'order_id',v_payment.order_id,'provider',v_payment.provider,'status',v_payment.status,'amount',v_payment.amount,'currency',v_payment.currency,'provider_reference',v_payment.provider_reference,'transaction_reference',v_payment.transaction_reference,'authorization_url',v_payment.checkout_url,'access_code',v_payment.access_code,'checkout_url',v_payment.checkout_url,'development_mode',false,'replayed',true); end if; raise;
end; $$;

create or replace function public.initialize_role_application_payment(p_application_id uuid,p_idempotency_key text)
returns public.role_application_payments language plpgsql security definer set search_path=public as $$
declare v_app public.role_applications; v_existing public.role_application_payments; v_payment public.role_application_payments; v_ref text; v_key text:=nullif(trim(p_idempotency_key),'');
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if; if v_key is null then raise exception 'Idempotency key is required'; end if;
 select * into v_app from public.role_applications where id=p_application_id and user_id=auth.uid() for update; if v_app.id is null then raise exception 'Application not found'; end if;
 if v_app.status not in ('APPROVED','PENDING_PAYMENT') then raise exception 'Application is not approved for payment'; end if; if v_app.fee_amount<=0 then raise exception 'No payment is required for this application'; end if; if v_app.fee_status not in ('PENDING','FAILED') then raise exception 'Application payment is not available'; end if;
 select * into v_existing from public.role_application_payments where idempotency_key=v_key limit 1; if v_existing.id is not null then return v_existing; end if;
 v_ref:=public.mint_payment_transaction_reference('ROLE_APPLICATION');
 insert into public.role_application_payments(application_id,user_id,role_code,amount,currency,idempotency_key,transaction_reference,status) values(v_app.id,v_app.user_id,v_app.role_code,v_app.fee_amount,v_app.fee_currency,v_key,v_ref,'PROVIDER_PENDING') returning * into v_payment;
 update public.payment_transaction_references set payment_id=v_payment.id where transaction_reference=v_ref;
 update public.role_applications set status='PENDING_PAYMENT',fee_status='PENDING',updated_at=now() where id=v_app.id;
 return v_payment;
end; $$;

create or replace function public.initialize_artist_fee_payment(p_transaction_type text,p_idempotency_key text)
returns public.artist_fee_transactions language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_setting public.platform_settings; v_artist public.artists; v_existing public.artist_fee_transactions; v_transaction public.artist_fee_transactions; v_ref text; v_key text:=nullif(trim(p_idempotency_key),'');
begin
 if v_user is null then raise exception 'Authentication required'; end if; if p_transaction_type not in ('REGISTRATION','VERIFICATION') then raise exception 'Invalid artist transaction type'; end if; if v_key is null then raise exception 'Idempotency key is required'; end if;
 select * into v_existing from public.artist_fee_transactions where idempotency_key=v_key limit 1; if v_existing.id is not null then return v_existing; end if;
 select * into v_setting from public.platform_settings where key=case when p_transaction_type='REGISTRATION' then 'artist_registration_fee' else 'artist_verification_fee' end for share; if v_setting.key is null then raise exception 'Artist fee is not configured'; end if;
 if p_transaction_type='REGISTRATION' then if exists(select 1 from public.artists where user_id=v_user) then raise exception 'Artist profile already exists'; end if; else select * into v_artist from public.artists where user_id=v_user limit 1; if v_artist.id is null then raise exception 'Artist profile is required before verification'; end if; if v_artist.verified then raise exception 'Artist is already verified'; end if; end if;
 v_ref:=public.mint_payment_transaction_reference('ARTIST');
 insert into public.artist_fee_transactions(user_id,artist_id,transaction_type,amount,currency,idempotency_key,transaction_reference,status) values(v_user,case when p_transaction_type='VERIFICATION' then v_artist.id else null end,p_transaction_type,v_setting.amount,v_setting.currency,v_key,v_ref,'PROVIDER_PENDING') returning * into v_transaction;
 update public.payment_transaction_references set payment_id=v_transaction.id where transaction_reference=v_ref;
 return v_transaction;
end; $$;

create or replace function public.initialize_venue_booking_payment(p_booking_id uuid,p_idempotency_key text)
returns public.venue_booking_payments language plpgsql security definer set search_path=public as $$
declare b public.venue_bookings; v public.venues; p public.venue_booking_payments; v_amount numeric; v_key text:=nullif(trim(p_idempotency_key),''); v_ref text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if; if v_key is null then raise exception 'Idempotency key is required'; end if;
 select * into b from public.venue_bookings where id=p_booking_id and organizer_id=auth.uid() for update; if not found then raise exception 'Booking not found or not owned by Organizer'; end if; if b.status<>'CONFIRMED' then raise exception 'Venue booking must be confirmed before payment'; end if;
 select * into p from public.venue_booking_payments where booking_id=p_booking_id and idempotency_key=v_key limit 1; if p.id is not null then return p; end if;
 select * into v from public.venues where id=b.venue_id; v_amount:=coalesce((v.pricing->>'base')::numeric,(v.pricing->>'amount')::numeric,0); if v_amount<=0 then raise exception 'Venue payment amount is not configured'; end if;
 v_ref:=public.mint_payment_transaction_reference('VENUE');
 insert into public.venue_booking_payments(booking_id,payer_id,amount,idempotency_key,transaction_reference) values(b.id,auth.uid(),v_amount,v_key,v_ref) returning * into p;
 update public.payment_transaction_references set payment_id=p.id where transaction_reference=v_ref;
 update public.venue_bookings set amount=p.amount,payment_status=case when p.status='SUCCESS' then 'SUCCESS' else 'INITIALIZED' end,updated_at=now() where id=b.id;
 return p;
end; $$;

revoke all on function public.initialize_order_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.initialize_order_payment(uuid,text,text) to authenticated;
revoke all on function public.initialize_role_application_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.initialize_role_application_payment(uuid,text) to authenticated;
revoke all on function public.initialize_artist_fee_payment(text,text) from public,anon,authenticated;
grant execute on function public.initialize_artist_fee_payment(text,text) to authenticated;
revoke all on function public.initialize_venue_booking_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.initialize_venue_booking_payment(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
