-- Atizzy QR scanner result-state contract.
-- The frontend submits only the decoded payload. Supabase remains authoritative.

create or replace function public.validate_ticket_qr(p_qr_token text, p_expected_event_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  ticket_row public.tickets%rowtype;
  event_row public.events%rowtype;
  ticket_type_row public.ticket_types%rowtype;
  order_row public.orders%rowtype;
  attendee_name text;
  authorized boolean := false;
  previous_status text;
  result_code text;
  result_message text;
begin
  if auth.uid() is null then
    return jsonb_build_object('result_code','UNAUTHORIZED','message','Authentication is required to verify tickets.');
  end if;

  if nullif(trim(p_qr_token), '') is null then
    return jsonb_build_object('result_code','INVALID_QR','message','A QR token is required.');
  end if;

  token_hash := encode(digest(trim(p_qr_token), 'sha256'), 'hex');
  select * into ticket_row from public.tickets where qr_token_hash = token_hash for update;
  if ticket_row.id is null then
    return jsonb_build_object('result_code','INVALID_QR','message','This QR code is not a valid Atizzy ticket.');
  end if;

  select * into ticket_type_row from public.ticket_types where id = ticket_row.ticket_type_id;
  select * into event_row from public.events where id = ticket_type_row.event_id;
  select * into order_row from public.orders where id = ticket_row.order_id;
  select up.full_name into attendee_name from public.user_profiles up where up.id = ticket_row.owner_id;

  if p_expected_event_id is not null and event_row.id is distinct from p_expected_event_id then
    return jsonb_build_object('result_code','WRONG_EVENT','message','This ticket is for a different event.','ticket_id',ticket_row.id,'event_id',event_row.id,'event_title',event_row.title,'ticket_type',ticket_type_row.name);
  end if;

  authorized := public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])
    or public.event_staff_can_check_in(event_row.id)
    or (public.has_any_app_role(array['ORGANIZER'::public.app_role]) and event_row.organizer_id = auth.uid())
    or (public.has_any_app_role(array['VENUE_MANAGER'::public.app_role]) and exists (select 1 from public.venues v where v.id = event_row.venue_id and v.owner_id = auth.uid()));
  if not authorized then
    return jsonb_build_object('result_code','UNAUTHORIZED','message','You are not authorized to check in tickets for this event.','event_id',event_row.id,'event_title',event_row.title);
  end if;

  if event_row.status in ('CANCELLED','REJECTED') then
    result_code := 'REJECTED';
    result_message := 'This event is not eligible for check-in.';
  elsif ticket_row.status = 'CHECKED_IN' then
    result_code := 'ALREADY_USED';
    result_message := 'This ticket was already checked in and cannot be used again.';
  elsif ticket_row.status = 'EXPIRED' then
    result_code := 'EXPIRED';
    result_message := 'This ticket is expired and cannot be checked in.';
  elsif ticket_row.status = 'CANCELLED' then
    result_code := 'CANCELLED';
    result_message := 'This ticket was cancelled and cannot be checked in.';
  elsif ticket_row.status = 'REFUNDED' or order_row.status in ('REFUNDED','PARTIALLY_REFUNDED') then
    result_code := 'REFUNDED';
    result_message := 'This ticket was refunded and cannot be checked in.';
  elsif ticket_row.status not in ('ISSUED','ACTIVE') or order_row.status not in ('PAID','FULFILLED') then
    result_code := 'REJECTED';
    result_message := 'This ticket is not eligible for entry.';
  else
    previous_status := ticket_row.status::text;
    update public.tickets set status = 'CHECKED_IN', checked_in_at = now() where id = ticket_row.id;
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'ticket.checked_in', 'ticket', ticket_row.id, jsonb_build_object('previous_status', previous_status, 'via', 'qr_token', 'event_id', event_row.id));
    return jsonb_build_object('result_code','SUCCESS','message','Ticket successfully checked in.','ticket_id',ticket_row.id,'event_id',event_row.id,'event_title',event_row.title,'ticket_type',ticket_type_row.name,'attendee_name',attendee_name,'status','checked_in','checked_in_at',now(),'attendance_recorded',true);
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'ticket.verification_rejected', 'ticket', ticket_row.id, jsonb_build_object('result_code', result_code, 'event_id', event_row.id));
  return jsonb_build_object('result_code',result_code,'message',result_message,'ticket_id',ticket_row.id,'event_id',event_row.id,'event_title',event_row.title,'ticket_type',ticket_type_row.name,'attendee_name',attendee_name,'status',ticket_row.status);
end;
$$;

revoke all on function public.validate_ticket_qr(text, uuid) from public;
grant execute on function public.validate_ticket_qr(text, uuid) to authenticated;
