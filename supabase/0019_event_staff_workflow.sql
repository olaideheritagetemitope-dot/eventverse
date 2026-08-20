-- Event Staff: assignment-scoped operational access, Organizer management, and RLS.

create table if not exists public.event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  responsibility text not null default 'GENERAL',
  instructions text,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','REVOKED')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, staff_user_id)
);

create table if not exists public.event_staff_tasks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.event_staff_assignments(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','DONE')),
  due_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_staff_notifications (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.event_staff_assignments(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists event_staff_assignments_user_idx on public.event_staff_assignments(staff_user_id, status);
create index if not exists event_staff_assignments_event_idx on public.event_staff_assignments(event_id, status);
create index if not exists event_staff_tasks_assignment_idx on public.event_staff_tasks(assignment_id, status);
create index if not exists event_staff_notifications_assignment_idx on public.event_staff_notifications(assignment_id, read_at);

alter table public.event_staff_assignments enable row level security;
alter table public.event_staff_tasks enable row level security;
alter table public.event_staff_notifications enable row level security;

create or replace function public.event_staff_can_operate(p_event_id uuid, p_user_id uuid default auth.uid())
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
  );
$$;

create or replace function public.event_staff_is_event_owner(p_event_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.organizer_id = p_user_id
  );
$$;

create policy "staff view own assignments" on public.event_staff_assignments
for select using (auth.uid() = staff_user_id or public.event_staff_is_event_owner(event_id) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "staff view own tasks" on public.event_staff_tasks
for select using (exists (select 1 from public.event_staff_assignments a where a.id = assignment_id and (a.staff_user_id = auth.uid() or public.event_staff_is_event_owner(a.event_id))) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));
create policy "staff view own notifications" on public.event_staff_notifications
for select using (exists (select 1 from public.event_staff_assignments a where a.id = assignment_id and (a.staff_user_id = auth.uid() or public.event_staff_is_event_owner(a.event_id))) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));

create or replace function public.search_event_staff_users(p_query text default '')
returns table (id uuid, full_name text, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_app_role(array['ORGANIZER'::public.app_role,'ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Organizer access is required';
  end if;
  return query
  select p.id, coalesce(p.full_name, 'Atizzy user') as full_name, u.email
  from public.user_profiles p
  join auth.users u on u.id = p.id
  where nullif(trim(p_query), '') is null
     or lower(coalesce(p.full_name, '') || ' ' || coalesce(u.email, '')) like '%' || lower(trim(p_query)) || '%'
  order by p.full_name nulls last, u.email
  limit 20;
end;
$$;

create or replace function public.assign_event_staff(p_event_id uuid, p_staff_user_id uuid, p_responsibility text default 'GENERAL', p_instructions text default null)
returns public.event_staff_assignments
language plpgsql
security definer
set search_path = public
as $$
declare result public.event_staff_assignments;
begin
  if not public.event_staff_is_event_owner(p_event_id) and not public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Only the event owner can assign staff';
  end if;
  if p_staff_user_id is null or not exists (select 1 from auth.users where id = p_staff_user_id) then
    raise exception 'Staff user not found';
  end if;
  insert into public.user_roles(user_id, role_id)
  select p_staff_user_id, r.id from public.roles r where r.code = 'EVENT_STAFF'::public.app_role
  on conflict do nothing;
  insert into public.event_staff_assignments(event_id, staff_user_id, assigned_by, responsibility, instructions)
  values (p_event_id, p_staff_user_id, auth.uid(), upper(coalesce(nullif(trim(p_responsibility), ''), 'GENERAL')), nullif(trim(p_instructions), ''))
  on conflict (event_id, staff_user_id) do update set responsibility = excluded.responsibility, instructions = excluded.instructions, status = 'PENDING', updated_at = now()
  returning * into result;
  insert into public.event_staff_notifications(assignment_id, message)
  values (result.id, 'You have a new Event Staff assignment. Review the event instructions and accept the assignment.');
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event_staff.assigned', 'event_staff_assignment', result.id, jsonb_build_object('event_id', p_event_id, 'staff_user_id', p_staff_user_id, 'responsibility', result.responsibility));
  return result;
end;
$$;

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
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'event_id', a.event_id, 'staff_user_id', a.staff_user_id, 'full_name', p.full_name, 'responsibility', a.responsibility, 'instructions', a.instructions, 'status', a.status, 'created_at', a.created_at, 'tasks', (select count(*) from public.event_staff_tasks t where t.assignment_id = a.id and t.status <> 'DONE')) order by a.created_at desc)
    from public.event_staff_assignments a join public.user_profiles p on p.id = a.staff_user_id where a.event_id = p_event_id), '[]'::jsonb);
