-- Atizzy Admin operations: separate from Super Admin platform configuration.
create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('EVENT','ARTIST','VENUE','USER')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  status text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')),
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists moderation_reports_status_idx on public.moderation_reports(status, created_at desc);
create index if not exists moderation_reports_target_idx on public.moderation_reports(target_type, target_id);
alter table public.moderation_reports enable row level security;
drop policy if exists "users create own moderation reports" on public.moderation_reports;
drop policy if exists "users view own moderation reports" on public.moderation_reports;
drop policy if exists "admins manage moderation reports" on public.moderation_reports;
create policy "users create own moderation reports" on public.moderation_reports for insert with check (reporter_id = auth.uid());
create policy "users view own moderation reports" on public.moderation_reports for select using (reporter_id = auth.uid());
create policy "admins manage moderation reports" on public.moderation_reports for all using (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role])) with check (public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]));

create or replace function public.admin_dashboard_snapshot()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.has_role('ADMIN'::public.app_role) then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'events_total', (select count(*) from public.events),
    'events_pending_review', (select count(*) from public.events where status='PENDING_REVIEW'),
    'events_published', (select count(*) from public.events where status in ('PUBLISHED','LIVE')),
    'open_reports', (select count(*) from public.moderation_reports where status in ('OPEN','IN_REVIEW')),
    'successful_payments', (select count(*) from public.payments where status='VERIFIED_SUCCESS'),
    'failed_payments', (select count(*) from public.payments where status in ('FAILED','EXPIRED')),
    'ticket_revenue', coalesce((select sum(amount) from public.payments where status='VERIFIED_SUCCESS'),0),
    'venue_revenue', coalesce((select sum(amount) from public.venue_booking_payments where status='SUCCESS'),0),
    'checked_in', (select count(*) from public.tickets where status='CHECKED_IN')
  ) into result;
  return result;
end; $$;
revoke all on function public.admin_dashboard_snapshot() from public;
grant execute on function public.admin_dashboard_snapshot() to authenticated;

create or replace function public.admin_list_users(p_search text default null)
returns table(user_id uuid,email text,full_name text,created_at timestamptz,last_sign_in_at timestamptz,roles text[])
language sql security definer set search_path = public, auth as $$
  select u.id,u.email,up.full_name,u.created_at,u.last_sign_in_at,
    coalesce(array_agg(r.code::text order by r.code) filter (where r.code is not null),'{}')
  from auth.users u
  left join public.user_profiles up on up.id=u.id
  left join public.user_roles ur on ur.user_id=u.id
  left join public.roles r on r.id=ur.role_id
  where auth.uid() is not null and public.has_role('ADMIN'::public.app_role)
    and (p_search is null or trim(p_search)='' or lower(coalesce(u.email,'') || ' ' || coalesce(up.full_name,'')) like '%' || lower(trim(p_search)) || '%')
  group by u.id,u.email,up.full_name,u.created_at,u.last_sign_in_at
  order by u.created_at desc limit 100;
$$;
revoke all on function public.admin_list_users(text) from public;
grant execute on function public.admin_list_users(text) to authenticated;

create or replace function public.admin_suspend_user(p_user_id uuid,p_suspend boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare until_at timestamptz;
begin
  if auth.uid() is null or not public.has_role('ADMIN'::public.app_role) then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() then raise exception 'Admins cannot suspend themselves'; end if;
  if public.has_role('SUPER_ADMIN'::public.app_role) and p_user_id is not null then
    if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id and r.code='SUPER_ADMIN') then raise exception 'Super Admin accounts are protected'; end if;
  end if;
  until_at := case when p_suspend then now() + interval '100 years' else null end;
  update auth.users set banned_until=until_at where id=p_user_id;
  if not found then raise exception 'User not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_suspend then 'admin.user.suspended' else 'admin.user.reinstated' end,'USER',p_user_id,jsonb_build_object('reason',nullif(trim(p_reason),'')));
  return jsonb_build_object('user_id',p_user_id,'suspended',p_suspend);
end; $$;
revoke all on function public.admin_suspend_user(uuid,boolean,text) from public;
grant execute on function public.admin_suspend_user(uuid,boolean,text) to authenticated;

create or replace function public.admin_review_event(p_event_id uuid,p_status public.event_status,p_note text default null)
returns public.events language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  if auth.uid() is null or not public.has_role('ADMIN'::public.app_role) then raise exception 'Admin access required'; end if;
  if p_status not in ('APPROVED'::public.event_status,'CHANGES_REQUESTED'::public.event_status,'REJECTED'::public.event_status) then raise exception 'Admin can only approve, request changes, or reject events'; end if;
  update public.events set status=p_status,updated_at=now() where id=p_event_id returning * into e;
  if not found then raise exception 'Event not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'admin.event.reviewed','EVENT',p_event_id,jsonb_build_object('status',p_status::text,'note',nullif(trim(p_note),'')));
  return e;
end; $$;
revoke all on function public.admin_review_event(uuid,public.event_status,text) from public;
grant execute on function public.admin_review_event(uuid,public.event_status,text) to authenticated;

create or replace function public.admin_update_report(p_report_id uuid,p_status text,p_resolution_note text default null)
returns public.moderation_reports language plpgsql security definer set search_path = public as $$
declare r public.moderation_reports;
begin
  if auth.uid() is null or not public.has_role('ADMIN'::public.app_role) then raise exception 'Admin access required'; end if;
  if p_status not in ('IN_REVIEW','RESOLVED','DISMISSED') then raise exception 'Invalid report status'; end if;
  update public.moderation_reports set status=p_status,resolution_note=nullif(trim(p_resolution_note),''),resolved_by=case when p_status in ('RESOLVED','DISMISSED') then auth.uid() else null end,resolved_at=case when p_status in ('RESOLVED','DISMISSED') then now() else null end,updated_at=now() where id=p_report_id returning * into r;
  if not found then raise exception 'Report not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'admin.report.updated','MODERATION_REPORT',p_report_id,jsonb_build_object('status',p_status,'resolution_note',nullif(trim(p_resolution_note),'')));
  return r;
end; $$;
revoke all on function public.admin_update_report(uuid,text,text) from public;
grant execute on function public.admin_update_report(uuid,text,text) to authenticated;

create or replace function public.admin_payment_support_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role('ADMIN'::public.app_role) then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'ticket_payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from (select id,order_id,provider,provider_reference,status,amount,currency,created_at from public.payments order by created_at desc limit 50) p),'[]'::jsonb),
    'venue_payments', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select id,booking_id,status,amount,currency,provider_reference,created_at from public.venue_booking_payments order by created_at desc limit 50) v),'[]'::jsonb)
  );
end; $$;
revoke all on function public.admin_payment_support_snapshot() from public;
grant execute on function public.admin_payment_support_snapshot() to authenticated;

create or replace function public.admin_recent_audit_logs()
returns setof public.audit_logs language sql security definer set search_path = public as $$
  select * from public.audit_logs where auth.uid() is not null and public.has_role('ADMIN'::public.app_role) order by created_at desc limit 100;
$$;
revoke all on function public.admin_recent_audit_logs() from public;
grant execute on function public.admin_recent_audit_logs() to authenticated;
