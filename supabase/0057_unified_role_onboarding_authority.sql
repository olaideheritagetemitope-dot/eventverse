begin;

-- 0057: unify role onboarding authority across Artist, Organizer, and Venue Manager.
-- Legacy tables/RPCs remain for historical commerce records, but new onboarding
-- requests must enter role_applications and may not self-grant a role.

alter table public.role_applications add column if not exists profile_id uuid;

alter table public.role_applications drop constraint if exists role_applications_status_check;
alter table public.role_applications add constraint role_applications_status_check
  check (status in ('DRAFT','PENDING_REVIEW','REQUEST_CHANGES','APPROVED','PENDING_PAYMENT','ACTIVE','REJECTED','SUSPENDED','BLOCKED'));

alter table public.role_applications drop constraint if exists role_applications_fee_status_check;
alter table public.role_applications add constraint role_applications_fee_status_check
  check (fee_status in ('NOT_REQUIRED','PENDING','PAID','FAILED','REFUNDED'));

create table if not exists public.role_application_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.role_applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role_code text not null check (role_code in ('ARTIST','ORGANIZER','VENUE_MANAGER')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  provider text not null default 'paystack',
  provider_reference text unique,
  idempotency_key text unique not null,
  authorization_url text,
  access_code text,
  status text not null default 'INITIALIZED' check (status in ('INITIALIZED','PROVIDER_PENDING','VERIFIED_SUCCESS','FAILED','EXPIRED','CANCELLED')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id)
);

alter table public.role_application_payments enable row level security;
drop policy if exists role_application_payments_self_or_super on public.role_application_payments;
create policy role_application_payments_self_or_super on public.role_application_payments
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin());

create index if not exists role_applications_review_queue_idx
  on public.role_applications(status, role_code, submitted_at desc);

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
  on conflict (user_id, role_code) where status in ('DRAFT','PENDING_REVIEW','REQUEST_CHANGES','APPROVED','PENDING_PAYMENT')
  do update set answers = excluded.answers, status = 'PENDING_REVIEW', submitted_at = now(),
    fee_amount = excluded.fee_amount, fee_currency = excluded.fee_currency,
    fee_status = 'NOT_REQUIRED', rejection_reason = null, reviewed_by = null,
    reviewed_at = null, updated_at = now()
  returning * into v_row;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'role_application.submitted', 'role_application', v_row.id,
          jsonb_build_object('role_code', p_role_code));
  return v_row;
end;
$$;

create or replace function public.admin_review_role_application(
  p_application_id uuid, p_status text, p_reason text default null
) returns public.role_applications
language plpgsql security definer set search_path=public
as $$
declare v public.role_applications;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_status not in ('APPROVED','REJECTED','REQUEST_CHANGES','SUSPENDED','BLOCKED') then
    raise exception 'Invalid review status';
  end if;
  update public.role_applications
  set status = case when p_status = 'APPROVED' and fee_amount > 0 then 'APPROVED'
                    when p_status = 'APPROVED' then 'ACTIVE'
                    else p_status end,
      fee_status = case when p_status = 'APPROVED' and fee_amount > 0 then 'PENDING'
                        when p_status = 'APPROVED' then 'NOT_REQUIRED'
                        else fee_status end,
      rejection_reason = case when p_status in ('REJECTED','REQUEST_CHANGES') then p_reason else null end,
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_application_id
  returning * into v;
  if v.id is null then raise exception 'Application not found'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'role_application.reviewed', 'role_application', v.id,
          jsonb_build_object('status', p_status, 'reason', p_reason));
  return v;
end;
$$;

create or replace function public.initialize_role_application_payment(
  p_application_id uuid, p_idempotency_key text
) returns public.role_application_payments
language plpgsql security definer set search_path=public
as $$
declare
  v_app public.role_applications;
  v_existing public.role_application_payments;
  v_payment public.role_application_payments;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Idempotency key is required'; end if;
  select * into v_app from public.role_applications
  where id = p_application_id and user_id = auth.uid() for update;
  if v_app.id is null then raise exception 'Application not found'; end if;
  if v_app.status not in ('APPROVED','PENDING_PAYMENT') then raise exception 'Application is not approved for payment'; end if;
  if v_app.fee_amount <= 0 then raise exception 'No payment is required for this application'; end if;
  if v_app.fee_status not in ('PENDING','FAILED') then raise exception 'Application payment is not available'; end if;
  select * into v_existing from public.role_application_payments where idempotency_key = p_idempotency_key limit 1;
  if v_existing.id is not null then return v_existing; end if;
  insert into public.role_application_payments(application_id,user_id,role_code,amount,currency,idempotency_key,status)
  values(v_app.id,v_app.user_id,v_app.role_code,v_app.fee_amount,v_app.fee_currency,p_idempotency_key,'PROVIDER_PENDING')
  returning * into v_payment;
  update public.role_applications set status='PENDING_PAYMENT', fee_status='PENDING', updated_at=now() where id=v_app.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'role_application.payment_initialized','role_application',v_app.id,jsonb_build_object('payment_id',v_payment.id));
  return v_payment;
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
  v_profile public.artists;
begin
  select * into v_payment from public.role_application_payments where id = p_payment_id for update;
  if v_payment.id is null then raise exception 'Role application payment not found'; end if;
  if v_payment.status = 'VERIFIED_SUCCESS' then return v_payment; end if;
  if nullif(trim(p_provider_reference), '') is null then raise exception 'Provider reference is required'; end if;
  update public.role_application_payments set status='VERIFIED_SUCCESS', provider_reference=p_provider_reference,
    verified_at=coalesce(verified_at,now()), updated_at=now() where id=v_payment.id returning * into v_payment;
  select * into v_app from public.role_applications where id=v_payment.application_id for update;
  if v_app.id is null then raise exception 'Role application not found'; end if;
  select id into v_role_id from public.roles where code=v_app.role_code limit 1;
  if v_role_id is null then raise exception 'Role definition not found'; end if;
  insert into public.user_roles(user_id,role_id) values(v_app.user_id,v_role_id) on conflict do nothing;
  update public.role_applications set status='ACTIVE', fee_status='PAID', reviewed_at=coalesce(reviewed_at,now()), updated_at=now() where id=v_app.id;
  if v_app.role_code='ARTIST' then
    select * into v_profile from public.artists where user_id=v_app.user_id limit 1;
    if v_profile.id is null then
      insert into public.artists(user_id,name,bio,verified)
      values(v_app.user_id,coalesce((select full_name from public.user_profiles where id=v_app.user_id),'New Artist'),null,false)
      returning * into v_profile;
    end if;
    update public.role_applications set profile_id=v_profile.id where id=v_app.id;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_app.user_id,'role_application.activated','role_application',v_app.id,
         jsonb_build_object('role_code',v_app.role_code,'provider_reference',p_provider_reference));
  return v_payment;
end;
$$;

revoke all on function public.initialize_role_application_payment(uuid,text) from public;
revoke all on function public.activate_role_application_payment(uuid,text) from public;
grant execute on function public.initialize_role_application_payment(uuid,text) to authenticated;
grant execute on function public.activate_role_application_payment(uuid,text) to service_role;
grant execute on function public.admin_review_role_application(uuid,text,text) to authenticated;
grant execute on function public.submit_role_application(text,jsonb) to authenticated;

commit;
