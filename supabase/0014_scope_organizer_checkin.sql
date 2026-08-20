-- Scope Organizer check-in to events they own. Staff, venue managers, admins,
-- and super admins retain the existing scanner permissions.

create or replace function public.check_in_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row public.tickets%rowtype;
  organizer_id uuid;
begin
  if not public.has_any_app_role(array[
    'EVENT_STAFF'::public.app_role,
    'VENUE_MANAGER'::public.app_role,
    'ORGANIZER'::public.app_role,
    'ADMIN'::public.app_role,
    'SUPER_ADMIN'::public.app_role
  ]) then
    raise exception 'You are not authorized to check in tickets';
  end if;

  select * into ticket_row
  from public.tickets
  where id = p_ticket_id
  for update;
  if ticket_row.id is null then raise exception 'Ticket not found'; end if;

  if public.has_any_app_role(array['ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role]) then
    null;
  elsif public.has_any_app_role(array['EVENT_STAFF'::public.app_role, 'VENUE_MANAGER'::public.app_role]) then
    null;
  elsif public.has_any_app_role(array['ORGANIZER'::public.app_role]) then
    select e.organizer_id into organizer_id
    from public.ticket_types tt
    join public.events e on e.id = tt.event_id
    where tt.id = ticket_row.ticket_type_id;
    if organizer_id is distinct from auth.uid() then
      raise exception 'Organizer is not authorized for this event';
    end if;
  end if;

  if ticket_row.status = 'CHECKED_IN' then
    return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'already_checked_in', 'checked_in_at', ticket_row.checked_in_at);
  end if;
  if ticket_row.status not in ('ISSUED', 'ACTIVE') then raise exception 'Ticket is not valid for check-in'; end if;

  update public.tickets set status = 'CHECKED_IN', checked_in_at = now() where id = ticket_row.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'ticket.checked_in', 'ticket', ticket_row.id, jsonb_build_object('previous_status', ticket_row.status));
  return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'checked_in', 'checked_in_at', now());
end;
$$;

create or replace function public.check_in_ticket_with_token(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row public.tickets%rowtype;
  token_hash text;
  organizer_id uuid;
begin
  if not public.has_any_app_role(array[
    'EVENT_STAFF'::public.app_role,
    'VENUE_MANAGER'::public.app_role,
    'ORGANIZER'::public.app_role,
    'ADMIN'::public.app_role,
    'SUPER_ADMIN'::public.app_role
  ]) then
    raise exception 'You are not authorized to check in tickets';
  end if;

  if nullif(trim(p_qr_token), '') is null then
    raise exception 'QR token is required';
  end if;

  token_hash := encode(digest(trim(p_qr_token), 'sha256'), 'hex');
  select * into ticket_row
  from public.tickets
  where qr_token_hash = token_hash
  for update;
  if ticket_row.id is null then raise exception 'Ticket QR token is invalid or expired'; end if;

  if public.has_any_app_role(array['ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role]) then
    null;
  elsif public.has_any_app_role(array['EVENT_STAFF'::public.app_role, 'VENUE_MANAGER'::public.app_role]) then
    null;
  elsif public.has_any_app_role(array['ORGANIZER'::public.app_role]) then
    select e.organizer_id into organizer_id
    from public.ticket_types tt
    join public.events e on e.id = tt.event_id
    where tt.id = ticket_row.ticket_type_id;
    if organizer_id is distinct from auth.uid() then
      raise exception 'Organizer is not authorized for this event';
    end if;
  end if;

  if ticket_row.status = 'CHECKED_IN' then
    return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'already_checked_in', 'checked_in_at', ticket_row.checked_in_at);
  end if;
  if ticket_row.status not in ('ISSUED','ACTIVE') then raise exception 'Ticket is not valid for check-in'; end if;

  update public.tickets set status = 'CHECKED_IN', checked_in_at = now() where id = ticket_row.id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'ticket.checked_in', 'ticket', ticket_row.id, jsonb_build_object('previous_status', ticket_row.status, 'via', 'qr_token'));

  return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'checked_in', 'checked_in_at', now());
end;
$$;

revoke all on function public.check_in_ticket(uuid) from public;
revoke all on function public.check_in_ticket_with_token(text) from public;
grant execute on function public.check_in_ticket(uuid) to authenticated;
grant execute on function public.check_in_ticket_with_token(text) to authenticated;
