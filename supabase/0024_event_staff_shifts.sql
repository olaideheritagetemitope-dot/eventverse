alter table public.event_staff_assignments
  add column if not exists shift_starts_at timestamptz,
  add column if not exists shift_ends_at timestamptz,
  add column if not exists shift_note text;

alter table public.event_staff_assignments
  drop constraint if exists event_staff_shift_order_check;

alter table public.event_staff_assignments
  add constraint event_staff_shift_order_check check (shift_ends_at is null or shift_starts_at is null or shift_ends_at > shift_starts_at);

create or replace function public.update_event_staff_shift(
  p_assignment_id uuid,
  p_shift_starts_at timestamptz default null,
  p_shift_ends_at timestamptz default null,
  p_shift_note text default null
)
returns public.event_staff_assignments
language plpgsql
security definer
set search_path = public
as $$
declare result public.event_staff_assignments;
begin
  if p_shift_ends_at is not null and p_shift_starts_at is not null and p_shift_ends_at <= p_shift_starts_at then
    raise exception 'Shift end must be after shift start';
  end if;
  update public.event_staff_assignments a
  set shift_starts_at = p_shift_starts_at,
      shift_ends_at = p_shift_ends_at,
      shift_note = nullif(trim(p_shift_note), ''),
      updated_at = now()
  where a.id = p_assignment_id
    and (public.event_staff_is_event_owner(a.event_id) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
  if not found then raise exception 'Only the event owner can schedule staff shifts'; end if;
  select * into result from public.event_staff_assignments where id = p_assignment_id;
  insert into public.event_staff_notifications(assignment_id, message)
  values (result.id, 'Your Event Staff shift schedule has been updated.');
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event_staff.shift_updated', 'event_staff_assignment', result.id, jsonb_build_object('shift_starts_at', result.shift_starts_at, 'shift_ends_at', result.shift_ends_at));
  return result;
end; $$;

create or replace function public.list_event_staff_for_organizer(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.event_staff_is_event_owner(p_event_id) and not public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Only the event owner can view staff';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'event_id', a.event_id, 'staff_user_id', a.staff_user_id, 'full_name', p.full_name, 'responsibility', a.responsibility, 'instructions', a.instructions, 'shift_starts_at', a.shift_starts_at, 'shift_ends_at', a.shift_ends_at, 'shift_note', a.shift_note, 'status', a.status, 'created_at', a.created_at, 'tasks', (select count(*) from public.event_staff_tasks t where t.assignment_id = a.id and t.status <> 'DONE')) order by a.created_at desc)
    from public.event_staff_assignments a join public.user_profiles p on p.id = a.staff_user_id where a.event_id = p_event_id), '[]'::jsonb);
end; $$;

create or replace function public.get_event_staff_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_app_role(array['EVENT_STAFF'::public.app_role]) then raise exception 'Event Staff access is required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('assignment_id', a.id, 'event_id', e.id, 'event_title', e.title, 'event_status', e.status, 'city', e.city, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'venue_id', e.venue_id, 'venue_name', v.name, 'venue_address', v.address, 'responsibility', a.responsibility, 'instructions', a.instructions, 'shift_starts_at', a.shift_starts_at, 'shift_ends_at', a.shift_ends_at, 'shift_note', a.shift_note, 'assignment_status', a.status, 'tickets_checked_in', (select count(*) from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where tt.event_id = e.id and t.status = 'CHECKED_IN'), 'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'description', t.description, 'status', t.status, 'due_at', t.due_at) order by t.created_at desc) from public.event_staff_tasks t where t.assignment_id = a.id), '[]'::jsonb), 'notifications', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'message', n.message, 'read_at', n.read_at, 'created_at', n.created_at) order by n.created_at desc) from public.event_staff_notifications n where n.assignment_id = a.id), '[]'::jsonb)) order by e.starts_at)
    from public.event_staff_assignments a join public.events e on e.id = a.event_id left join public.venues v on v.id = e.venue_id where a.staff_user_id = auth.uid()), '[]'::jsonb);
end; $$;

revoke all on function public.update_event_staff_shift(uuid,timestamptz,timestamptz,text) from public;
grant execute on function public.update_event_staff_shift(uuid,timestamptz,timestamptz,text) to authenticated;
