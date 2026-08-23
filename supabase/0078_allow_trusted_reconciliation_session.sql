-- Allow only trusted payment-service JWTs or direct database-admin sessions to finalize payments.
-- This preserves the service boundary while permitting audited Supabase admin reconciliation.
create or replace function public.verify_payment_and_issue_tickets(p_payment_id uuid, p_provider_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
  order_row public.orders%rowtype;
  item_row record;
  ticket_index integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and session_user <> 'postgres' then
    raise exception 'Only the payment webhook service can verify payments';
  end if;
  if coalesce(trim(p_provider_reference), '') = '' then
    raise exception 'Provider reference is required';
  end if;

  select * into payment_row from public.payments where id = p_payment_id for update;
  if payment_row.id is null then raise exception 'Payment not found'; end if;
  select * into order_row from public.orders where id = payment_row.order_id for update;
  if order_row.id is null then raise exception 'Order not found'; end if;

  if payment_row.status = 'VERIFIED_SUCCESS' and order_row.status in ('PAID', 'FULFILLED') then
    return jsonb_build_object('payment_id', payment_row.id, 'order_id', order_row.id, 'status', 'already_verified');
  end if;

  update public.payments
  set status = 'VERIFIED_SUCCESS', provider_reference = p_provider_reference,
      verified_at = coalesce(verified_at, now()), updated_at = now()
  where id = payment_row.id;

  update public.orders set status = 'PAID', updated_at = now() where id = order_row.id;

  for item_row in
    select oi.ticket_type_id, oi.quantity
    from public.order_items oi
    where oi.order_id = order_row.id
  loop
    for ticket_index in 1..item_row.quantity loop
      insert into public.tickets (order_id, ticket_type_id, owner_id, qr_token_hash, status)
      values (
        order_row.id,
        item_row.ticket_type_id,
        order_row.user_id,
        encode(digest(gen_random_uuid()::text || clock_timestamp()::text, 'sha256'), 'hex'),
        'ISSUED'
      );
    end loop;
    update public.ticket_types
    set sold = sold + item_row.quantity,
        reserved = greatest(0, reserved - item_row.quantity)
    where id = item_row.ticket_type_id;
  end loop;

  update public.orders set status = 'FULFILLED', updated_at = now() where id = order_row.id;
  return jsonb_build_object('payment_id', payment_row.id, 'order_id', order_row.id, 'status', 'verified_and_issued');
end;
$$;

revoke all on function public.verify_payment_and_issue_tickets(uuid, text) from public;
grant execute on function public.verify_payment_and_issue_tickets(uuid, text) to service_role;
