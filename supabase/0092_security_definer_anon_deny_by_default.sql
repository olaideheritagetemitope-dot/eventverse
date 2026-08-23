begin;

-- Anonymous clients may consume only intentionally public, read-only RPCs.
-- All SECURITY DEFINER routines are otherwise removed from PUBLIC/anon execution
-- to prevent anonymous access to governance, payment, identity, mutation, and
-- owner-scoped workflows.
do $do$
declare
  r record;
  v_public_allowlist text[] := array[
    'get_discovery_snapshot',
    'get_cold_start_discovery_catalogue',
    'get_role_onboarding_public_config',
    'public_content_analytics',
    'role_capability_matrix'
  ];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.identity_args);
    if r.proname = any(v_public_allowlist) then
      execute format('grant execute on function public.%I(%s) to anon', r.proname, r.identity_args);
    end if;
  end loop;
end
$do$;

notify pgrst, 'reload schema';
commit;
