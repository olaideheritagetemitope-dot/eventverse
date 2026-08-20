-- Atizzy Super Admin fee-change audit history
create or replace function public.update_platform_setting_fee(p_key text, p_amount numeric)
returns public.platform_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.platform_settings;
  v_updated public.platform_settings;
begin
  if auth.uid() is null or not public.has_any_app_role(array['SUPER_ADMIN'::public.app_role]) then
    raise exception 'Super Admin access is required';
  end if;
  if p_key not in ('artist_registration_fee', 'artist_verification_fee') then
    raise exception 'Unsupported platform fee';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Fee must be a non-negative amount';
  end if;

  select * into v_previous from public.platform_settings where key = p_key for update;
  if v_previous.key is null then
    raise exception 'Platform fee setting not found';
  end if;

  update public.platform_settings
  set amount = p_amount, updated_by = auth.uid(), updated_at = now()
  where key = p_key
  returning * into v_updated;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'platform_fee.updated',
    'platform_setting',
    null,
    jsonb_build_object(
      'key', v_updated.key,
      'previous_amount', v_previous.amount,
      'new_amount', v_updated.amount,
      'currency', v_updated.currency
    )
  );
  return v_updated;
end;
$$;

revoke all on function public.update_platform_setting_fee(text, numeric) from public;
grant execute on function public.update_platform_setting_fee(text, numeric) to authenticated;
