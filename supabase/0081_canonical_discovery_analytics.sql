-- Canonical Atizzy discovery and analytics engine.
-- This migration is additive and keeps the existing Atizzy UI/data model intact.

alter table public.playlists add column if not exists visibility text not null default 'PRIVATE';
do $$ begin
  alter table public.playlists add constraint playlists_visibility_check check (visibility in ('PRIVATE','PUBLIC','COLLABORATIVE'));
exception when duplicate_object then null;
end $$;

alter table public.venues add column if not exists latitude numeric(9,6);
alter table public.venues add column if not exists longitude numeric(9,6);
alter table public.venues add constraint venues_latitude_check check (latitude is null or latitude between -90 and 90);
alter table public.venues add constraint venues_longitude_check check (longitude is null or longitude between -180 and 180);

create table if not exists public.album_songs (
  album_id uuid not null references public.albums(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  primary key (album_id, song_id)
);
create index if not exists album_songs_song_idx on public.album_songs(song_id, album_id);
alter table public.album_songs enable row level security;
drop policy if exists album_songs_public_read on public.album_songs;
create policy album_songs_public_read on public.album_songs for select using (
  exists (select 1 from public.albums a where a.id = album_songs.album_id and (a.status = 'PUBLISHED' or exists (select 1 from public.artists ar where ar.id = a.artist_id and ar.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[])))
);
drop policy if exists album_songs_owner_write on public.album_songs;
create policy album_songs_owner_write on public.album_songs for all using (
  exists (select 1 from public.albums a join public.artists ar on ar.id = a.artist_id where a.id = album_songs.album_id and (ar.user_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[])))
) with check (
  exists (select 1 from public.albums a join public.artists ar on ar.id = a.artist_id where a.id = album_songs.album_id and (ar.user_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[])))
);

create table if not exists public.discovery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  idempotency_key text,
  event_type text not null check (event_type in ('SONG_PLAY_START','SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE','VIDEO_PLAY_START','VIDEO_VIEW_QUALIFIED','VIDEO_PLAY_COMPLETE','EVENT_VIEW','EVENT_INTERACTION','EVENT_SHARE','VENUE_VIEW','VENUE_INTERACTION','ALBUM_VIEW','ALBUM_SAVE','ARTIST_VIEW','SEARCH','PLAYLIST_VIEW')),
  entity_type text not null check (entity_type in ('SONG','MUSIC_VIDEO','EVENT','VENUE','ALBUM','ARTIST','PLAYLIST')),
  entity_id uuid not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists discovery_events_user_idempotency_idx on public.discovery_events(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists discovery_events_entity_time_idx on public.discovery_events(entity_type, entity_id, occurred_at desc);
create index if not exists discovery_events_type_time_idx on public.discovery_events(event_type, occurred_at desc);
create index if not exists discovery_events_user_song_idx on public.discovery_events(user_id, entity_type, entity_id, occurred_at desc);
alter table public.discovery_events enable row level security;
drop policy if exists discovery_events_owner_read on public.discovery_events;
create policy discovery_events_owner_read on public.discovery_events for select using (user_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[]));

