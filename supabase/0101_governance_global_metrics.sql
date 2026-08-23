begin;

create or replace function public.admin_role_governance_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id',u.id,'email',u.email,'created_at',u.created_at,'profile',to_jsonb(p),
      'roles',coalesce((select jsonb_agg(r.code order by r.code)
        from public.user_roles ur
        join public.roles r on r.id=ur.role_id
        where ur.user_id=u.id and ur.status='ACTIVE'),'[]'::jsonb)
    ) order by u.created_at desc)
    from auth.users u
    left join public.user_profiles p on p.id=u.id
    limit 1000),'[]'::jsonb),
    'user_counts', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'active', (select count(*) from auth.users u where not exists (
        select 1 from public.user_roles ur
        where ur.user_id=u.id and ur.status in ('SUSPENDED','REVOKED')
      )),
      'blocked', (select count(*) from auth.users u where exists (
        select 1 from public.user_roles ur
        where ur.user_id=u.id and ur.status='SUSPENDED'
      ))
    ),
    'applications', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from public.role_applications a limit 1000),'[]'::jsonb),
    'application_counts', jsonb_build_object(
      'total', (select count(*) from public.role_applications),
      'pending', (select count(*) from public.role_applications where status in ('PENDING','PENDING_REVIEW','REQUEST_CHANGES')),
      'approved', (select count(*) from public.role_applications where status='APPROVED'),
      'rejected', (select count(*) from public.role_applications where status='REJECTED')
    ),
    'verification_queue', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at asc)
      from public.role_applications a where a.status in ('PENDING_PAYMENT','PENDING_REVIEW') limit 1000),'[]'::jsonb),
    'fees', coalesce((select jsonb_agg(to_jsonb(f) order by f.role_code) from public.role_fee_policies f),'[]'::jsonb),
    'ticket_fee_policies', coalesce((select jsonb_agg(to_jsonb(f) order by f.policy_key) from public.platform_fee_policies f),'[]'::jsonb),
    'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.role_code,q.sort_order,q.created_at) from public.role_onboarding_questions q),'[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(w) order by w.updated_at desc) from public.wallet_accounts w limit 1000),'[]'::jsonb),
    'wallet_totals', jsonb_build_object(
      'balance', coalesce((select sum(w.balance) from public.wallet_accounts w),0)
    ),
    'support', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.support_requests s where s.status in ('OPEN','IN_PROGRESS') limit 1000),'[]'::jsonb),
    'event_lifecycle', jsonb_build_object(
      'past',(select count(*) from public.events e where e.status='COMPLETED' or e.ends_at < now()),
      'active',(select count(*) from public.events e where e.status in ('LIVE','PUBLISHED','SOLD_OUT') and e.starts_at <= now() and (e.ends_at is null or e.ends_at >= now())),
      'future',(select count(*) from public.events e where e.starts_at > now() and e.status not in ('CANCELLED','REJECTED')),
      'draft',(select count(*) from public.events e where e.status='DRAFT'),
      'cancelled',(select count(*) from public.events e where e.status='CANCELLED')
    ),
    'ticket_accounting', jsonb_build_object(
      'capacity',coalesce((select sum(tt.capacity) from public.ticket_types tt),0),
      'reserved',coalesce((select sum(tt.reserved) from public.ticket_types tt),0),
      'sold',coalesce((select sum(tt.sold) from public.ticket_types tt),0),
      'issued',(select count(*) from public.tickets t where t.status in ('ISSUED','ACTIVE','CHECKED_IN')),
      'cancelled',(select count(*) from public.tickets t where t.status in ('CANCELLED','REFUNDED','EXPIRED'))
    ),
    'analytics', jsonb_build_object(
      'likes',(select count(*) from public.content_likes),
      'ratings',(select count(*) from public.content_ratings),
      'comments',(select count(*) from public.content_comments where status='VISIBLE')
    )
  ) into v;

  return v;
end;
$$;

revoke all on function public.admin_role_governance_snapshot() from public;
grant execute on function public.admin_role_governance_snapshot() to authenticated;
grant execute on function public.admin_role_governance_snapshot() to service_role;

commit;
