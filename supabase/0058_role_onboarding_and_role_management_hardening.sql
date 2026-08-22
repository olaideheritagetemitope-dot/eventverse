begin;

-- 0058: harden the single role-onboarding authority and complete activation/governance.
-- The role_fee_policies table remains the only fee source for Artist, Organizer,
-- and Venue Manager onboarding. Legacy artist fee tables are not consulted here.

drop index if exists public.role_applications_one_open_idx;
create unique index if not exists role_applications_one_open_idx
  on public.role_applications(user_id, role_code)
  where status in ('DRAFT','REQUEST_CHANGES','PENDING_REVIEW','APPROVED','PENDING_PAYMENT');

create or replace function public.submit_role_application(p_role_code text, p_answers jsonb)
returns public.role_applications
language plpgsql security definer set search_path=public
as $$
declare
  v_row public.role_applications;
  v_policy public.role_fee_policies;
  v_question record;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_code not in ('ARTIST','ORGANIZER','VENUE_MANAGER') then raise exception 'Unsupported role'; end if;
  select * into v_policy from public.role_fee_policies where role_code = p_role_code and enabled;
  if v_policy.role_code is null then raise exception 'Role onboarding is unavailable'; end if;
  for v_question in
    select id, prompt from public.role_onboarding_questions
    where role_code = p_role_code and active and required
    order by sort_order, created_at
  loop
    if nullif(trim(coalesce(v_answers ->> v_question.id::text, '')), '') is null then
      raise exception 'Complete required question: %', v_question.prompt;
    end if;
  end loop;
  insert into public.role_applications(
    user_id, role_code, status, answers, fee_amount, fee_currency, fee_status,
    submitted_at, review_due_at, rejection_reason, reviewed_by, reviewed_at
  ) values (
    auth.uid(), p_role_code, 'PENDING_REVIEW', v_answers, v_policy.amount,
    v_policy.currency, 'NOT_REQUIRED', now(),
    case when p_role_code = 'ORGANIZER' then now() + make_interval(hours => v_policy.organizer_review_hours) else null end,
    null, null, null
  )
  on conflict (user_id, role_code) where status in ('DRAFT','REQUEST_CHANGES','PENDING_REVIEW','APPROVED','PENDING_PAYMENT')
  do update set answers = excluded.answers, status = 'PENDING_REVIEW', submitted_at = now(),
    fee_amount = excluded.fee_amount, fee_currency = excluded.fee_currency,
    fee_status = 'NOT_REQUIRED', rejection_reason = null, reviewed_by = null,
    reviewed_at = null, updated_at = now()
  returning * into v_row;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'role_application.submitted', 'role_application', v_row.id,
          jsonb_build_object('role_code', p_role_code, 'status', 'PENDING_REVIEW'));
  return v_row;
end;
$$;

create or replace function public.activate_role_application_payment(
  p_payment_id uuid, p_provider_reference text
) returns public.role_application_payments
language plpgsql security definer set search_path=public
as $$
declare
  v_payment public.role_application_payments;
  v_app public.role_applications;
  v_role_id bigint;
  v_name text;
  v_venue_application public.venue_manager_applications;
