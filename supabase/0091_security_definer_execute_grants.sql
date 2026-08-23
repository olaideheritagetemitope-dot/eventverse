-- Atizzy SECURITY DEFINER execution-boundary hardening.
-- User-submitted applications may run only as authenticated users;
-- governance mutations require authenticated callers and self-authorize as Super Admin;
-- provider settlement routines are service-role-only.

begin;

revoke all on function public.submit_role_application(text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_role_application(text, jsonb) to authenticated;

revoke all on function public.admin_review_role_application(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_role_application(uuid, text, text) to authenticated;

revoke all on function public.set_role_fee_policy(text, boolean, numeric, text, integer) from public, anon, authenticated;
grant execute on function public.set_role_fee_policy(text, boolean, numeric, text, integer) to authenticated;

revoke all on function public.super_admin_set_role(uuid, public.app_role, text, text) from public, anon, authenticated;
grant execute on function public.super_admin_set_role(uuid, public.app_role, text, text) to authenticated;

revoke all on function public.activate_role_application_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.activate_role_application_payment(uuid, text) to service_role;

revoke all on function public.activate_premium_payment(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.activate_premium_payment(uuid, text, numeric, text) to service_role;

revoke all on function public.verify_payment_and_issue_tickets(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_payment_and_issue_tickets(uuid, text) to service_role;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

notify pgrst, 'reload schema';
commit;