end;
$$;

create or replace function public.get_event_staff_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_app_role(array['EVENT_STAFF'::public.app_role]) then raise exception 'Event Staff access is required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('assignment_id', a.id, 'event_id', e.id, 'event_title', e.title, 'event_status', e.status, 'city', e.city, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'venue_id', e.venue_id, 'venue_name', v.name, 'venue_address', v.address, 'responsibility', a.responsibility, 'instructions', a.instructions, 'assignment_status', a.status, 'tickets_checked_in', (select count(*) from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where tt.event_id = e.id and t.status = 'CHECKED_IN'), 'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'description', t.description, 'status', t.status, 'due_at', t.due_at) order by t.created_at desc) from public.event_staff_tasks t where t.assignment_id = a.id), '[]'::jsonb), 'notifications', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'message', n.message, 'read_at', n.read_at, 'created_at', n.created_at) order by n.created_at desc) from public.event_staff_notifications n where n.assignment_id = a.id), '[]'::jsonb)) order by e.starts_at)
    from public.event_staff_assignments a join public.events e on e.id = a.event_id left join public.venues v on v.id = e.venue_id where a.staff_user_id = auth.uid()), '[]'::jsonb);
end;
$$;

create or replace function public.respond_event_staff_assignment(p_assignment_id uuid, p_status text)
returns public.event_staff_assignments
language plpgsql
security definer
set search_path = public
as $$
declare result public.event_staff_assignments;
begin
  if upper(p_status) not in ('ACCEPTED','DECLINED') then raise exception 'Invalid assignment response'; end if;
  update public.event_staff_assignments set status = upper(p_status), accepted_at = case when upper(p_status) = 'ACCEPTED' then now() else null end, updated_at = now()
  where id = p_assignment_id and staff_user_id = auth.uid() and status = 'PENDING'
  returning * into result;
  if result.id is null then raise exception 'Assignment not found or no longer actionable'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'event_staff.assignment_' || lower(p_status), 'event_staff_assignment', result.id, '{}'::jsonb);
  return result;
end;
$$;

create or replace function public.revoke_event_staff_assignment(p_assignment_id uuid)
returns public.event_staff_assignments
language plpgsql
security definer
set search_path = public
as $$
declare result public.event_staff_assignments;
begin
  update public.event_staff_assignments a set status = 'REVOKED', updated_at = now()
  where a.id = p_assignment_id and (public.event_staff_is_event_owner(a.event_id) or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]))
  returning a.* into result;
  if result.id is null then raise exception 'Assignment not found or not authorized'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'event_staff.revoked', 'event_staff_assignment', result.id, jsonb_build_object('event_id', result.event_id));
  return result;
end;
$$;

create or replace function public.acknowledge_event_staff_task(p_task_id uuid, p_status text default 'ACKNOWLEDGED')
returns public.event_staff_tasks
language plpgsql
security definer
set search_path = public
as $$
declare result public.event_staff_tasks;
begin
  if upper(p_status) not in ('ACKNOWLEDGED','DONE') then raise exception 'Invalid task status'; end if;
  update public.event_staff_tasks t set status = upper(p_status), acknowledged_at = case when upper(p_status) in ('ACKNOWLEDGED','DONE') then coalesce(acknowledged_at, now()) else acknowledged_at end, completed_at = case when upper(p_status) = 'DONE' then now() else completed_at end
  where t.id = p_task_id and exists (select 1 from public.event_staff_assignments a where a.id = t.assignment_id and a.staff_user_id = auth.uid() and a.status = 'ACCEPTED')
  returning t.* into result;
  if result.id is null then raise exception 'Task not found or not authorized'; end if;
  return result;
