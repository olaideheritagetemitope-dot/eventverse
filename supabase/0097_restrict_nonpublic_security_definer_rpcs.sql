begin;

-- The public SECURITY DEFINER allowlist is limited to discovery and the
-- role-onboarding configuration needed before authentication. Analytics and
-- capability matrices are consumed by signed-in/admin surfaces only.
revoke execute on function public.public_content_analytics() from anon;
revoke execute on function public.role_capability_matrix() from anon;

grant execute on function public.public_content_analytics() to authenticated;
grant execute on function public.role_capability_matrix() to authenticated;

notify pgrst, 'reload schema';
commit;
