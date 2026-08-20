begin;

-- Complete the Super Admin governance snapshot with role-separated directories,
-- onboarding queues, lifecycle accounting, niche engagement analytics, support,
-- and moderation targets. All data is returned only to Super Admin callers.
create or replace function public.admin_role_governance_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'profile', to_jsonb(p),
        'roles', coalesce((select jsonb_agg(r.code order by r.code)
          from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = u.id), '[]'::jsonb)
      ) order by u.created_at desc)
      from auth.users u
      left join public.user_profiles p on p.id = u.id
      limit 1000
    ), '[]'::jsonb),
    'role_directories', jsonb_build_object(
      'ARTIST', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select a.id, a.user_id, a.name, a.verified, a.created_at,
          coalesce((select email from auth.users au where au.id=a.user_id),'') as email
        from public.artists a limit 1000) x), '[]'::jsonb),
      'ORGANIZER', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select u.id, u.email, u.created_at, p.full_name
        from auth.users u join public.user_roles ur on ur.user_id=u.id
        join public.roles r on r.id=ur.role_id and r.code='ORGANIZER'
        left join public.user_profiles p on p.id=u.id limit 1000) x), '[]'::jsonb),
      'VENUE_MANAGER', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select u.id, u.email, u.created_at, p.full_name,
          (select count(*) from public.venues v where v.owner_id=u.id) as venue_count
        from auth.users u join public.user_roles ur on ur.user_id=u.id
        join public.roles r on r.id=ur.role_id and r.code='VENUE_MANAGER'
        left join public.user_profiles p on p.id=u.id limit 1000) x), '[]'::jsonb),
      'EVENT_STAFF', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select u.id, u.email, u.created_at, p.full_name
        from auth.users u join public.user_roles ur on ur.user_id=u.id
        join public.roles r on r.id=ur.role_id and r.code='EVENT_STAFF'
        left join public.user_profiles p on p.id=u.id limit 1000) x), '[]'::jsonb),
      'ADMIN', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select u.id, u.email, u.created_at, p.full_name
        from auth.users u join public.user_roles ur on ur.user_id=u.id
        join public.roles r on r.id=ur.role_id and r.code='ADMIN'
        left join public.user_profiles p on p.id=u.id limit 1000) x), '[]'::jsonb)
    ),
    'applications', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.role_applications a limit 1000), '[]'::jsonb),
    'verification_queue', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at asc) from public.role_applications a where a.status in ('PENDING_PAYMENT','PENDING_REVIEW') limit 1000), '[]'::jsonb),
    'fees', coalesce((select jsonb_agg(to_jsonb(f) order by f.role_code) from public.role_fee_policies f), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.role_code,q.sort_order) from public.role_onboarding_questions q where q.active), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(w) order by w.updated_at desc) from public.wallet_accounts w limit 1000), '[]'::jsonb),
    'support', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.support_requests s where s.status in ('OPEN','IN_PROGRESS') limit 1000), '[]'::jsonb),
    'event_lifecycle', jsonb_build_object(
      'past', (select count(*) from public.events e where e.status='COMPLETED' or e.ends_at < now()),
      'active', (select count(*) from public.events e where e.status in ('LIVE','PUBLISHED','SOLD_OUT') and e.starts_at <= now() and (e.ends_at is null or e.ends_at >= now())),
      'future', (select count(*) from public.events e where e.starts_at > now() and e.status not in ('CANCELLED','REJECTED')),
      'draft', (select count(*) from public.events e where e.status='DRAFT'),
      'cancelled', (select count(*) from public.events e where e.status='CANCELLED')
    ),
    'ticket_accounting', jsonb_build_object(
      'capacity', coalesce((select sum(tt.capacity) from public.ticket_types tt),0),
      'reserved', coalesce((select sum(tt.reserved) from public.ticket_types tt),0),
      'sold', coalesce((select sum(tt.sold) from public.ticket_types tt),0),
      'issued', (select count(*) from public.tickets t where t.status in ('ISSUED','ACTIVE','CHECKED_IN')),
      'cancelled', (select count(*) from public.tickets t where t.status in ('CANCELLED','REFUNDED','EXPIRED'))
    ),
    'engagement_by_type', coalesce((select jsonb_object_agg(z.target_type, z.metrics) from (
      select target_type, jsonb_build_object(
        'likes', count(*) filter (where metric='likes'),
        'ratings', count(*) filter (where metric='ratings'),
        'comments', count(*) filter (where metric='comments'),
        'average_rating', round(avg(rating_value) filter (where metric='ratings'),2)
      ) as metrics
      from (
        select target_type, 'likes'::text metric, null::numeric rating_value from public.content_likes
        union all select target_type, 'ratings', rating::numeric from public.content_ratings
        union all select target_type, 'comments', null::numeric from public.content_comments where status='VISIBLE'
      ) q group by target_type
    ) z), '{}'::jsonb),
    'analytics', jsonb_build_object(
      'likes', (select count(*) from public.content_likes),
      'ratings', (select count(*) from public.content_ratings),
      'comments', (select count(*) from public.content_comments where status='VISIBLE')
    )
  ) into v;

  return v;
end;
$$;

-- Super Admin can stop, cancel, or restore an event without exposing a client-side
-- direct table update. Cancellation credits paid ticket amounts to each ticket owner
-- exactly once through the wallet ledger.
create or replace function public.admin_set_event_status(p_event_id uuid, p_status public.event_status, p_reason text default null)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_order record;
  v_credit numeric;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  update public.events set status=p_status, updated_at=now() where id=p_event_id returning * into v_event;
  if v_event.id is null then raise exception 'Event not found'; end if;

  if p_status='CANCELLED' then
    for v_order in
      select distinct o.id, o.user_id, o.total
      from public.orders o
      join public.tickets t on t.order_id=o.id
      join public.ticket_types tt on tt.id=t.ticket_type_id
      where tt.event_id=p_event_id and o.status in ('PAID','FULFILLED','PARTIALLY_REFUNDED')
    loop
      if not exists (select 1 from public.wallet_ledger wl where wl.reference_type='EVENT_CANCELLATION' and wl.reference_id=v_order.id) then
        v_credit := greatest(coalesce(v_order.total,0),0);
        if v_credit > 0 then
          insert into public.wallet_accounts(user_id,balance) values(v_order.user_id,v_credit)
          on conflict(user_id) do update set balance=public.wallet_accounts.balance+excluded.balance,updated_at=now();
          insert into public.wallet_ledger(user_id,amount,direction,reason,reference_type,reference_id,created_by)
          values(v_order.user_id,v_credit,'CREDIT',coalesce(p_reason,'Event cancelled'),'EVENT_CANCELLATION',v_order.id,auth.uid());
        end if;
      end if;
    end loop;
    update public.tickets t set status='REFUNDED' where t.ticket_type_id in (select id from public.ticket_types where event_id=p_event_id) and t.status in ('ISSUED','ACTIVE');
    update public.orders o set status='REFUNDED', updated_at=now() where o.id in (select distinct t.order_id from public.tickets t join public.ticket_types tt on tt.id=t.ticket_type_id where tt.event_id=p_event_id);
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(auth.uid(),'event.status_changed','event',p_event_id,jsonb_build_object('status',p_status,'reason',p_reason));
  return v_event;
end;
$$;

revoke all on function public.admin_role_governance_snapshot() from public;
revoke all on function public.admin_set_event_status(uuid,public.event_status,text) from public;
grant execute on function public.admin_role_governance_snapshot() to authenticated;
grant execute on function public.admin_set_event_status(uuid,public.event_status,text) to authenticated;

commit;
