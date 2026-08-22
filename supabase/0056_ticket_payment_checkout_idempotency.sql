begin;

alter table public.payments
  add column if not exists checkout_url text,
  add column if not exists access_code text;

create or replace function public.initialize_order_payment(
  p_order_id uuid,
  p_provider text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order record;
  v_payment record;
  v_provider text := lower(trim(coalesce(p_provider, '')));
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_order_id is null or p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception using errcode = '22023', message = 'A valid order and idempotency key are required';
  end if;
  if v_provider not in ('paystack', 'card', 'bank', 'ussd') then
    raise exception using errcode = '22023', message = 'Unsupported payment provider';
  end if;

  select id, user_id, reservation_id, status, total, currency
    into v_order
  from public.orders
  where id = p_order_id and user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  select p.id, p.order_id, p.provider, p.status, p.amount, p.currency,
         p.provider_reference, p.checkout_url, p.access_code
    into v_payment
  from public.payments p
  where p.order_id = p_order_id and p.idempotency_key = trim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'payment_id', v_payment.id, 'order_id', v_payment.order_id,
      'provider', v_payment.provider, 'status', v_payment.status,
      'amount', v_payment.amount, 'currency', v_payment.currency,
      'provider_reference', v_payment.provider_reference,
      'authorization_url', v_payment.checkout_url,
      'access_code', v_payment.access_code,
      'checkout_url', v_payment.checkout_url,
      'development_mode', false, 'replayed', true
    );
  end if;

  if v_order.status not in ('RESERVED', 'PENDING_PAYMENT') then
    raise exception using errcode = 'P0002', message = 'Order is not available for payment';
  end if;
  if v_order.reservation_id is null or not exists (
    select 1 from public.ticket_reservations r
    where r.id = v_order.reservation_id and r.user_id = v_user_id
      and r.status = 'ACTIVE' and r.expires_at > now()
  ) then
    raise exception using errcode = 'P0002', message = 'Ticket reservation has expired';
  end if;

  insert into public.payments(order_id, provider, idempotency_key, status, amount, currency)
  values (p_order_id, v_provider, trim(p_idempotency_key), 'INITIALIZED', v_order.total, v_order.currency)
  returning id, order_id, provider, status, amount, currency,
            provider_reference, checkout_url, access_code into v_payment;

  update public.orders set status = 'PENDING_PAYMENT', updated_at = now() where id = p_order_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'PAYMENT_INITIALIZED', 'payment', v_payment.id,
    jsonb_build_object('order_id', p_order_id, 'provider', v_provider, 'amount', v_order.total));

  return jsonb_build_object(
    'payment_id', v_payment.id, 'order_id', v_payment.order_id,
    'provider', v_payment.provider, 'status', v_payment.status,
    'amount', v_payment.amount, 'currency', v_payment.currency,
    'provider_reference', v_payment.provider_reference,
    'authorization_url', v_payment.checkout_url,
    'access_code', v_payment.access_code,
    'checkout_url', v_payment.checkout_url,
    'development_mode', false, 'replayed', false
  );
exception when unique_violation then
  select p.id, p.order_id, p.provider, p.status, p.amount, p.currency,
         p.provider_reference, p.checkout_url, p.access_code
    into v_payment
  from public.payments p
  where p.order_id = p_order_id and p.idempotency_key = trim(p_idempotency_key);
  if found then
    return jsonb_build_object(
      'payment_id', v_payment.id, 'order_id', v_payment.order_id,
      'provider', v_payment.provider, 'status', v_payment.status,
      'amount', v_payment.amount, 'currency', v_payment.currency,
      'provider_reference', v_payment.provider_reference,
      'authorization_url', v_payment.checkout_url,
      'access_code', v_payment.access_code,
      'checkout_url', v_payment.checkout_url,
      'development_mode', false, 'replayed', true
    );
  end if;
  raise;
end;
$$;

revoke all on function public.initialize_order_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.initialize_order_payment(uuid, text, text) to authenticated;

commit;
