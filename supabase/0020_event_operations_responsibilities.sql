-- Responsibility-aware Event Staff operations. No new global role is introduced.

alter table public.event_staff_assignments
  drop constraint if exists event_staff_assignments_responsibility_check;

alter table public.event_staff_assignments
  add constraint event_staff_assignments_responsibility_check
  check (responsibility in ('GENERAL','CHECK_IN','REGISTRATION','SECURITY_GATE','EVENT_OPERATIONS'));

create or replace function public.event_staff_can_check_in(p_event_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_staff_assignments a
    where a.event_id = p_event_id
      and a.staff_user_id = p_user_id
      and a.status = 'ACCEPTED'
      and a.responsibility in ('CHECK_IN','REGISTRATION','SECURITY_GATE')
  );
$$;

create or replace function public.assign_event_staff(p_event_id uuid, p_staff_user_id uuid, p_responsibility text default 'GENERAL', p_instructions text default null)
returns public.event_staff_assignments
language plpgsql
security definer
set search_path = public
as $$
declare result public.event_staff_assignments; normalized text;
begin
  if not public.event_staff_is_event_owner(p_event_id) and not public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Only the event owner can assign staff';
  end if;
  normalized := upper(coalesce(nullif(trim(p_responsibility), ''), 'GENERAL'));
  if normalized not in ('GENERAL','CHECK_IN','REGISTRATION','SECURITY_GATE','EVENT_OPERATIONS') then
    raise exception 'Unsupported Event Staff responsibility';
  end if;
  if p_staff_user_id is null or not exists (select 1 from auth.users where id = p_staff_user_id) then
    raise exception 'Staff user not found';
  end if;
  insert into public.user_roles(user_id, role_id)
  select p_staff_user_id, r.id from public.roles r where r.code = 'EVENT_STAFF'::public.app_role
  on conflict do nothing;
  insert into public.event_staff_assignments(event_id, staff_user_id, assigned_by, responsibility, instructions)
  values (p_event_id, p_staff_user_id, auth.uid(), normalized, nullif(trim(p_instructions), ''))
  on conflict (event_id, staff_user_id) do update set responsibility = excluded.responsibility, instructions = excluded.instructions, status = 'PENDING', updated_at = now()
  returning * into result;
  insert into public.event_staff_notifications(assignment_id, message)
  values (result.id, 'You have a new ' || replace(result.responsibility, '_', ' ') || ' assignment. Review the event instructions and accept the assignment.');
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event_staff.assigned', 'event_staff_assignment', result.id, jsonb_build_object('event_id', p_event_id, 'staff_user_id', p_staff_user_id, 'responsibility', result.responsibility));
  return result;
end;
$$;

create or replace function public.event_staff_entry_decision(p_qr_token text, p_decision text default 'ACCEPT')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare token_hash text; ticket_id uuid; event_id uuid; ticket_row public.tickets%rowtype; decision text;
begin
  decision := upper(coalesce(nullif(trim(p_decision), ''), 'ACCEPT'));
  if decision not in ('ACCEPT','REJECT') then raise exception 'Entry decision must be ACCEPT or REJECT'; end if;
  if nullif(trim(p_qr_token), '') is null then
    return jsonb_build_object('decision','REJECT','reason','INVALID_TOKEN','message','A QR token is required');
  end if;
  token_hash := encode(digest(trim(p_qr_token), 'sha256'), 'hex');
  select t.id, tt.event_id into ticket_id, event_id
  from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.qr_token_hash = token_hash;
  if ticket_id is null then
    insert into public.audit_logs(actor_id, action, entity_type, metadata) values (auth.uid(), 'event_staff.entry_rejected', 'ticket', jsonb_build_object('reason','INVALID_TOKEN'));
    return jsonb_build_object('decision','REJECT','reason','INVALID_TOKEN','message','Ticket QR token is invalid or expired');
  end if;
  if not public.event_staff_can_check_in(event_id) then raise exception 'This assignment does not permit ticket entry decisions'; end if;
  select * into ticket_row from public.tickets where id = ticket_id for update;
  if ticket_row.status = 'CHECKED_IN' then
    return jsonb_build_object('decision','REJECT','reason','ALREADY_USED','ticket_id',ticket_id,'message','Ticket has already been used');
  end if;
  if ticket_row.status not in ('ISSUED','ACTIVE') then
    return jsonb_build_object('decision','REJECT','reason','INVALID_STATUS','ticket_id',ticket_id,'message','Ticket is not valid for entry');
  end if;
  if decision = 'REJECT' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'event_staff.entry_rejected', 'ticket', ticket_id, jsonb_build_object('event_id', event_id, 'reason','STAFF_REJECTED'));
    return jsonb_build_object('decision','REJECT','reason','STAFF_REJECTED','ticket_id',ticket_id,'message','Entry rejected by Event Staff');
  end if;
  update public.tickets set status = 'CHECKED_IN', checked_in_at = now() where id = ticket_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'event_staff.entry_accepted', 'ticket', ticket_id, jsonb_build_object('event_id', event_id, 'attendance_recorded', true));
  return jsonb_build_object('decision','ACCEPT','reason','VALID_ENTRY','ticket_id',ticket_id,'status','checked_in','checked_in_at',now(),'attendance_recorded',true);
