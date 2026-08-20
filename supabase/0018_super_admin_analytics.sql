-- Atizzy Super Admin live analytics
create or replace function public.get_super_admin_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.has_any_app_role(array['SUPER_ADMIN'::public.app_role]) then
    raise exception 'Super Admin access is required';
  end if;

  select jsonb_build_object(
    'events_total', (select count(*) from public.events),
    'events_published', (select count(*) from public.events where status::text = 'PUBLISHED'),
    'tickets_issued', (select count(*) from public.tickets where status::text in ('ISSUED','CHECKED_IN')),
    'tickets_checked_in', (select count(*) from public.tickets where checked_in_at is not null),
    'ticket_revenue', coalesce((select sum(amount) from public.payments where status::text = 'VERIFIED_SUCCESS'), 0),
    'venue_revenue', coalesce((select sum(amount) from public.venue_booking_payments where status = 'SUCCESS'), 0),
    'payments_successful', (select count(*) from public.payments where status::text = 'VERIFIED_SUCCESS'),
    'venue_payments_successful', (select count(*) from public.venue_booking_payments where status = 'SUCCESS'),
    'currency', 'NGN',
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_super_admin_analytics() from public;
grant execute on function public.get_super_admin_analytics() to authenticated;