create or replace function public.record_discovery_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_session_id text default null,
  p_idempotency_key text default null,
  p_duration_seconds integer default 0,
  p_completed boolean default false,
  p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null and p_event_type not in ('EVENT_VIEW','VENUE_VIEW','VIDEO_VIEW_QUALIFIED') then raise exception 'Authentication required'; end if;
  if p_entity_id is null then raise exception 'Entity is required'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.discovery_events where user_id is not distinct from v_user and idempotency_key = p_idempotency_key limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.discovery_events(user_id,session_id,idempotency_key,event_type,entity_type,entity_id,duration_seconds,completed,metadata)
  values(v_user,nullif(trim(p_session_id),''),nullif(trim(p_idempotency_key),''),upper(trim(p_event_type)),upper(trim(p_entity_type)),p_entity_id,greatest(coalesce(p_duration_seconds,0),0),coalesce(p_completed,false),coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  select id into v_id from public.discovery_events where user_id is not distinct from v_user and idempotency_key = p_idempotency_key limit 1;
  return v_id;
end; $$;
revoke all on function public.record_discovery_event(text,text,uuid,text,text,integer,boolean,jsonb) from public;
grant execute on function public.record_discovery_event(text,text,uuid,text,text,integer,boolean,jsonb) to anon, authenticated;

create or replace function public.get_discovery_snapshot(
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_radius_km numeric default 25
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_user uuid := auth.uid(); v_radius numeric := greatest(coalesce(p_radius_km,25),1);
begin
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at, x.created_at desc) from (select e.id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at from public.events e where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED') and e.status::text <> 'CANCELLED' order by case when e.starts_at > now() then 0 else 1 end, e.starts_at, e.created_at desc limit 50) x),'[]'::jsonb),
    'upcomingEvents', coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at) from (select e.id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at from public.events e where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE') and e.starts_at > now() order by e.starts_at asc limit 50) x),'[]'::jsonb),
    'popularArtists', coalesce((select jsonb_agg(to_jsonb(x) order by x.score desc, x.name asc) from (select a.id,a.name,a.bio,a.verified,a.image_url,a.background_url,a.follower_count,round((coalesce((select count(*) from public.discovery_events d where d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') and exists (select 1 from public.songs s where s.id=d.entity_id and s.artist_id=a.id)),0)::numeric * 0.55) + (coalesce((select count(*) from public.artist_followers f where f.artist_id=a.id),0)::numeric * 0.35) + (coalesce((select count(*) from public.discovery_events d where d.entity_type='MUSIC_VIDEO' and d.event_type='VIDEO_VIEW_QUALIFIED' and exists (select 1 from public.music_videos mv where mv.id=d.entity_id and mv.artist_id=a.id)),0)::numeric * 0.10),4) as score from public.artists a where a.verified=true) x),'[]'::jsonb),
    'trendingEvents', coalesce((select jsonb_agg(to_jsonb(x) order by x.momentum desc, x.starts_at asc) from (select e.id,e.title,e.city,e.starts_at,e.ends_at,e.cover_url,e.status,e.venue_id,round((coalesce((select count(*) from public.discovery_events d where d.entity_type='EVENT' and d.entity_id=e.id and d.occurred_at >= now()-interval '7 days'),0)::numeric - coalesce((select count(*) from public.discovery_events d where d.entity_type='EVENT' and d.entity_id=e.id and d.occurred_at >= now()-interval '14 days' and d.occurred_at < now()-interval '7 days'),0)::numeric) + coalesce((select count(*) from public.event_favorites f where f.event_id=e.id and f.created_at >= now()-interval '7 days'),0)::numeric,4) as momentum from public.events e where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE') and e.starts_at > now()) x),'[]'::jsonb),
    'popularVenues', coalesce((select jsonb_agg(to_jsonb(x) order by x.score desc, x.name asc) from (select v.id,v.name,v.city,v.address,v.capacity,v.image_urls,v.latitude,v.longitude,round((coalesce((select count(*) from public.discovery_events d where d.entity_type='VENUE' and d.entity_id=v.id),0)::numeric * 0.30) + (coalesce((select count(*) from public.events e where e.venue_id=v.id and e.status::text in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED')),0)::numeric * 0.25) + (coalesce((select count(*) from public.events e join public.ticket_types tt on tt.event_id=e.id join public.order_items oi on oi.ticket_type_id=tt.id where e.venue_id=v.id),0)::numeric * 0.45),4) as score from public.venues v) x),'[]'::jsonb),
    'nearbyEvents', case when p_latitude is null or p_longitude is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x) order by x.distance_km asc, x.starts_at asc) from (select e.id,e.title,e.city,e.starts_at,e.ends_at,e.cover_url,e.status,e.venue_id,round((6371 * acos(least(1,greatest(-1,sin(radians(p_latitude))*sin(radians(v.latitude))+cos(radians(p_latitude))*cos(radians(v.latitude))*cos(radians(v.longitude)-radians(p_longitude))))))::numeric,2) as distance_km from public.events e join public.venues v on v.id=e.venue_id where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE') and e.starts_at > now() and v.latitude is not null and v.longitude is not null) x where x.distance_km <= v_radius),'[]'::jsonb) end,
    'recentlyPlayed', case when v_user is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x) order by x.last_played desc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,max(d.occurred_at) as last_played from public.discovery_events d join public.songs s on s.id=d.entity_id where d.user_id=v_user and d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds order by max(d.occurred_at) desc limit 20) x),'[]'::jsonb) end,
    'personalMostPlayed', case when v_user is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x) order by x.qualified_plays desc, x.last_played desc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,count(*) as qualified_plays,max(d.occurred_at) as last_played from public.discovery_events d join public.songs s on s.id=d.entity_id where d.user_id=v_user and d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds order by count(*) desc,max(d.occurred_at) desc limit 20) x),'[]'::jsonb) end,
    'platformMostPlayed', coalesce((select jsonb_agg(to_jsonb(x) order by x.qualified_plays desc, x.title asc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,count(*) as qualified_plays from public.discovery_events d join public.songs s on s.id=d.entity_id where d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds order by count(*) desc,s.title asc limit 20) x),'[]'::jsonb),
    'popularSongs', coalesce((select jsonb_agg(to_jsonb(x) order by x.score desc, x.title asc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,round((coalesce((select count(*) from public.discovery_events d where d.entity_type='SONG' and d.entity_id=s.id and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE')),0)::numeric * 0.65) + (coalesce((select count(*) from public.music_favorites f where f.song_id=s.id),0)::numeric * 0.35),4) as score from public.songs s where s.audio_url is not null) x),'[]'::jsonb),
    'mostLikedSongs', coalesce((select jsonb_agg(to_jsonb(x) order by x.likes desc, x.title asc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,count(f.user_id) as likes from public.songs s left join public.music_favorites f on f.song_id=s.id group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds order by count(f.user_id) desc,s.title asc limit 20) x),'[]'::jsonb),
    'mostLikedArtists', coalesce((select jsonb_agg(to_jsonb(x) order by x.followers desc, x.name asc) from (select a.id,a.name,a.image_url,a.background_url,count(f.user_id) as followers from public.artists a left join public.artist_followers f on f.artist_id=a.id where a.verified=true group by a.id,a.name,a.image_url,a.background_url order by count(f.user_id) desc,a.name asc limit 20) x),'[]'::jsonb),
    'mostWatchedMusicVideos', coalesce((select jsonb_agg(to_jsonb(x) order by x.qualified_views desc, x.title asc) from (select mv.id,mv.artist_id,mv.title,mv.description,mv.thumbnail_url,mv.video_url,count(d.id) as qualified_views from public.music_videos mv left join public.discovery_events d on d.entity_type='MUSIC_VIDEO' and d.entity_id=mv.id and d.event_type='VIDEO_VIEW_QUALIFIED' where mv.status='PUBLISHED' group by mv.id,mv.artist_id,mv.title,mv.description,mv.thumbnail_url,mv.video_url order by count(d.id) desc,mv.title asc limit 20) x),'[]'::jsonb),
    'popularAlbums', coalesce((select jsonb_agg(to_jsonb(x) order by x.score desc, x.title asc) from (select al.id,al.artist_id,al.title,al.description,al.cover_url,round((coalesce((select sum(song_score) from (select s.id,(count(distinct d.id)::numeric + count(distinct mf.user_id)::numeric) as song_score from public.album_songs als join public.songs s on s.id=als.song_id left join public.discovery_events d on d.entity_type='SONG' and d.entity_id=s.id and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') left join public.music_favorites mf on mf.song_id=s.id where als.album_id=al.id group by s.id) scores),0) + coalesce((select count(*) from public.discovery_events d where d.entity_type='ALBUM' and d.entity_id=al.id and d.event_type in ('ALBUM_VIEW','ALBUM_SAVE')),0)::numeric),4) as score from public.albums al where al.status='PUBLISHED') x),'[]'::jsonb),
    'privatePlaylists', case when v_user is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.playlists p where p.user_id=v_user and p.visibility='PRIVATE'),'[]'::jsonb) end,
    'publicPlaylists', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.playlists p where p.visibility='PUBLIC'),'[]'::jsonb),
    'generatedAt', now()
  ) into v;
  return v;
end; $$;
revoke all on function public.get_discovery_snapshot(numeric,numeric,numeric) from public;
grant execute on function public.get_discovery_snapshot(numeric,numeric,numeric) to anon, authenticated;

create or replace function public.get_user_discovery_snapshot(p_user_id uuid default auth.uid()) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() and not public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[]) then raise exception 'Private discovery access denied'; end if;
  return public.get_discovery_snapshot(null,null,25);
end; $$;
revoke all on function public.get_user_discovery_snapshot(uuid) from public;
grant execute on function public.get_user_discovery_snapshot(uuid) to authenticated;

create or replace function public.mirror_play_history_to_discovery() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.discovery_events(user_id,event_type,entity_type,entity_id,duration_seconds,completed,metadata,occurred_at)
  values(new.user_id, case when new.seconds_played >= 30 then 'SONG_PLAY_COMPLETE' else 'SONG_PLAY_START' end, 'SONG', new.song_id, new.seconds_played, new.seconds_played >= 30, jsonb_build_object('source','play_history','legacy_id',new.id), new.played_at);
  return new;
end; $$;
drop trigger if exists play_history_discovery_bridge on public.play_history;
create trigger play_history_discovery_bridge after insert on public.play_history for each row execute function public.mirror_play_history_to_discovery();

notify pgrst, 'reload schema';
