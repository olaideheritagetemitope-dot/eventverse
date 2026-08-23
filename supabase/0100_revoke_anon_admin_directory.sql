begin;

revoke execute on function public.admin_list_users_page(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users_page(text, text, text, integer, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
