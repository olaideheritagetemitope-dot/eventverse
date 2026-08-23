-- Premium plan creation is part of the same canonical governance surface as plan editing.
create or replace function public.create_premium_plan(
  p_code text,
  p_name text,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_interval text,
  p_interval_count integer,
  p_features jsonb,
  p_is_active boolean
)
returns public.premium_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.premium_plans;
  v_code text := upper(regexp_replace(trim(coalesce(p_code, '')), '[^A-Z0-9_]+', '_', 'g'));
  v_currency text := upper(trim(coalesce(p_currency, 'NGN')));
  v_interval text := upper(trim(coalesce(p_interval, 'MONTH')));
begin
  if not public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]) then
    raise exception 'Admin access required';
  end if;
  if v_code = '' then raise exception 'Plan code is required'; end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'Plan name is required'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Plan amount must be zero or greater'; end if;
  if v_currency not in ('NGN','USD','GBP','EUR') then raise exception 'Unsupported plan currency'; end if;
  if v_interval not in ('MONTH','YEAR') then raise exception 'Unsupported plan interval'; end if;
  if coalesce(p_interval_count, 0) <= 0 then raise exception 'Interval count must be greater than zero'; end if;

  insert into public.premium_plans(code,name,description,amount,currency,interval,interval_count,features,is_active)
  values(v_code,trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_amount,v_currency,v_interval,p_interval_count,coalesce(p_features,'{}'::jsonb),coalesce(p_is_active,false))
  returning * into v_plan;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'PREMIUM_PLAN_CREATED','premium_plans',v_plan.id,jsonb_build_object('code',v_plan.code,'amount',v_plan.amount,'currency',v_plan.currency,'interval',v_plan.interval,'is_active',v_plan.is_active));
  return v_plan;
exception
  when unique_violation then
    raise exception 'A Premium plan with this code already exists';
end;
$$;

revoke all on function public.create_premium_plan(text,text,text,numeric,text,text,integer,jsonb,boolean) from public;
grant execute on function public.create_premium_plan(text,text,text,numeric,text,text,integer,jsonb,boolean) to authenticated;
