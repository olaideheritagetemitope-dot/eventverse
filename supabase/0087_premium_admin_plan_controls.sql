-- Canonical Premium governance read path.
-- The attendee snapshot intentionally exposes active plans only; governance needs the
-- complete plan catalogue so Super Admin can reactivate or retire plans safely.
create or replace function public.get_premium_admin_plans()
returns setof public.premium_plans
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[]) then
    raise exception 'Admin access required';
  end if;
  return query
    select p.*
    from public.premium_plans p
    order by p.amount asc, p.created_at asc;
end;
$$;

revoke all on function public.get_premium_admin_plans() from public;
grant execute on function public.get_premium_admin_plans() to authenticated;
