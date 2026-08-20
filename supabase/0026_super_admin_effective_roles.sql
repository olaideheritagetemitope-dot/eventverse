-- Atizzy universal Super Admin effective-role inheritance
-- SUPER_ADMIN remains the only assigned/canonical role for the designated account.
-- Effective capabilities are computed centrally by security-definer helpers.

create or replace function public.effective_app_roles()
returns setof public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select distinct r.code
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
    and r.code is not null
  union
  select e.enumlabel::public.app_role
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = 'public'::regnamespace
    and t.typname = 'app_role'
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code = 'SUPER_ADMIN'::public.app_role
    );
$$;

create or replace function public.has_app_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.effective_app_roles() effective_role
    where effective_role = required_role
  );
$$;

create or replace function public.has_any_app_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.effective_app_roles() effective_role
    where effective_role = any(required_roles)
  );
$$;

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role(required_role);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_app_role(array['ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role]);
$$;

create or replace function public.get_current_role_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  primary_role public.app_role;
  assigned_roles jsonb;
  effective_roles jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('primary_role', null, 'assigned_roles', '[]'::jsonb, 'effective_roles', '[]'::jsonb);
  end if;

  select r.code into primary_role
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
  order by case r.code
    when 'SUPER_ADMIN'::public.app_role then 1
    when 'ADMIN'::public.app_role then 2
    when 'ORGANIZER'::public.app_role then 3
    when 'ARTIST'::public.app_role then 4
    when 'VENUE_MANAGER'::public.app_role then 5
    when 'EVENT_STAFF'::public.app_role then 6
    when 'ATTENDEE'::public.app_role then 7
    else 99
  end, r.id
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(code) order by code), '[]'::jsonb)
    into assigned_roles
  from (
    select distinct r.code
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
  ) assigned;

  select coalesce(jsonb_agg(to_jsonb(code) order by code), '[]'::jsonb)
    into effective_roles
  from (
    select distinct effective_role as code
    from public.effective_app_roles() effective_role
  ) effective;

  return jsonb_build_object(
    'primary_role', primary_role,
    'assigned_roles', assigned_roles,
    'effective_roles', effective_roles
  );
end;
$$;

revoke all on function public.effective_app_roles() from public;
revoke all on function public.get_current_role_context() from public;
grant execute on function public.effective_app_roles() to authenticated;
grant execute on function public.get_current_role_context() to authenticated;

comment on function public.effective_app_roles() is 'Returns assigned roles for normal users and every valid app_role for Super Admins without changing role assignments.';
comment on function public.get_current_role_context() is 'Returns primary, assigned, and effective roles for the current authenticated identity; workspace selection never mutates primary_role.';
