-- Atizzy: expose the delegated Admin capability catalog without making Admin unlimited.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'ADMIN'::public.app_role
  and p.code in (
    'users.manage', 'events.moderate', 'reports.view', 'payments.view',
    'audit.view', 'artists.manage', 'artists.verify', 'tickets.manage',
    'orders.view_owned', 'venues.manage'
  )
on conflict do nothing;

create or replace function public.role_capability_matrix()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.code,
    'label', r.label,
    'permissions', coalesce(perms.permissions, '[]'::jsonb),
    'enforcement', case when r.code = 'ADMIN'::public.app_role then 'delegated_grant_required' else 'role_and_workflow_scoped' end
  ) order by r.code), '[]'::jsonb)
  from public.roles r
  left join lateral (
    select jsonb_agg(p.code order by p.code) as permissions
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = r.id
  ) perms on true;
$$;
revoke all on function public.role_capability_matrix() from public;
grant execute on function public.role_capability_matrix() to authenticated;
