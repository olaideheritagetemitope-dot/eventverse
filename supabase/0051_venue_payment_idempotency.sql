begin;

-- Preserve the existing booking_id UNIQUE invariant. Retries reuse the
-- authoritative payment row instead of inserting a second row.
create or replace function public.initialize_venue_booking_payment(
  p_booking_id uuid,
  p_idempotency_key text
)
returns public.venue_booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.venue_bookings;
  v public.venues;
  p public.venue_booking_payments;
  amount numeric;
  clean_key text := nullif(trim(p_idempotency_key), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if clean_key is null then
    raise exception 'Idempotency key is required';
  end if;

  select * into b
  from public.venue_bookings
  where id = p_booking_id and organizer_id = auth.uid()
  for update;
  if not found then
    raise exception 'Booking not found or not owned by Organizer';
  end if;
  if b.status <> 'CONFIRMED' then
    raise exception 'Venue booking must be confirmed before payment';
  end if;

  select * into v from public.venues where id = b.venue_id;
  amount := coalesce((v.pricing->>'base')::numeric, (v.pricing->>'amount')::numeric, 0);
  if amount <= 0 then
    raise exception 'Venue payment amount is not configured';
  end if;

  insert into public.venue_booking_payments(booking_id, payer_id, amount, idempotency_key)
  values (b.id, auth.uid(), amount, clean_key)
  on conflict (booking_id) do update
    set updated_at = now()
  returning * into p;

  update public.venue_bookings
  set amount = p.amount,
      payment_status = case when p.status = 'SUCCESS' then 'SUCCESS' else 'INITIALIZED' end,
      updated_at = now()
  where id = b.id;

  return p;
end;
$$;
revoke all on function public.initialize_venue_booking_payment(uuid, text) from public;
grant execute on function public.initialize_venue_booking_payment(uuid, text) to authenticated;

-- Webhook retries are safe, but a failed payment must not be promoted to
-- success by a late or duplicated success event.
create or replace function public.verify_venue_booking_payment(
  p_payment_id uuid,
  p_provider_reference text
)
returns public.venue_booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.venue_booking_payments;
begin
  select * into p
  from public.venue_booking_payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Venue payment not found';
  end if;
  if p.status = 'SUCCESS' then
    return p;
  end if;
  if p.status = 'FAILED' then
    raise exception 'Venue payment is already failed';
  end if;

  update public.venue_booking_payments
  set status = 'SUCCESS',
      provider_reference = coalesce(nullif(trim(p_provider_reference), ''), provider_reference),
      updated_at = now()
  where id = p_payment_id
  returning * into p;

  update public.venue_bookings
  set payment_status = 'SUCCESS',
      payment_provider_reference = p.provider_reference,
      updated_at = now()
  where id = p.booking_id;
  return p;
end;
$$;
revoke all on function public.verify_venue_booking_payment(uuid, text) from public;
grant execute on function public.verify_venue_booking_payment(uuid, text) to service_role;

commit;

notify pgrst, 'reload schema';
