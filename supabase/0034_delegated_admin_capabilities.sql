-- Atizzy delegated Admin capabilities
-- Super Admin retains universal authority; Admin authority is permission-grant based.

create table if not exists public.admin_permission_grants (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique (admin_user_id, permission_code)
);

create index if not exists admin_permission_grants_admin_idx on public.admin_permission_grants(admin_user_id, revoked_at, expires_at);
alter table public.admin_permission_grants enable row level security;

drop policy if exists "admins view own capability grants" on public.admin_permission_grants;
create policy "admins view own capability grants" on public.admin_permission_grants
  for select using (admin_user_id = auth.uid() or public.has_app_role('SUPER_ADMIN'::public.app_role));

create or replace function public.has_admin_permission(p_permission_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.has_app_role('SUPER_ADMIN'::public.app_role)
    or (
      public.has_app_role('ADMIN'::public.app_role)
      and exists (
        select 1 from public.admin_permission_grants g
        where g.admin_user_id = auth.uid()
          and g.permission_code = p_permission_code
          and g.revoked_at is null
          and (g.expires_at is null or g.expires_at > now())
      )
    )
  );
$$;
revoke all on function public.has_admin_permission(text) from public;
grant execute on function public.has_admin_permission(text) to authenticated;

create or replace function public.list_admin_permission_grants(p_admin_user_id uuid default null)
returns table(id uuid, admin_user_id uuid, permission_code text, granted_by uuid, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id,g.admin_user_id,g.permission_code,g.granted_by,g.created_at,g.expires_at,g.revoked_at
  from public.admin_permission_grants g
  where auth.uid() is not null
    and (public.has_app_role('SUPER_ADMIN'::public.app_role) or g.admin_user_id = auth.uid())
    and (p_admin_user_id is null or g.admin_user_id = p_admin_user_id)
  order by g.created_at desc
  limit 200;
$$;
revoke all on function public.list_admin_permission_grants(uuid) from public;
grant execute on function public.list_admin_permission_grants(uuid) to authenticated;

create or replace function public.set_admin_permission(p_admin_user_id uuid, p_permission_code text, p_granted boolean, p_expires_at timestamptz default null)
returns public.admin_permission_grants
language plpgsql security definer set search_path = public as $$
declare result public.admin_permission_grants;
begin
  if auth.uid() is null or not public.has_app_role('SUPER_ADMIN'::public.app_role) then raise exception 'Super Admin access required'; end if;
  if not exists (select 1 from public.roles r join public.user_roles ur on ur.role_id=r.id where ur.user_id=p_admin_user_id and r.code='ADMIN'::public.app_role) then raise exception 'Target user must have the Admin role'; end if;
  if not exists (select 1 from public.permissions p where p.code=p_permission_code) then raise exception 'Unknown permission'; end if;
  insert into public.admin_permission_grants(admin_user_id,permission_code,granted_by,expires_at,revoked_at)
  values(p_admin_user_id,p_permission_code,auth.uid(),p_expires_at,case when p_granted then null else now() end)
  on conflict (admin_user_id,permission_code) do update set granted_by=excluded.granted_by,expires_at=excluded.expires_at,revoked_at=excluded.revoked_at
  returning * into result;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),case when p_granted then 'admin.permission.granted' else 'admin.permission.revoked' end,'ADMIN_PERMISSION',result.id,jsonb_build_object('admin_user_id',p_admin_user_id,'permission_code',p_permission_code,'expires_at',p_expires_at));
  return result;
end; $$;
revoke all on function public.set_admin_permission(uuid,text,boolean,timestamptz) from public;
grant execute on function public.set_admin_permission(uuid,text,boolean,timestamptz) to authenticated;

create or replace function public.role_capability_matrix()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('role',r.code,'label',r.label,'permissions',coalesce(perms.permissions,'[]'::jsonb)) order by r.code),'[]'::jsonb)
  from public.roles r
  left join lateral (
    select jsonb_agg(p.code order by p.code) as permissions
    from public.role_permissions rp join public.permissions p on p.id=rp.permission_id
    where rp.role_id=r.id
  ) perms on true;
$$;
revoke all on function public.role_capability_matrix() from public;
grant execute on function public.role_capability_matrix() to authenticated;

-- Seed the canonical permission catalog into role mappings. These mappings document baseline capability; ownership and RPC checks remain authoritative.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ATTENDEE' and p.code in ('events.view','orders.create','orders.view_own') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ARTIST' and p.code in ('events.view','artists.manage','bookings.review_assigned','music.manage_own') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ORGANIZER' and p.code in ('events.view','events.create','events.update','events.submit','events.publish','tickets.create','tickets.manage','orders.view_owned','bookings.create') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='VENUE_MANAGER' and p.code in ('events.view','venues.manage','bookings.review_assigned') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='EVENT_STAFF' and p.code in ('events.view','tickets.scan') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='SUPER_ADMIN' on conflict do nothing;

-- Replace broad Admin gates in existing Admin RPCs with capability-specific checks.
create or replace function public.admin_dashboard_snapshot()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare result jsonb;
begin
  if not public.has_admin_permission('reports.view') then raise exception 'Admin reports permission required'; end if;
  select jsonb_build_object('users',(select count(*) from auth.users),'events_total',(select count(*) from public.events),'events_pending_review',(select count(*) from public.events where status='PENDING_REVIEW'),'events_published',(select count(*) from public.events where status in ('PUBLISHED','LIVE')),'open_reports',(select count(*) from public.moderation_reports where status in ('OPEN','IN_REVIEW')),'successful_payments',(select count(*) from public.payments where status='VERIFIED_SUCCESS'),'failed_payments',(select count(*) from public.payments where status in ('FAILED','EXPIRED')),'ticket_revenue',coalesce((select sum(amount) from public.payments where status='VERIFIED_SUCCESS'),0),'venue_revenue',coalesce((select sum(amount) from public.venue_booking_payments where status='SUCCESS'),0),'checked_in',(select count(*) from public.tickets where status='CHECKED_IN')) into result;
  return result;
