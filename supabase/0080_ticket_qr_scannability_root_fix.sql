-- Atizzy ticket QR scannability root fix.
--
-- QR payloads are opaque high-entropy tokens. They are encoded by the frontend
-- as a standards-compliant QR image and verified server-side by hashing the
-- decoded token. Every security-definer function qualifies pgcrypto through
-- extensions.digest because its search_path is deliberately restricted to
-- public. This keeps ticket display and every scanner path on the same hash
-- contract without exposing the stored token.

create or replace function public.issue_ticket_qr_token(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row public.tickets%rowtype;
  qr_token text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id and owner_id = auth.uid()
  for update;

  if ticket_row.id is null then
    raise exception 'Ticket not found';
  end if;

  if ticket_row.status not in ('ISSUED', 'ACTIVE', 'CHECKED_IN') then
    raise exception 'Ticket is not eligible for QR display';
  end if;

  -- A fresh token is minted only for the authenticated owner. The database
  -- stores only its SHA-256 digest; the returned token is the QR payload.
  qr_token := replace(gen_random_uuid()::text || '-' || gen_random_uuid()::text, '-', '');
  update public.tickets
  set qr_token_hash = encode(extensions.digest(qr_token, 'sha256'::text), 'hex')
  where id = ticket_row.id;

  return jsonb_build_object(
    'ticket_id', ticket_row.id,
    'qr_token', qr_token,
    'status', ticket_row.status,
    'qr_format', 'ATIZZY_TICKET_V1'
  );
end;
$$;

create or replace function public.event_staff_entry_decision(p_qr_token text, p_decision text default 'ACCEPT')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  ticket_id uuid;
  event_id uuid;
  ticket_row public.tickets%rowtype;
  decision text;
begin
  decision := upper(coalesce(nullif(trim(p_decision), ''), 'ACCEPT'));
  if decision not in ('ACCEPT','REJECT') then
    raise exception 'Entry decision must be ACCEPT or REJECT';
  end if;
  if nullif(trim(p_qr_token), '') is null then
    return jsonb_build_object('decision','REJECT','reason','INVALID_TOKEN','message','A QR token is required');
  end if;

  token_hash := encode(extensions.digest(trim(p_qr_token), 'sha256'::text), 'hex');
  select t.id, tt.event_id into ticket_id, event_id
  from public.tickets t
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.qr_token_hash = token_hash;

  if ticket_id is null then
    insert into public.audit_logs(actor_id, action, entity_type, metadata)
    values (auth.uid(), 'event_staff.entry_rejected', 'ticket', jsonb_build_object('reason','INVALID_TOKEN'));
    return jsonb_build_object('decision','REJECT','reason','INVALID_TOKEN','message','Ticket QR token is invalid or expired');
  end if;
  if not public.event_staff_can_check_in(event_id) then
    raise exception 'This assignment does not permit ticket entry decisions';
  end if;

  select * into ticket_row from public.tickets where id = ticket_id for update;
  if ticket_row.status = 'CHECKED_IN' then
    return jsonb_build_object('decision','REJECT','reason','ALREADY_USED','ticket_id',ticket_id,'message','Ticket has already been used');
  end if;
  if ticket_row.status not in ('ISSUED','ACTIVE') then
    return jsonb_build_object('decision','REJECT','reason','INVALID_STATUS','ticket_id',ticket_id,'message','Ticket is not valid for entry');
  end if;
  if decision = 'REJECT' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'event_staff.entry_rejected', 'ticket', ticket_id, jsonb_build_object('event_id', event_id, 'reason','STAFF_REJECTED'));
    return jsonb_build_object('decision','REJECT','reason','STAFF_REJECTED','ticket_id',ticket_id,'message','Entry rejected by Event Staff');
  end if;

  update public.tickets set status = 'CHECKED_IN', checked_in_at = now() where id = ticket_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event_staff.entry_accepted', 'ticket', ticket_id, jsonb_build_object('event_id', event_id, 'attendance_recorded', true));
  return jsonb_build_object('decision','ACCEPT','reason','VALID_ENTRY','ticket_id',ticket_id,'status','checked_in','checked_in_at',now(),'attendance_recorded',true);
end;
$$;

create or replace function public.check_in_ticket_with_token(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  ticket_id uuid;
  event_id uuid;
begin
  if nullif(trim(p_qr_token), '') is null then
    raise exception 'QR token is required';
  end if;

  token_hash := encode(extensions.digest(trim(p_qr_token), 'sha256'::text), 'hex');
  select t.id, tt.event_id into ticket_id, event_id
  from public.tickets t
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.qr_token_hash = token_hash;
  if ticket_id is null then
    raise exception 'Ticket QR token is invalid or expired';
  end if;
  if not (
    public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])
    or public.event_staff_can_check_in(event_id)
    or (public.has_any_app_role(array['ORGANIZER'::public.app_role]) and exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()))
    or (public.has_any_app_role(array['VENUE_MANAGER'::public.app_role]) and exists(select 1 from public.events e join public.venues v on v.id = e.venue_id where e.id = event_id and v.owner_id = auth.uid()))
  ) then
    raise exception 'You are not authorized to check in this event';
  end if;
  return public.check_in_ticket(ticket_id);
end;
$$;

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

  token_hash := encode(extensions.digest(trim(p_qr_token), 'sha256'::text), 'hex');
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

revoke all on function public.issue_ticket_qr_token(uuid) from public;
grant execute on function public.issue_ticket_qr_token(uuid) to authenticated;
revoke all on function public.event_staff_entry_decision(text, text) from public;
grant execute on function public.event_staff_entry_decision(text, text) to authenticated;
revoke all on function public.check_in_ticket_with_token(text) from public;
grant execute on function public.check_in_ticket_with_token(text) to authenticated;
revoke all on function public.validate_ticket_qr(text, uuid) from public;
grant execute on function public.validate_ticket_qr(text, uuid) to authenticated;
