begin;

-- Authoritative Super Admin event directory.
-- The frontend must not read the full events table directly for governance views;
-- this security-definer RPC enforces the canonical Super Admin boundary server-side.
create or replace function public.admin_governance_event_snapshot()
returns table(
  id uuid,
  title text,
  status public.event_status,
  starts_at timestamptz,
  ends_at timestamptz,
  city text,
  organizer_id uuid,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  return query
  select e.id, e.title, e.status, e.starts_at, e.ends_at, e.city, e.organizer_id, e.updated_at
  from public.events e
  order by e.starts_at asc nulls last
  limit 100;
end;
$$;

revoke all on function public.admin_governance_event_snapshot() from public;
grant execute on function public.admin_governance_event_snapshot() to authenticated;

commit;
