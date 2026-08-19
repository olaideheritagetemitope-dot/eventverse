begin;

create or replace function public.attach_payment_provider_reference(
  p_payment_id uuid,
  p_provider_reference text
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
    raise exception using errcode = '28000', message = 'Only the payment service can attach provider references';
  end if;

  if p_payment_id is null or nullif(trim(p_provider_reference), '') is null then
    raise exception using errcode = '22023', message = 'Payment id and provider reference are required';
  end if;

  update public.payments
  set provider_reference = trim(p_provider_reference), updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  if v_payment.id is null then
    raise exception using errcode = 'P0002', message = 'Payment not found';
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'provider', v_payment.provider,
    'provider_reference', v_payment.provider_reference,
    'status', v_payment.status,
    'amount', v_payment.amount,
    'currency', v_payment.currency
  );
end;
$$;

revoke all on function public.attach_payment_provider_reference(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_payment_provider_reference(uuid, text) to service_role;

commit;
