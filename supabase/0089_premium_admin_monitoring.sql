-- Premium admin monitoring uses the existing canonical subscription/payment tables.
-- It exposes no new payment or entitlement model.
create or replace function public.get_premium_admin_monitoring(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_subscriptions jsonb;
  v_payments jsonb;
begin
  if not public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[]) then
    raise exception 'Admin access required';
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(s) || jsonb_build_object(
      'email', u.email,
      'full_name', up.full_name
    ) order by s.updated_at desc
  ), '[]'::jsonb)
  into v_subscriptions
  from (
    select * from public.premium_subscriptions
    order by updated_at desc
    limit v_limit
  ) s
  left join auth.users u on u.id = s.user_id
  left join public.user_profiles up on up.id = s.user_id;

  select coalesce(jsonb_agg(
    to_jsonb(p) || jsonb_build_object(
      'email', u.email,
      'full_name', up.full_name,
      'plan_name', plan.name,
      'plan_code', plan.code
    ) order by p.created_at desc
  ), '[]'::jsonb)
  into v_payments
  from (
    select * from public.premium_payments
    order by created_at desc
    limit v_limit
  ) p
  left join auth.users u on u.id = p.user_id
  left join public.user_profiles up on up.id = p.user_id
  left join public.premium_plans plan on plan.id = p.plan_id;

  return jsonb_build_object(
    'subscriptions', v_subscriptions,
    'payments', v_payments,
    'generated_at', now()
  );
end;
$$;

grant execute on function public.get_premium_admin_monitoring(integer) to authenticated;