end; $$;

create or replace function public.admin_list_users(p_search text default null)
returns table(user_id uuid,email text,full_name text,created_at timestamptz,last_sign_in_at timestamptz,roles text[])
language sql security definer set search_path = public, auth as $$
  select u.id,u.email,up.full_name,u.created_at,u.last_sign_in_at,coalesce(array_agg(r.code::text order by r.code) filter (where r.code is not null),'{}')
  from auth.users u left join public.user_profiles up on up.id=u.id left join public.user_roles ur on ur.user_id=u.id left join public.roles r on r.id=ur.role_id
  where public.has_admin_permission('users.manage') and (p_search is null or trim(p_search)='' or lower(coalesce(u.email,'') || ' ' || coalesce(up.full_name,'')) like '%' || lower(trim(p_search)) || '%')
  group by u.id,u.email,up.full_name,u.created_at,u.last_sign_in_at order by u.created_at desc limit 100;
$$;

create or replace function public.admin_suspend_user(p_user_id uuid,p_suspend boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare until_at timestamptz;
begin
  if not public.has_admin_permission('users.manage') then raise exception 'Admin user-management permission required'; end if;
  if p_user_id = auth.uid() then raise exception 'Admins cannot suspend themselves'; end if;
  if public.has_app_role('SUPER_ADMIN'::public.app_role) and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id and r.code='SUPER_ADMIN') then raise exception 'Super Admin accounts are protected'; end if;
  until_at := case when p_suspend then now() + interval '100 years' else null end;
  update auth.users set banned_until=until_at where id=p_user_id;
  if not found then raise exception 'User not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_suspend then 'admin.user.suspended' else 'admin.user.reinstated' end,'USER',p_user_id,jsonb_build_object('reason',nullif(trim(p_reason),'')));
  return jsonb_build_object('user_id',p_user_id,'suspended',p_suspend);
end; $$;

create or replace function public.admin_review_event(p_event_id uuid,p_status public.event_status,p_note text default null)
returns public.events language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  if not public.has_admin_permission('events.moderate') then raise exception 'Admin event-moderation permission required'; end if;
  if p_status not in ('APPROVED','CHANGES_REQUESTED','REJECTED') then raise exception 'Admin can only approve, request changes, or reject events'; end if;
  update public.events set status=p_status,updated_at=now() where id=p_event_id returning * into e;
  if not found then raise exception 'Event not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'admin.event.reviewed','EVENT',p_event_id,jsonb_build_object('status',p_status::text,'note',nullif(trim(p_note),'')));
  return e;
end; $$;

create or replace function public.admin_update_report(p_report_id uuid,p_status text,p_resolution_note text default null)
returns public.moderation_reports language plpgsql security definer set search_path = public as $$
declare r public.moderation_reports;
begin
  if not public.has_admin_permission('reports.view') then raise exception 'Admin moderation permission required'; end if;
  if p_status not in ('IN_REVIEW','RESOLVED','DISMISSED') then raise exception 'Invalid report status'; end if;
  update public.moderation_reports set status=p_status,resolution_note=nullif(trim(p_resolution_note),''),resolved_by=case when p_status in ('RESOLVED','DISMISSED') then auth.uid() else null end,resolved_at=case when p_status in ('RESOLVED','DISMISSED') then now() else null end,updated_at=now() where id=p_report_id returning * into r;
  if not found then raise exception 'Report not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'admin.report.updated','MODERATION_REPORT',p_report_id,jsonb_build_object('status',p_status,'resolution_note',nullif(trim(p_resolution_note),'')));
  return r;
end; $$;

create or replace function public.admin_payment_support_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('payments.view') then raise exception 'Admin payment permission required'; end if;
  return jsonb_build_object('ticket_payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from (select id,order_id,provider,provider_reference,status,amount,currency,created_at from public.payments order by created_at desc limit 50) p),'[]'::jsonb),'venue_payments',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select id,booking_id,status,amount,currency,provider_reference,created_at from public.venue_booking_payments order by created_at desc limit 50) v),'[]'::jsonb));
end; $$;

create or replace function public.admin_recent_audit_logs()
returns setof public.audit_logs language sql security definer set search_path = public as $$
  select * from public.audit_logs where public.has_admin_permission('audit.view') order by created_at desc limit 100;
$$;

revoke all on function public.admin_dashboard_snapshot() from public;
revoke all on function public.admin_list_users(text) from public;
revoke all on function public.admin_suspend_user(uuid,boolean,text) from public;
revoke all on function public.admin_review_event(uuid,public.event_status,text) from public;
revoke all on function public.admin_update_report(uuid,text,text) from public;
revoke all on function public.admin_payment_support_snapshot() from public;
revoke all on function public.admin_recent_audit_logs() from public;
grant execute on function public.admin_dashboard_snapshot() to authenticated;
grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.admin_suspend_user(uuid,boolean,text) to authenticated;
grant execute on function public.admin_review_event(uuid,public.event_status,text) to authenticated;
grant execute on function public.admin_update_report(uuid,text,text) to authenticated;
grant execute on function public.admin_payment_support_snapshot() to authenticated;
grant execute on function public.admin_recent_audit_logs() to authenticated;