end;
$$;

create or replace function public.check_in_ticket(p_ticket_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ticket_row public.tickets%rowtype; event_id uuid;
begin
  select tt.event_id into event_id from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where t.id = p_ticket_id;
  if not (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) or public.event_staff_can_check_in(event_id) or (public.has_any_app_role(array['ORGANIZER'::public.app_role]) and exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) or (public.has_any_app_role(array['VENUE_MANAGER'::public.app_role]) and exists(select 1 from public.events e join public.venues v on v.id = e.venue_id where e.id = event_id and v.owner_id = auth.uid()))) then raise exception 'You are not authorized to check in this event'; end if;
  select * into ticket_row from public.tickets where id = p_ticket_id for update;
  if ticket_row.id is null then raise exception 'Ticket not found'; end if;
  if ticket_row.status = 'CHECKED_IN' then return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'already_checked_in', 'checked_in_at', ticket_row.checked_in_at); end if;
  if ticket_row.status not in ('ISSUED','ACTIVE') then raise exception 'Ticket is not valid for check-in'; end if;
  update public.tickets set status = 'CHECKED_IN', checked_in_at = now() where id = ticket_row.id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'ticket.checked_in', 'ticket', ticket_row.id, jsonb_build_object('previous_status', ticket_row.status, 'event_id', event_id));
  return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'checked_in', 'checked_in_at', now());
end; $$;

create or replace function public.check_in_ticket_with_token(p_qr_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare token_hash text; ticket_id uuid; event_id uuid;
begin
  if nullif(trim(p_qr_token), '') is null then raise exception 'QR token is required'; end if;
  token_hash := encode(digest(trim(p_qr_token), 'sha256'), 'hex');
  select t.id, tt.event_id into ticket_id, event_id from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where t.qr_token_hash = token_hash;
  if ticket_id is null then raise exception 'Ticket QR token is invalid or expired'; end if;
  if not (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) or public.event_staff_can_check_in(event_id) or (public.has_any_app_role(array['ORGANIZER'::public.app_role]) and exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) or (public.has_any_app_role(array['VENUE_MANAGER'::public.app_role]) and exists(select 1 from public.events e join public.venues v on v.id = e.venue_id where e.id = event_id and v.owner_id = auth.uid()))) then raise exception 'You are not authorized to check in this event'; end if;
  return public.check_in_ticket(ticket_id);
end; $$;

revoke all on function public.event_staff_can_check_in(uuid, uuid) from public;
grant execute on function public.event_staff_can_check_in(uuid, uuid) to authenticated;
revoke all on function public.event_staff_entry_decision(text, text) from public;
grant execute on function public.event_staff_entry_decision(text, text) to authenticated;
revoke all on function public.check_in_ticket(uuid) from public;
grant execute on function public.check_in_ticket(uuid) to authenticated;
revoke all on function public.check_in_ticket_with_token(text) from public;
grant execute on function public.check_in_ticket_with_token(text) to authenticated;
