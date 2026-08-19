begin;

create or replace function public.mark_payment_failed(
  p_payment_id uuid,
  p_provider_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '28000', message = 'Only the payment service can mark payments failed';
  end if;

  update public.payments
  set status = 'FAILED',
      provider_reference = coalesce(nullif(trim(p_provider_reference), ''), provider_reference),
      updated_at = now()
  where id = p_payment_id
    and status not in ('VERIFIED_SUCCESS', 'REFUNDED')
  returning * into v_payment;

  if v_payment.id is null then
    raise exception using errcode = 'P0002', message = 'Payment not found or already final';
  end if;

  update public.orders
  set status = 'PAYMENT_FAILED', updated_at = now()
  where id = v_payment.order_id
    and status not in ('PAID', 'FULFILLED', 'REFUNDED');

  return jsonb_build_object('payment_id', v_payment.id, 'order_id', v_payment.order_id, 'status', v_payment.status);
end;
$$;

revoke all on function public.mark_payment_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_payment_failed(uuid, text) to service_role;

commit;
