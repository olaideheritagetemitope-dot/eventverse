-- Canonical discovery category definitions.
-- This migration keeps the existing RPC contract and adds featuredEvents while
-- replacing category predicates with the definitions in the product directive.
create or replace function public.get_discovery_snapshot(
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_radius_km numeric default 25
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_user uuid := auth.uid();
  v_radius numeric := greatest(coalesce(p_radius_km, 25), 1);
begin
  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts_at, x.created_at desc)
      from (
        select e.id,e.organizer_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,
               e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at
        from public.events e
        where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED')
          and e.status::text <> 'CANCELLED'
        order by case when e.starts_at > now() then 0 else 1 end, e.starts_at, e.created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'upcomingEvents', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts_at, x.created_at desc)
      from (
        select e.id,e.organizer_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,
               e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at
        from public.events e
        where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')
          and e.starts_at > now()
        order by e.starts_at asc, e.created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'trendingEvents', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ends_at asc nulls last, x.starts_at asc, x.created_at desc)
      from (
        select e.id,e.organizer_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,
               e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at
        from public.events e
        where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')
          and e.starts_at <= now()
          and e.ends_at is not null
          and now() <= e.ends_at
        order by e.ends_at asc nulls last, e.starts_at asc, e.created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'nearbyEvents', case
      when p_latitude is null or p_longitude is null then '[]'::jsonb
      else coalesce((
        select jsonb_agg(to_jsonb(x) order by x.distance_km asc, x.starts_at asc, x.created_at desc)
        from (
          select e.id,e.organizer_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,
                 e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at,
                 round((6371 * acos(least(1,greatest(-1,
                   sin(radians(p_latitude))*sin(radians(v.latitude))
                   + cos(radians(p_latitude))*cos(radians(v.latitude))
                   * cos(radians(v.longitude)-radians(p_longitude))
                 ))))::numeric, 2) as distance_km
          from public.events e
          join public.venues v on v.id=e.venue_id
          where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')
            and (e.starts_at > now() or (e.starts_at <= now() and e.ends_at is not null and now() <= e.ends_at))
            and v.latitude is not null
            and v.longitude is not null
        ) x
        where x.distance_km <= v_radius
        limit 50
      ), '[]'::jsonb)
    end,
    'featuredEvents', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.like_count desc, x.is_premium_organizer desc, x.starts_at asc, x.created_at desc)
      from (
        select e.id,e.organizer_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,
               e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at,
               count(distinct cl.user_id) as like_count,
               exists (
                 select 1
                 from public.premium_entitlements pe
                 join public.premium_plans pp on pp.id=pe.plan_id
                 where pe.user_id=e.organizer_id
                   and pe.status='ACTIVE'
                   and pe.starts_at <= now()
                   and pe.ends_at > now()
                   and pp.code='ORGANIZER_PREMIUM'
                   and pp.is_active=true
               ) as is_premium_organizer
        from public.events e
        left join public.content_likes cl on cl.target_type='EVENT' and cl.target_id=e.id
        where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')
          and (e.starts_at > now() or (e.starts_at <= now() and e.ends_at is not null and now() <= e.ends_at))
        group by e.id,e.organizer_id,e.title,e.description,e.event_type,e.city,e.starts_at,e.ends_at,
                 e.cover_url,e.status,e.rating,e.review_count,e.venue_id,e.created_at
        having count(distinct cl.user_id) > 0 or exists (
          select 1
          from public.premium_entitlements pe
          join public.premium_plans pp on pp.id=pe.plan_id
          where pe.user_id=e.organizer_id
            and pe.status='ACTIVE'
            and pe.starts_at <= now()
            and pe.ends_at > now()
            and pp.code='ORGANIZER_PREMIUM'
            and pp.is_active=true
        )
        order by count(distinct cl.user_id) desc, is_premium_organizer desc, e.starts_at asc, e.created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'popularVenues', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.like_count desc, x.name asc)
      from (
        select v.id,v.name,v.city,v.address,v.capacity,v.image_urls,v.latitude,v.longitude,
               count(distinct cl.user_id) as like_count
        from public.venues v
        left join public.content_likes cl on cl.target_type='VENUE' and cl.target_id=v.id
        group by v.id,v.name,v.city,v.address,v.capacity,v.image_urls,v.latitude,v.longitude
        having count(distinct cl.user_id) > 0
        order by count(distinct cl.user_id) desc, v.name asc
        limit 50
      ) x
    ), '[]'::jsonb),
    'popularArtists', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.score desc, x.name asc)
      from (
        select a.id,a.name,a.bio,a.verified,a.image_url,a.background_url,a.follower_count,
               round((coalesce((select count(*) from public.discovery_events d where d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') and exists (select 1 from public.songs s where s.id=d.entity_id and s.artist_id=a.id)),0)::numeric * 0.55) + (coalesce((select count(*) from public.artist_followers f where f.artist_id=a.id),0)::numeric * 0.35) + (coalesce((select count(*) from public.discovery_events d where d.entity_type='MUSIC_VIDEO' and d.event_type='VIDEO_VIEW_QUALIFIED' and exists (select 1 from public.music_videos mv where mv.id=d.entity_id and mv.artist_id=a.id)),0)::numeric * 0.10),4) as score
        from public.artists a where a.verified=true
      ) x
    ), '[]'::jsonb),
    'recentlyPlayed', case when v_user is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x) order by x.last_played desc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name as artist,a.image_url as artist_image,max(d.occurred_at) as last_played from public.discovery_events d join public.songs s on s.id=d.entity_id left join public.artists a on a.id=s.artist_id where d.user_id=v_user and d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name,a.image_url order by max(d.occurred_at) desc limit 20) x),'[]'::jsonb) end,
    'personalMostPlayed', case when v_user is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x) order by x.qualified_plays desc, x.last_played desc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name as artist,a.image_url as artist_image,count(*) as qualified_plays,max(d.occurred_at) as last_played from public.discovery_events d join public.songs s on s.id=d.entity_id left join public.artists a on a.id=s.artist_id where d.user_id=v_user and d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name,a.image_url order by count(*) desc,max(d.occurred_at) desc limit 20) x),'[]'::jsonb) end,
    'platformMostPlayed', coalesce((select jsonb_agg(to_jsonb(x) order by x.qualified_plays desc, x.title asc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name as artist,a.image_url as artist_image,count(*) as qualified_plays from public.discovery_events d join public.songs s on s.id=d.entity_id left join public.artists a on a.id=s.artist_id where d.entity_type='SONG' and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name,a.image_url order by count(*) desc,s.title asc limit 20) x),'[]'::jsonb),
    'popularSongs', coalesce((select jsonb_agg(to_jsonb(x) order by x.score desc, x.title asc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name as artist,a.image_url as artist_image,round((coalesce((select count(*) from public.discovery_events d where d.entity_type='SONG' and d.entity_id=s.id and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE')),0)::numeric * 0.65) + (coalesce((select count(*) from public.music_favorites f where f.song_id=s.id),0)::numeric * 0.35),4) as score from public.songs s left join public.artists a on a.id=s.artist_id where s.audio_url is not null) x),'[]'::jsonb),
    'mostLikedSongs', coalesce((select jsonb_agg(to_jsonb(x) order by x.likes desc, x.title asc) from (select s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name as artist,a.image_url as artist_image,count(f.user_id) as likes from public.songs s left join public.artists a on a.id=s.artist_id left join public.music_favorites f on f.song_id=s.id group by s.id,s.title,s.artist_id,s.audio_url,s.cover_url,s.duration_seconds,a.name,a.image_url order by count(f.user_id) desc,s.title asc limit 20) x),'[]'::jsonb),
    'mostLikedArtists', coalesce((select jsonb_agg(to_jsonb(x) order by x.followers desc, x.name asc) from (select a.id,a.name,a.image_url,a.background_url,count(f.user_id) as followers from public.artists a left join public.artist_followers f on f.artist_id=a.id where a.verified=true group by a.id,a.name,a.image_url,a.background_url order by count(f.user_id) desc,a.name asc limit 20) x),'[]'::jsonb),
    'mostWatchedMusicVideos', coalesce((select jsonb_agg(to_jsonb(x) order by x.qualified_views desc, x.title asc) from (select mv.id,mv.artist_id,mv.title,mv.description,mv.thumbnail_url,mv.video_url,a.name as artist,a.image_url as artist_image,count(d.id) as qualified_views from public.music_videos mv left join public.artists a on a.id=mv.artist_id left join public.discovery_events d on d.entity_type='MUSIC_VIDEO' and d.entity_id=mv.id and d.event_type='VIDEO_VIEW_QUALIFIED' where mv.status='PUBLISHED' group by mv.id,mv.artist_id,mv.title,mv.description,mv.thumbnail_url,mv.video_url,a.name,a.image_url order by count(d.id) desc,mv.title asc limit 20) x),'[]'::jsonb),
    'popularAlbums', coalesce((select jsonb_agg(to_jsonb(x) order by x.score desc, x.title asc) from (select al.id,al.artist_id,al.title,al.description,al.cover_url,round((coalesce((select sum(song_score) from (select s.id,(count(distinct d.id)::numeric + count(distinct mf.user_id)::numeric) as song_score from public.album_songs als join public.songs s on s.id=als.song_id left join public.discovery_events d on d.entity_type='SONG' and d.entity_id=s.id and d.event_type in ('SONG_PLAY_QUALIFIED','SONG_PLAY_COMPLETE') left join public.music_favorites mf on mf.song_id=s.id where als.album_id=al.id group by s.id) scores),0) + coalesce((select count(*) from public.discovery_events d where d.entity_type='ALBUM' and d.entity_id=al.id and d.event_type in ('ALBUM_VIEW','ALBUM_SAVE')),0)::numeric),4) as score from public.albums al where al.status='PUBLISHED') x),'[]'::jsonb),
    'privatePlaylists', case when v_user is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.playlists p where p.user_id=v_user and p.visibility='PRIVATE'),'[]'::jsonb) end,
    'publicPlaylists', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.playlists p where p.visibility='PUBLIC'),'[]'::jsonb),
    'generatedAt', now()
  ) into v;
  return v;
end;
$$;

revoke all on function public.get_discovery_snapshot(numeric,numeric,numeric) from public;
grant execute on function public.get_discovery_snapshot(numeric,numeric,numeric) to anon, authenticated;

comment on function public.get_discovery_snapshot(numeric,numeric,numeric) is
'Canonical discovery categories: trending=current events, nearby=coordinate distance, upcoming=future events, featured=likes or active ORGANIZER_PREMIUM, popular venues=VENUE likes.';
