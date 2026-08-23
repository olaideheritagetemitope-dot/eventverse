-- Canonical governance directory pagination.
-- Keeps the existing admin_list_users contract intact while adding a bounded,
-- status-aware endpoint for the Super Admin registry.
create or replace function public.admin_list_users_page(
  p_search text default null,
  p_role_code text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  total_count bigint,
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  roles text[],
  role_statuses jsonb
)
language sql
security definer
set search_path = public, auth
as $func$
  with bounded as (
    select greatest(1, least(coalesce(p_limit, 50), 100)) as page_size,
           greatest(coalesce(p_offset, 0), 0) as page_offset
  ),
  base as (
    select
      u.id as user_id,
      u.email::text as email,
      up.full_name,
      u.created_at,
      u.last_sign_in_at,
      u.banned_until,
      coalesce(array_agg(r.code::text order by r.code) filter (where r.code is not null), '{}'::text[]) as roles,
      coalesce(jsonb_agg(jsonb_build_object(
        'code', r.code,
        'status', ur.status,
        'verified', ur.verified,
        'verified_at', ur.verified_at
      ) order by r.code) filter (where r.code is not null), '[]'::jsonb) as role_statuses
    from auth.users u
    left join public.user_profiles up on up.id = u.id
    left join public.user_roles ur on ur.user_id = u.id
    left join public.roles r on r.id = ur.role_id
    where public.has_admin_permission('users.manage')
      and (p_search is null or trim(p_search) = '' or lower(coalesce(u.email, '') || ' ' || coalesce(up.full_name, '')) like '%' || lower(trim(p_search)) || '%')
      and (p_role_code is null or trim(p_role_code) = '' or exists (
        select 1 from public.user_roles ur_filter
        join public.roles r_filter on r_filter.id = ur_filter.role_id
        where ur_filter.user_id = u.id and r_filter.code::text = upper(trim(p_role_code))
      ))
      and (p_status is null or trim(p_status) = '' or
        (upper(trim(p_status)) = 'SUSPENDED' and u.banned_until is not null) or
        (upper(trim(p_status)) = 'ACTIVE' and u.banned_until is null)
      )
    group by u.id, u.email, up.full_name, u.created_at, u.last_sign_in_at, u.banned_until
  )
  select count(*) over () as total_count,
         base.user_id,
         base.email,
         base.full_name,
         base.created_at,
         base.last_sign_in_at,
         base.banned_until,
         base.roles,
         base.role_statuses
  from base, bounded
  order by base.created_at desc, base.user_id desc
  limit (select page_size from bounded)
  offset (select page_offset from bounded);
$func$;

revoke all on function public.admin_list_users_page(text, text, text, integer, integer) from public;
grant execute on function public.admin_list_users_page(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_list_users_page(text, text, text, integer, integer) to service_role;

comment on function public.admin_list_users_page(text, text, text, integer, integer)
is 'Bounded, status-aware Super Admin user directory with total count and role assignment status projection.';
