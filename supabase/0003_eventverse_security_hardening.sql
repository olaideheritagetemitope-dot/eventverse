revoke execute on function public.has_role(public.app_role) from public;
revoke execute on function public.has_role(public.app_role) from anon;
revoke execute on function public.has_role(public.app_role) from authenticated;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_admin() from authenticated;
