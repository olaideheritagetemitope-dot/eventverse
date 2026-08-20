begin;

create table if not exists public.platform_fee_policies (
  policy_key text primary key,
  enabled boolean not null default true,
  fee_type text not null default 'PERCENTAGE' check (fee_type in ('FIXED','PERCENTAGE')),
  amount numeric(12,4) not null default 0 check (amount >= 0),
  currency text not null default 'NGN',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_fee_policies(policy_key, enabled, fee_type, amount, currency)
values ('TICKET_SALE', true, 'PERCENTAGE', 0, 'NGN')
on conflict (policy_key) do nothing;

alter table public.platform_fee_policies enable row level security;

drop policy if exists platform_fee_super_read on public.platform_fee_policies;
create policy platform_fee_super_read on public.platform_fee_policies for select to authenticated using (public.is_super_admin());

create or replace function public.set_platform_fee_policy(
  p_policy_key text,
  p_enabled boolean,
  p_fee_type text,
  p_amount numeric,
  p_currency text default 'NGN'
)
returns public.platform_fee_policies
language plpgsql security definer set search_path=public
as $$
declare v public.platform_fee_policies;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_policy_key <> 'TICKET_SALE' then raise exception 'Invalid fee policy'; end if;
  if p_fee_type not in ('FIXED','PERCENTAGE') then raise exception 'Invalid fee type'; end if;
  if p_amount < 0 or (p_fee_type = 'PERCENTAGE' and p_amount > 100) then raise exception 'Invalid fee amount'; end if;
  update public.platform_fee_policies
    set enabled=coalesce(p_enabled,true), fee_type=p_fee_type, amount=p_amount,
        currency=coalesce(nullif(trim(p_currency),''),'NGN'), updated_by=auth.uid(), updated_at=now()
    where policy_key=p_policy_key returning * into v;
  if v.policy_key is null then raise exception 'Fee policy not found'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, metadata)
    values (auth.uid(), 'platform_fee_policy.updated', 'platform_fee_policy',
      jsonb_build_object('policy_key', p_policy_key, 'fee_type', p_fee_type, 'amount', p_amount, 'enabled', p_enabled));
  return v;
end;
$$;

revoke all on function public.set_platform_fee_policy(text,boolean,text,numeric,text) from public;
grant execute on function public.set_platform_fee_policy(text,boolean,text,numeric,text) to authenticated;

create or replace function public.admin_role_governance_snapshot()
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare v jsonb;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id',u.id,'email',u.email,'created_at',u.created_at,'profile',to_jsonb(p),
      'roles',coalesce((select jsonb_agg(r.code order by r.code) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=u.id),'[]'::jsonb)
    ) order by u.created_at desc) from auth.users u left join public.user_profiles p on p.id=u.id limit 1000),'[]'::jsonb),
    'applications', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.role_applications a limit 1000),'[]'::jsonb),
    'verification_queue', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at asc) from public.role_applications a where a.status in ('PENDING_PAYMENT','PENDING_REVIEW') limit 1000),'[]'::jsonb),
    'fees', coalesce((select jsonb_agg(to_jsonb(f) order by f.role_code) from public.role_fee_policies f),'[]'::jsonb),
    'ticket_fee_policies', coalesce((select jsonb_agg(to_jsonb(f) order by f.policy_key) from public.platform_fee_policies f),'[]'::jsonb),
    'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.role_code,q.sort_order) from public.role_onboarding_questions q where q.active),'[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(w) order by w.updated_at desc) from public.wallet_accounts w limit 1000),'[]'::jsonb),
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
    'engagement_by_type', coalesce((select jsonb_object_agg(z.target_type,z.metrics) from (
      select target_type,jsonb_build_object('likes',count(*) filter(where metric='likes'),'ratings',count(*) filter(where metric='ratings'),'comments',count(*) filter(where metric='comments'),'average_rating',round(avg(rating_value) filter(where metric='ratings'),2)) metrics
      from (
        select target_type,'likes' metric,null::numeric rating_value from public.content_likes
        union all select target_type,'ratings',rating::numeric from public.content_ratings
        union all select target_type,'comments',null::numeric from public.content_comments where status='VISIBLE'
      ) q group by target_type
    ) z),'{}'::jsonb),
    'analytics', jsonb_build_object('likes',(select count(*) from public.content_likes),'ratings',(select count(*) from public.content_ratings),'comments',(select count(*) from public.content_comments where status='VISIBLE'))
  ) into v;
  return v;
end;
$$;

revoke all on function public.admin_role_governance_snapshot() from public;
grant execute on function public.admin_role_governance_snapshot() to authenticated;

commit;