end;
$$;

create or replace function public.mark_event_staff_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_staff_notifications n set read_at = coalesce(read_at, now()) where n.id = p_notification_id and exists (select 1 from public.event_staff_assignments a where a.id = n.assignment_id and a.staff_user_id = auth.uid());
  return found;
end;
$$;

-- Replace broad Event Staff check-in access with assignment-scoped authorization.
create or replace function public.check_in_ticket(p_ticket_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ticket_row public.tickets%rowtype; event_id uuid; begin
  select tt.event_id into event_id from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where t.id = p_ticket_id;
  if not (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) or public.event_staff_can_operate(event_id) or (public.has_any_app_role(array['ORGANIZER'::public.app_role]) and exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) or (public.has_any_app_role(array['VENUE_MANAGER'::public.app_role]) and exists(select 1 from public.events e join public.venues v on v.id = e.venue_id where e.id = event_id and v.owner_id = auth.uid()))) then raise exception 'You are not authorized to check in this event'; end if;
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
declare token_hash text; ticket_id uuid; event_id uuid; begin
  if nullif(trim(p_qr_token), '') is null then raise exception 'QR token is required'; end if;
  token_hash := encode(digest(trim(p_qr_token), 'sha256'), 'hex');
  select t.id, tt.event_id into ticket_id, event_id from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id where t.qr_token_hash = token_hash;
  if ticket_id is null then raise exception 'Ticket QR token is invalid or expired'; end if;
  if not (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) or public.event_staff_can_operate(event_id) or (public.has_any_app_role(array['ORGANIZER'::public.app_role]) and exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) or (public.has_any_app_role(array['VENUE_MANAGER'::public.app_role]) and exists(select 1 from public.events e join public.venues v on v.id = e.venue_id where e.id = event_id and v.owner_id = auth.uid()))) then raise exception 'You are not authorized to check in this event'; end if;
  return public.check_in_ticket(ticket_id);
end; $$;

revoke all on function public.event_staff_can_operate(uuid, uuid) from public;
grant execute on function public.event_staff_can_operate(uuid, uuid) to authenticated;
revoke all on function public.event_staff_is_event_owner(uuid, uuid) from public;
grant execute on function public.event_staff_is_event_owner(uuid, uuid) to authenticated;
revoke all on function public.search_event_staff_users(text) from public;
grant execute on function public.search_event_staff_users(text) to authenticated;
revoke all on function public.assign_event_staff(uuid, uuid, text, text) from public;
grant execute on function public.assign_event_staff(uuid, uuid, text, text) to authenticated;
revoke all on function public.list_event_staff_for_organizer(uuid) from public;
grant execute on function public.list_event_staff_for_organizer(uuid) to authenticated;
revoke all on function public.get_event_staff_workspace() from public;
grant execute on function public.get_event_staff_workspace() to authenticated;
revoke all on function public.respond_event_staff_assignment(uuid, text) from public;
grant execute on function public.respond_event_staff_assignment(uuid, text) to authenticated;
revoke all on function public.revoke_event_staff_assignment(uuid) from public;
grant execute on function public.revoke_event_staff_assignment(uuid) to authenticated;
revoke all on function public.acknowledge_event_staff_task(uuid, text) from public;
grant execute on function public.acknowledge_event_staff_task(uuid, text) to authenticated;
revoke all on function public.mark_event_staff_notification_read(uuid) from public;
grant execute on function public.mark_event_staff_notification_read(uuid) to authenticated;
revoke all on function public.check_in_ticket(uuid) from public;
grant execute on function public.check_in_ticket(uuid) to authenticated;
revoke all on function public.check_in_ticket_with_token(text) from public;
grant execute on function public.check_in_ticket_with_token(text) to authenticated;
