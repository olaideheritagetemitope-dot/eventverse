create table if not exists public.user_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null check (length(trim(query)) between 1 and 160),
  created_at timestamptz not null default now()
);

create index if not exists user_search_history_user_created_idx on public.user_search_history(user_id, created_at desc);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  music jsonb not null default '{}'::jsonb,
  events jsonb not null default '{}'::jsonb,
  location jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  discovery jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('EVENT','TICKET','ARTIST','SYSTEM')),
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_created_idx on public.user_notifications(user_id, created_at desc);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('GENERAL','TICKET_PAYMENT','ACCOUNT','REPORT_PROBLEM')),
  subject text not null,
  message text not null,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_search_history enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_notifications enable row level security;
alter table public.support_requests enable row level security;

drop policy if exists "users own search history" on public.user_search_history;
create policy "users own search history" on public.user_search_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users own preferences" on public.user_preferences;
create policy "users own preferences" on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users own notifications" on public.user_notifications;
create policy "users own notifications" on public.user_notifications for select using (user_id = auth.uid());
drop policy if exists "users update notifications" on public.user_notifications;
create policy "users update notifications" on public.user_notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users own support requests" on public.support_requests;
create policy "users own support requests" on public.support_requests for select using (user_id = auth.uid());
drop policy if exists "users create support requests" on public.support_requests;
create policy "users create support requests" on public.support_requests for insert with check (user_id = auth.uid());

create or replace function public.user_experience_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.user_preferences(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return jsonb_build_object(
    'search_history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from (select id,query,created_at from public.user_search_history where user_id = auth.uid() order by created_at desc limit 20) h),'[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select id,type,title,message,metadata,read_at,created_at from public.user_notifications where user_id = auth.uid() order by created_at desc limit 50) n),'[]'::jsonb),
    'preferences', (select to_jsonb(p) - 'user_id' from public.user_preferences p where p.user_id = auth.uid()),
    'support_requests', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from (select id,category,subject,message,status,created_at,updated_at from public.support_requests where user_id = auth.uid() order by created_at desc limit 20) s),'[]'::jsonb)
  );
end; $$;

create or replace function public.record_user_search(p_query text)
returns public.user_search_history language plpgsql security definer set search_path = public as $$
declare row public.user_search_history;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_query,''))) = 0 then raise exception 'Search query is required'; end if;
  delete from public.user_search_history where user_id = auth.uid() and lower(query) = lower(trim(p_query));
  insert into public.user_search_history(user_id, query) values (auth.uid(), trim(p_query)) returning * into row;
  return row;
end; $$;

create or replace function public.clear_user_search_history()
returns void language sql security definer set search_path = public as $$ delete from public.user_search_history where user_id = auth.uid(); $$;

create or replace function public.update_user_preferences(p_preferences jsonb)
returns public.user_preferences language plpgsql security definer set search_path = public as $$
declare row public.user_preferences;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.user_preferences(user_id,music,events,location,notifications,discovery,updated_at)
  values (auth.uid(), coalesce(p_preferences->'music','{}'), coalesce(p_preferences->'events','{}'), coalesce(p_preferences->'location','{}'), coalesce(p_preferences->'notifications','{}'), coalesce(p_preferences->'discovery','{}'), now())
  on conflict (user_id) do update set music=excluded.music,events=excluded.events,location=excluded.location,notifications=excluded.notifications,discovery=excluded.discovery,updated_at=now()
  returning * into row;
  return row;
end; $$;

create or replace function public.mark_user_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = public as $$ update public.user_notifications set read_at = coalesce(read_at, now()) where id = p_notification_id and user_id = auth.uid(); $$;
create or replace function public.mark_all_user_notifications_read()
returns void language sql security definer set search_path = public as $$ update public.user_notifications set read_at = coalesce(read_at, now()) where user_id = auth.uid() and read_at is null; $$;
create or replace function public.create_support_request(p_category text, p_subject text, p_message text)
returns public.support_requests language plpgsql security definer set search_path = public as $$
declare row public.support_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.support_requests(user_id,category,subject,message) values (auth.uid(),p_category,p_subject,p_message) returning * into row;
  return row;
end; $$;

revoke all on function public.user_experience_snapshot() from public;
revoke all on function public.record_user_search(text) from public;
revoke all on function public.clear_user_search_history() from public;
revoke all on function public.update_user_preferences(jsonb) from public;
revoke all on function public.mark_user_notification_read(uuid) from public;
revoke all on function public.mark_all_user_notifications_read() from public;
revoke all on function public.create_support_request(text,text,text) from public;
grant execute on function public.user_experience_snapshot() to authenticated;
grant execute on function public.record_user_search(text) to authenticated;
grant execute on function public.clear_user_search_history() to authenticated;
grant execute on function public.update_user_preferences(jsonb) to authenticated;
grant execute on function public.mark_user_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_user_notifications_read() to authenticated;
grant execute on function public.create_support_request(text,text,text) to authenticated;
