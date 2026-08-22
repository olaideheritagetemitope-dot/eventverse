-- Restore the authenticated execution contract for role helper RPCs.
-- These functions return only authorization booleans/context and remain SECURITY DEFINER.
-- Anonymous callers stay denied; RLS policies continue to call them internally.

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
revoke all on function public.is_admin() from authenticated;
revoke all on function public.has_app_role(public.app_role) from public;
revoke all on function public.has_app_role(public.app_role) from anon;
revoke all on function public.has_app_role(public.app_role) from authenticated;
revoke all on function public.has_any_app_role(public.app_role[]) from public;
revoke all on function public.has_any_app_role(public.app_role[]) from anon;
revoke all on function public.has_any_app_role(public.app_role[]) from authenticated;
revoke all on function public.has_role(public.app_role) from public;
revoke all on function public.has_role(public.app_role) from anon;
revoke all on function public.has_role(public.app_role) from authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_app_role(public.app_role) to authenticated;
grant execute on function public.has_any_app_role(public.app_role[]) to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;

comment on function public.is_admin() is 'Authenticated-safe boolean compatibility helper backed by effective_app_roles; anonymous execution is denied.';
comment on function public.has_app_role(public.app_role) is 'Authenticated-safe effective-role capability check; anonymous execution is denied.';
comment on function public.has_any_app_role(public.app_role[]) is 'Authenticated-safe effective-role capability check for any requested role; anonymous execution is denied.';
comment on function public.has_role(public.app_role) is 'Authenticated-safe effective-role compatibility helper; anonymous execution is denied.';

revoke all on function public.get_current_role_context() from public;
revoke all on function public.get_current_role_context() from anon;
grant execute on function public.get_current_role_context() to authenticated;