begin
  select * into v_payment from public.role_application_payments where id = p_payment_id for update;
  if v_payment.id is null then raise exception 'Role application payment not found'; end if;
  if v_payment.status = 'VERIFIED_SUCCESS' then return v_payment; end if;
  if nullif(trim(p_provider_reference), '') is null then raise exception 'Provider reference is required'; end if;
  update public.role_application_payments
    set status='VERIFIED_SUCCESS', provider_reference=p_provider_reference,
        verified_at=coalesce(verified_at,now()), updated_at=now()
    where id=v_payment.id returning * into v_payment;
  select * into v_app from public.role_applications where id=v_payment.application_id for update;
  if v_app.id is null then raise exception 'Role application not found'; end if;
  select id into v_role_id from public.roles where code=v_app.role_code limit 1;
  if v_role_id is null then raise exception 'Role definition not found'; end if;
  insert into public.user_roles(user_id,role_id)
    values(v_app.user_id,v_role_id) on conflict do nothing;
  update public.role_applications
    set status='ACTIVE', fee_status='PAID', reviewed_at=coalesce(reviewed_at,now()), updated_at=now()
    where id=v_app.id;

  select coalesce(nullif(trim(full_name),''),'Atizzy user') into v_name
    from public.user_profiles where id=v_app.user_id;

  if v_app.role_code='ARTIST' then
    insert into public.artists(user_id,name,bio,verified)
      values(v_app.user_id,coalesce(v_name,'New Artist'),null,true)
      on conflict (user_id) do update set verified=true, updated_at=now();
    update public.role_applications set profile_id=(select id from public.artists where user_id=v_app.user_id limit 1) where id=v_app.id;
  elsif v_app.role_code='ORGANIZER' then
    -- Events use organizer_id as the authoritative organizer profile link.
    update public.role_applications set profile_id=v_app.user_id where id=v_app.id;
  elsif v_app.role_code='VENUE_MANAGER' then
    insert into public.venue_manager_applications(user_id,display_name,reason,status,activated_at,reviewed_by,reviewed_at)
      values(v_app.user_id,coalesce(v_name,'Venue Manager'),'Approved through unified role onboarding','APPROVED',now(),v_app.reviewed_by,now())
      on conflict (user_id) do update set status='APPROVED', activated_at=now(), rejection_reason=null, updated_at=now();
    select id into v_venue_application from public.venue_manager_applications where user_id=v_app.user_id limit 1;
    update public.role_applications set profile_id=v_venue_application.id where id=v_app.id;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_app.user_id,'role_application.activated','role_application',v_app.id,
         jsonb_build_object('role_code',v_app.role_code,'provider_reference',p_provider_reference,'role_id',v_role_id));
  return v_payment;
end;
$$;

create table if not exists public.role_assignment_history (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete restrict,
  action text not null check (action in ('ASSIGN','REVOKE','SUSPEND','REACTIVATE','VERIFY','UNVERIFY')),
  reason text,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists role_assignment_history_target_idx
  on public.role_assignment_history(target_user_id, created_at desc);
alter table public.role_assignment_history enable row level security;
drop policy if exists role_assignment_history_super_read on public.role_assignment_history;
create policy role_assignment_history_super_read on public.role_assignment_history
  for select to authenticated using (target_user_id = auth.uid() or public.is_super_admin());

create or replace function public.super_admin_set_role(
  p_target_user_id uuid, p_role_code public.app_role, p_action text, p_reason text default null
) returns public.user_roles
language plpgsql security definer set search_path=public
as $$
declare
  v_role_id bigint;
  v_assignment public.user_roles;
  v_existing public.user_roles;
  v_action text := upper(trim(p_action));
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() and p_role_code = 'SUPER_ADMIN' then
    raise exception 'Invalid target role assignment';
  end if;
  if v_action not in ('ASSIGN','REVOKE','SUSPEND','REACTIVATE','VERIFY','UNVERIFY') then
    raise exception 'Invalid role action';
  end if;
  select id into v_role_id from public.roles where code=p_role_code;
  if v_role_id is null then raise exception 'Role not found'; end if;
  select * into v_existing from public.user_roles where user_id=p_target_user_id and role_id=v_role_id;
  if v_action in ('ASSIGN','REACTIVATE','VERIFY') then
    insert into public.user_roles(user_id,role_id) values(p_target_user_id,v_role_id)
      on conflict do nothing returning * into v_assignment;
    if v_assignment.user_id is null then
      select * into v_assignment from public.user_roles where user_id=p_target_user_id and role_id=v_role_id;
    end if;
  elsif v_action in ('REVOKE','SUSPEND','UNVERIFY') then
    delete from public.user_roles where user_id=p_target_user_id and role_id=v_role_id;
    v_assignment := coalesce(v_existing, row(p_target_user_id,v_role_id,now())::public.user_roles);
  end if;
  insert into public.role_assignment_history(target_user_id,role_id,action,reason,actor_id)
    values(p_target_user_id,v_role_id,v_action,nullif(trim(p_reason),''),auth.uid());
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'role_assignment.'||lower(v_action),'user_role',gen_random_uuid(),jsonb_build_object('target_user_id',p_target_user_id,'role_code',p_role_code,'reason',p_reason));
  return v_assignment;
end;
$$;

revoke all on function public.super_admin_set_role(uuid,public.app_role,text,text) from public;
grant execute on function public.super_admin_set_role(uuid,public.app_role,text,text) to authenticated;
grant execute on function public.activate_role_application_payment(uuid,text) to service_role;

drop policy if exists role_applications_super_admin_read on public.role_applications;
create policy role_applications_super_admin_read on public.role_applications
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists role_application_payments_super_admin_read on public.role_application_payments;
create policy role_application_payments_super_admin_read on public.role_application_payments
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin());

commit;
