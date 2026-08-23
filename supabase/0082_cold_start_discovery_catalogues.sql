-- Cold-start discovery catalogues.
-- Ranking determines prominence; eligibility determines whether content exists in public discovery.
-- This migration is additive and preserves the canonical ranking RPC from 0081.

create index if not exists songs_public_latest_idx
  on public.songs(status, published_at desc, created_at desc)
  where status = 'PUBLISHED' and audio_url is not null;
create index if not exists artists_public_latest_idx
  on public.artists(verified, created_at desc)
  where verified = true;
create index if not exists albums_public_latest_idx
  on public.albums(status, release_date desc, created_at desc)
  where status = 'PUBLISHED';
create index if not exists music_videos_public_latest_idx
  on public.music_videos(status, published_at desc, created_at desc)
  where status = 'PUBLISHED' and video_url is not null;
create index if not exists venues_public_latest_idx
  on public.venues(status, created_at desc)
  where status = 'ACTIVE';
create index if not exists events_public_latest_idx
  on public.events(status, created_at desc);
create index if not exists events_public_upcoming_idx
  on public.events(status, starts_at asc)
  where status in ('PUBLISHED','SOLD_OUT','LIVE');
create index if not exists playlists_public_latest_idx
  on public.playlists(visibility, created_at desc)
  where visibility = 'PUBLIC';

create or replace function public.get_cold_start_discovery_catalogue(
  p_limit integer default 24,
  p_offset integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v jsonb;
begin
  select jsonb_build_object(
    'latestSongs', coalesce((select jsonb_agg(to_jsonb(x) order by x.published_at desc nulls last, x.created_at desc) from (
      select s.id,s.artist_id,s.title,s.duration_seconds,s.audio_url,s.cover_url,s.play_count,s.status,s.published_at,s.created_at,a.name as artist,a.image_url as artist_image
      from public.songs s left join public.artists a on a.id=s.artist_id
      where s.status='PUBLISHED' and s.audio_url is not null
      order by s.published_at desc nulls last,s.created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'allSongs', coalesce((select jsonb_agg(to_jsonb(x) order by x.published_at desc nulls last, x.created_at desc) from (
      select s.id,s.artist_id,s.title,s.duration_seconds,s.audio_url,s.cover_url,s.play_count,s.status,s.published_at,s.created_at,a.name as artist,a.image_url as artist_image
      from public.songs s left join public.artists a on a.id=s.artist_id
      where s.status='PUBLISHED' and s.audio_url is not null
      order by s.published_at desc nulls last,s.created_at desc limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'latestArtists', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select a.id,a.user_id,a.name,a.bio,a.verified,a.follower_count,a.image_url,a.background_url,a.created_at
      from public.artists a where a.verified=true order by a.created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'allArtists', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select a.id,a.user_id,a.name,a.bio,a.verified,a.follower_count,a.image_url,a.background_url,a.created_at
      from public.artists a where a.verified=true order by a.created_at desc limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'latestAlbums', coalesce((select jsonb_agg(to_jsonb(x) order by x.release_date desc nulls last,x.created_at desc) from (
      select al.id,al.artist_id,al.title,al.description,al.cover_url,al.status,al.release_date,al.created_at
      from public.albums al where al.status='PUBLISHED' order by al.release_date desc nulls last,al.created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'allAlbums', coalesce((select jsonb_agg(to_jsonb(x) order by x.release_date desc nulls last,x.created_at desc) from (
      select al.id,al.artist_id,al.title,al.description,al.cover_url,al.status,al.release_date,al.created_at
      from public.albums al where al.status='PUBLISHED' order by al.release_date desc nulls last,al.created_at desc limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'newVenues', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select v0.id,v0.name,v0.city,v0.address,v0.capacity,v0.status,v0.image_urls,v0.latitude,v0.longitude,v0.created_at
      from public.venues v0 where v0.status='ACTIVE' order by v0.created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'allVenues', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select v0.id,v0.name,v0.city,v0.address,v0.capacity,v0.status,v0.image_urls,v0.latitude,v0.longitude,v0.created_at
      from public.venues v0 where v0.status='ACTIVE' order by v0.created_at desc limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'latestEvents', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select e.id,e.organizer_id,e.venue_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,e.cover_url,e.status,e.rating,e.review_count,e.created_at
      from public.events e where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE') order by e.created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'allEvents', coalesce((select jsonb_agg(to_jsonb(x) order by case when x.starts_at > now() then 0 else 1 end,x.starts_at asc,x.created_at desc) from (
      select e.id,e.organizer_id,e.venue_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,e.cover_url,e.status,e.rating,e.review_count,e.created_at
      from public.events e where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED') order by case when e.starts_at > now() then 0 else 1 end,e.starts_at asc,e.created_at desc limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'upcomingEvents', coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at asc) from (
      select e.id,e.organizer_id,e.venue_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,e.cover_url,e.status,e.rating,e.review_count,e.created_at
      from public.events e where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE') and e.starts_at > now() order by e.starts_at asc limit v_limit
    ) x),'[]'::jsonb),
    'latestMusicVideos', coalesce((select jsonb_agg(to_jsonb(x) order by x.published_at desc nulls last,x.created_at desc) from (
      select mv.id,mv.artist_id,mv.title,mv.description,mv.thumbnail_url,mv.video_url,mv.status,mv.published_at,mv.created_at
      from public.music_videos mv where mv.status='PUBLISHED' and mv.video_url is not null order by mv.published_at desc nulls last,mv.created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'allMusicVideos', coalesce((select jsonb_agg(to_jsonb(x) order by x.published_at desc nulls last,x.created_at desc) from (
      select mv.id,mv.artist_id,mv.title,mv.description,mv.thumbnail_url,mv.video_url,mv.status,mv.published_at,mv.created_at
      from public.music_videos mv where mv.status='PUBLISHED' and mv.video_url is not null order by mv.published_at desc nulls last,mv.created_at desc limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'publicPlaylists', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select p.id,p.user_id,p.name,p.visibility,p.created_at from public.playlists p where p.visibility='PUBLIC' order by p.created_at desc limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'latestPublicPlaylists', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select p.id,p.user_id,p.name,p.visibility,p.created_at from public.playlists p where p.visibility='PUBLIC' order by p.created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'generatedAt', now()
  ) into v;
  return v;
end;
$$;

revoke all on function public.get_cold_start_discovery_catalogue(integer,integer) from public;
grant execute on function public.get_cold_start_discovery_catalogue(integer,integer) to anon, authenticated;

notify pgrst, 'reload schema';
