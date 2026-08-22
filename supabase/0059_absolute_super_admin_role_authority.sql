begin;

-- Super Admin role mutations are authoritative and independent of normal onboarding.
-- Status is stored per assignment so multiple roles can coexist with independent lifecycle states.
alter table public.user_roles
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_roles drop constraint if exists user_roles_status_check;
alter table public.user_roles add constraint user_roles_status_check
  check (status in ('ACTIVE','SUSPENDED','INACTIVE','REVOKED'));

alter table public.role_assignment_history drop constraint if exists role_assignment_history_action_check;
alter table public.role_assignment_history add constraint role_assignment_history_action_check
  check (action in ('ASSIGN','REMOVE','REVOKE','RESTORE','SUSPEND','REACTIVATE','ACTIVATE','DEACTIVATE','VERIFY','UNVERIFY','STATUS_CHANGE','PERMISSION_CHANGE'));

drop function if exists public.super_admin_set_role(uuid, public.app_role, text, text);

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
  v_role_id uuid;
  v_existing public.user_roles%rowtype;
  v_action text := upper(trim(coalesce(p_action, '')));
  v_status text;
  v_verified boolean;
begin
  if v_actor is null or not public.is_super_admin() then
    raise exception 'Only Super Admin can mutate role assignments';
  end if;
  if p_target_user_id is null or not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'Authenticated target user is required';
  end if;
  select id into v_role_id from public.roles where code = p_role_code;
  if v_role_id is null then raise exception 'Role does not exist: %', p_role_code; end if;
  if v_action not in ('ASSIGN','REMOVE','REVOKE','RESTORE','SUSPEND','REACTIVATE','ACTIVATE','DEACTIVATE','VERIFY','UNVERIFY','STATUS_CHANGE') then
    raise exception 'Unsupported Super Admin role action: %', v_action;
  end if;

  select * into v_existing from public.user_roles where user_id = p_target_user_id and role_id = v_role_id for update;

  if v_action in ('REMOVE','REVOKE') then
    if v_existing.id is not null then
      delete from public.user_roles where id = v_existing.id;
    end if;
  elsif v_action in ('ASSIGN','RESTORE','REACTIVATE','ACTIVATE') then
    if v_existing.id is null then
      insert into public.user_roles(user_id, role_id, status, verified, verified_at, verified_by, updated_at)
      values (p_target_user_id, v_role_id, 'ACTIVE', false, null, null, now());
    else
      update public.user_roles set status = 'ACTIVE', updated_at = now() where id = v_existing.id;
    end if;
  elsif v_action = 'SUSPEND' then
    if v_existing.id is null then raise exception 'Role is not assigned'; end if;
    update public.user_roles set status = 'SUSPENDED', updated_at = now() where id = v_existing.id;
  elsif v_action = 'DEACTIVATE' then
    if v_existing.id is null then raise exception 'Role is not assigned'; end if;
    update public.user_roles set status = 'INACTIVE', updated_at = now() where id = v_existing.id;
  elsif v_action = 'VERIFY' then
    if v_existing.id is null then
      insert into public.user_roles(user_id, role_id, status, verified, verified_at, verified_by, updated_at)
      values (p_target_user_id, v_role_id, 'ACTIVE', true, now(), v_actor, now());
    else
      update public.user_roles set verified = true, verified_at = now(), verified_by = v_actor, status = 'ACTIVE', updated_at = now() where id = v_existing.id;
    end if;
  elsif v_action = 'UNVERIFY' then
    if v_existing.id is null then raise exception 'Role is not assigned'; end if;
    update public.user_roles set verified = false, verified_at = null, verified_by = null, updated_at = now() where id = v_existing.id;
  elsif v_action = 'STATUS_CHANGE' then
    v_status := upper(split_part(coalesce(p_reason, ''), ':', 1));
    if v_status not in ('ACTIVE','SUSPENDED','INACTIVE','REVOKED') then raise exception 'STATUS_CHANGE reason must begin with ACTIVE, SUSPENDED, INACTIVE, or REVOKED'; end if;
    if v_existing.id is null then raise exception 'Role is not assigned'; end if;
    update public.user_roles set status = v_status, updated_at = now() where id = v_existing.id;
  end if;

  insert into public.role_assignment_history(target_user_id, role_id, action, reason, actor_id)
  values (p_target_user_id, v_role_id, v_action, p_reason, v_actor);

  return jsonb_build_object('ok', true, 'target_user_id', p_target_user_id, 'role_code', p_role_code, 'action', v_action);
end;
$$;

create or replace function public.super_admin_set_role_permission(
  p_role_code public.app_role,
  p_permission_code text,
  p_granted boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role_id uuid;
begin
  if v_actor is null or not public.is_super_admin() then raise exception 'Only Super Admin can mutate role permissions'; end if;
  select id into v_role_id from public.roles where code = p_role_code;
  if v_role_id is null then raise exception 'Role does not exist: %', p_role_code; end if;
  insert into public.role_permissions(role_id, permission_code, granted)
  values (v_role_id, p_permission_code, p_granted)
  on conflict (role_id, permission_code) do update set granted = excluded.granted;
  insert into public.role_assignment_history(target_user_id, role_id, action, reason, actor_id)
  values (v_actor, v_role_id, 'PERMISSION_CHANGE', coalesce(p_reason, p_permission_code), v_actor);
  return jsonb_build_object('ok', true, 'role_code', p_role_code, 'permission_code', p_permission_code, 'granted', p_granted);
end;
$$;

grant execute on function public.super_admin_set_role(uuid, public.app_role, text, text) to authenticated;
grant execute on function public.super_admin_set_role_permission(public.app_role, text, boolean, text) to authenticated;

commit;
