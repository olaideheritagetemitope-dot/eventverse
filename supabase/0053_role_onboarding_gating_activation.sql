begin;

create or replace function public.submit_role_application(p_role_code text, p_answers jsonb)
returns public.role_applications
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.role_applications;
  v_policy public.role_fee_policies;
  v_question record;
  v_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_code not in ('ARTIST','ORGANIZER','VENUE_MANAGER') then raise exception 'Unsupported role'; end if;
  select * into v_policy from public.role_fee_policies where role_code=p_role_code;
  if v_policy.role_code is null or not v_policy.enabled then raise exception 'Role onboarding is unavailable'; end if;
  for v_question in
    select id, prompt from public.role_onboarding_questions
    where role_code=p_role_code and active and required
    order by sort_order, created_at
  loop
    v_value := coalesce(p_answers -> v_question.id::text, p_answers -> v_question.prompt);
    if v_value is null or nullif(trim(both ' ' from coalesce(v_value #>> '{}','')), '') is null then
      raise exception 'Complete required onboarding question: %', v_question.prompt;
    end if;
  end loop;
  insert into public.role_applications(user_id,role_code,status,answers,fee_amount,fee_currency,fee_status,submitted_at,review_due_at)
  values(auth.uid(),p_role_code,case when v_policy.amount>0 then 'PENDING_PAYMENT' else 'PENDING_REVIEW' end,coalesce(p_answers,'{}'::jsonb),v_policy.amount,v_policy.currency,case when v_policy.amount>0 then 'PENDING' else 'NOT_REQUIRED' end,now(),case when p_role_code='ORGANIZER' then now()+make_interval(hours=>v_policy.organizer_review_hours) else null end)
  on conflict (user_id,role_code) where status in ('DRAFT','PENDING_PAYMENT','PENDING_REVIEW')
  do update set answers=excluded.answers, fee_amount=excluded.fee_amount, fee_currency=excluded.fee_currency, fee_status=excluded.fee_status, submitted_at=now(), review_due_at=excluded.review_due_at, updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_review_role_application(p_application_id uuid,p_status text,p_reason text default null)
returns public.role_applications
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.role_applications;
  v_role_id uuid;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_status not in ('APPROVED','REJECTED','SUSPENDED','BLOCKED') then raise exception 'Invalid review status'; end if;
  select * into v from public.role_applications where id=p_application_id for update;
  if v.id is null then raise exception 'Application not found'; end if;
  if p_status='APPROVED' and v.fee_status not in ('PAID','NOT_REQUIRED') then raise exception 'Verification fee must be paid before approval'; end if;
  update public.role_applications
    set status=p_status,
        rejection_reason=case when p_status='REJECTED' then p_reason else null end,
        reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id=p_application_id returning * into v;
  if p_status='APPROVED' then
    select id into v_role_id from public.roles where code=v.role_code limit 1;
    if v_role_id is null then raise exception 'Role definition not found'; end if;
    insert into public.user_roles(user_id,role_id) values(v.user_id,v_role_id) on conflict (user_id,role_id) do nothing;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'role_application.reviewed','role_application',v.id,jsonb_build_object('status',p_status,'reason',p_reason,'role_activated',p_status='APPROVED'));
  return v;
end;
$$;

grant execute on function public.get_onboarding_config(text) to authenticated;
grant execute on function public.submit_role_application(text,jsonb) to authenticated;
grant execute on function public.admin_review_role_application(uuid,text,text) to authenticated;

commit;
