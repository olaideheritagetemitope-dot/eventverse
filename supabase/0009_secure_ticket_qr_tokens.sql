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

  qr_token := replace(gen_random_uuid()::text || '-' || gen_random_uuid()::text, '-', '');
  update public.tickets
  set qr_token_hash = encode(digest(qr_token, 'sha256'), 'hex')
  where id = ticket_row.id;

  return jsonb_build_object(
    'ticket_id', ticket_row.id,
    'qr_token', qr_token,
    'status', ticket_row.status
  );
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
begin
  if not public.has_any_app_role(array['EVENT_STAFF'::public.app_role,'VENUE_MANAGER'::public.app_role,'ORGANIZER'::public.app_role,'ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
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

  if ticket_row.id is null then
    raise exception 'Ticket QR token is invalid or expired';
  end if;

  if ticket_row.status = 'CHECKED_IN' then
    return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'already_checked_in', 'checked_in_at', ticket_row.checked_in_at);
  end if;

  if ticket_row.status not in ('ISSUED','ACTIVE') then
    raise exception 'Ticket is not valid for check-in';
  end if;

  update public.tickets
  set status = 'CHECKED_IN', checked_in_at = now()
  where id = ticket_row.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'ticket.checked_in', 'ticket', ticket_row.id, jsonb_build_object('previous_status', ticket_row.status, 'via', 'qr_token'));

  return jsonb_build_object('ticket_id', ticket_row.id, 'status', 'checked_in', 'checked_in_at', now());
end;
$$;

revoke all on function public.issue_ticket_qr_token(uuid) from public;
revoke all on function public.check_in_ticket_with_token(text) from public;
grant execute on function public.issue_ticket_qr_token(uuid) to authenticated;
grant execute on function public.check_in_ticket_with_token(text) to authenticated;
