begin;

-- Root-cause repair: public.user_roles has a composite primary key
-- (user_id, role_id), not a standalone id column. The prior RPC selected
-- a row type and dereferenced a nonexistent standalone field, which fails at runtime.
create or replace function public.super_admin_set_role(
  p_target_user_id uuid,
  p_role_code public.app_role,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role_id bigint;
  v_exists boolean := false;
  v_action text := upper(trim(coalesce(p_action, '')));
  v_status text;
  v_name text;
  v_should_link boolean := false;
  v_should_verify boolean := false;
begin
  if v_actor is null or not public.is_super_admin() then
    raise exception 'Only Super Admin can mutate role assignments';
  end if;
  if p_target_user_id is null or not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'Authenticated target user is required';
  end if;
  select id into v_role_id from public.roles where code = p_role_code;
  if v_role_id is null then raise exception 'Role does not exist: %', p_role_code; end if;
  if v_action not in ('ASSIGN','REMOVE','REVOKE','RESTORE','REACTIVATE','ACTIVATE','SUSPEND','DEACTIVATE','VERIFY','UNVERIFY','STATUS_CHANGE') then
    raise exception 'Unsupported Super Admin role action: %', v_action;
  end if;

  select exists(
    select 1 from public.user_roles
    where user_id = p_target_user_id and role_id = v_role_id
  ) into v_exists;

  if v_action in ('REMOVE','REVOKE') then
    if v_exists then
      delete from public.user_roles where user_id = p_target_user_id and role_id = v_role_id;
    end if;
  elsif v_action in ('ASSIGN','RESTORE','REACTIVATE','ACTIVATE') then
    if not v_exists then
      insert into public.user_roles(user_id, role_id, status, verified, verified_at, verified_by, updated_at)
      values (p_target_user_id, v_role_id, 'ACTIVE', false, null, null, now());
    else
      update public.user_roles
      set status = 'ACTIVE', updated_at = now()
      where user_id = p_target_user_id and role_id = v_role_id;
    end if;
    v_should_link := true;
  elsif v_action = 'SUSPEND' then
    if not v_exists then raise exception 'Role is not assigned'; end if;
    update public.user_roles set status = 'SUSPENDED', updated_at = now()
    where user_id = p_target_user_id and role_id = v_role_id;
  elsif v_action = 'DEACTIVATE' then
    if not v_exists then raise exception 'Role is not assigned'; end if;
    update public.user_roles set status = 'INACTIVE', updated_at = now()
    where user_id = p_target_user_id and role_id = v_role_id;
  elsif v_action = 'VERIFY' then
    if not v_exists then
      insert into public.user_roles(user_id, role_id, status, verified, verified_at, verified_by, updated_at)
      values (p_target_user_id, v_role_id, 'ACTIVE', true, now(), v_actor, now());
    else
      update public.user_roles
      set verified = true, verified_at = now(), verified_by = v_actor, status = 'ACTIVE', updated_at = now()
      where user_id = p_target_user_id and role_id = v_role_id;
    end if;
    v_should_link := true;
    v_should_verify := true;
  elsif v_action = 'UNVERIFY' then
    if not v_exists then raise exception 'Role is not assigned'; end if;
    update public.user_roles
    set verified = false, verified_at = null, verified_by = null, updated_at = now()
    where user_id = p_target_user_id and role_id = v_role_id;
  elsif v_action = 'STATUS_CHANGE' then
    v_status := upper(split_part(coalesce(p_reason, ''), ':', 1));
    if v_status not in ('ACTIVE','SUSPENDED','INACTIVE','REVOKED') then
      raise exception 'STATUS_CHANGE reason must begin with ACTIVE, SUSPENDED, INACTIVE, or REVOKED';
    end if;
    if not v_exists then raise exception 'Role is not assigned'; end if;
    update public.user_roles set status = v_status, updated_at = now()
    where user_id = p_target_user_id and role_id = v_role_id;
    v_should_link := v_status = 'ACTIVE';
  end if;

  if v_should_link and p_role_code = 'ARTIST'::public.app_role then
    select coalesce(nullif(trim(full_name), ''), split_part(coalesce(email, 'Atizzy artist'), '@', 1))
      into v_name from public.user_profiles where id = p_target_user_id;
    insert into public.artists(user_id, name, bio, verified)
      values (p_target_user_id, coalesce(v_name, 'New Artist'), null, v_should_verify)
      on conflict (user_id) do update
      set verified = public.artists.verified or excluded.verified, updated_at = now();
  elsif v_should_link and p_role_code = 'VENUE_MANAGER'::public.app_role then
    select coalesce(nullif(trim(full_name), ''), split_part(coalesce(email, 'Atizzy venue manager'), '@', 1))
      into v_name from public.user_profiles where id = p_target_user_id;
    insert into public.venue_manager_applications(user_id, display_name, reason, status, activated_at, reviewed_by, reviewed_at)
      values (p_target_user_id, coalesce(v_name, 'Venue Manager'), 'Provisioned by Super Admin', 'APPROVED', now(), v_actor, now())
      on conflict (user_id) do update
      set status = 'APPROVED', activated_at = now(), rejection_reason = null, reviewed_by = v_actor, reviewed_at = now(), updated_at = now();
  end if;

  insert into public.role_assignment_history(target_user_id, role_id, action, reason, actor_id)
  values (p_target_user_id, v_role_id, v_action, p_reason, v_actor);

  return jsonb_build_object('ok', true, 'target_user_id', p_target_user_id, 'role_code', p_role_code, 'action', v_action);
end;
$$;

grant execute on function public.super_admin_set_role(uuid, public.app_role, text, text) to authenticated;

commit;
