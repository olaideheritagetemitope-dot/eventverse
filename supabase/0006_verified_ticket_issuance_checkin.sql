-- Atizzy verified payment, ticket issuance, and check-in workflow
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
  ticket_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Only the payment webhook service can verify payments';
  end if;
  select * into payment_row from public.payments where id = p_payment_id for update;
  if payment_row.id is null then raise exception 'Payment not found'; end if;
  select * into order_row from public.orders where id = payment_row.order_id for update;
  if order_row.id is null then raise exception 'Order not found'; end if;
  if payment_row.status = 'VERIFIED_SUCCESS' and order_row.status in ('PAID','FULFILLED') then
    return jsonb_build_object('payment_id', payment_row.id, 'order_id', order_row.id, 'status', 'already_verified');
  end if;
  update public.payments set status = 'VERIFIED_SUCCESS', provider_reference = p_provider_reference, verified_at = now(), updated_at = now() where id = payment_row.id;
  update public.orders set status = 'PAID', updated_at = now() where id = order_row.id;
  for item_row in select oi.ticket_type_id, oi.quantity from public.order_items oi where oi.order_id = order_row.id loop
    for ticket_count in 1..item_row.quantity loop
      insert into public.tickets (order_id, ticket_type_id, owner_id, qr_token_hash, status)
      values (order_row.id, item_row.ticket_type_id, order_row.user_id, encode(digest(gen_random_uuid()::text || clock_timestamp()::text, 'sha256'), 'hex'), 'ISSUED');
    end loop;
    update public.ticket_types set sold = sold + item_row.quantity, reserved = greatest(0, reserved - item_row.quantity) where id = item_row.ticket_type_id;
  end loop;
  update public.orders set status = 'FULFILLED', updated_at = now() where id = order_row.id;
  return jsonb_build_object('payment_id', payment_row.id, 'order_id', order_row.id, 'status', 'verified_and_issued');
end;
$$;

create or replace function public.check_in_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row public.tickets%rowtype;
begin
  if not public.has_any_app_role(array['EVENT_STAFF'::public.app_role,'VENUE_MANAGER'::public.app_role,'ORGANIZER'::public.app_role,'ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'You are not authorized to check in tickets';
  end if;
  select * into ticket_row from public.tickets where id = p_ticket_id for update;
  if ticket_row.id is null then raise exception 'Ticket not found'; end if;
  if ticket_row.status = 'CHECKED_IN' then return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'already_checked_in', 'checked_in_at', ticket_row.checked_in_at); end if;
  if ticket_row.status not in ('ISSUED','ACTIVE') then raise exception 'Ticket is not valid for check-in'; end if;
  update public.tickets set status = 'CHECKED_IN', checked_in_at = now() where id = ticket_row.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'ticket.checked_in', 'ticket', ticket_row.id, jsonb_build_object('previous_status', ticket_row.status));
  return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'checked_in', 'checked_in_at', now());
end;
$$;
