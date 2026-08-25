-- Canonical relationship-based Related Content engine.
-- Returns generic cards so all detail pages share one ranking/visibility contract.
create index if not exists event_artists_artist_event_idx on public.event_artists(artist_id, event_id);
create index if not exists playlist_items_song_playlist_idx on public.playlist_items(song_id, playlist_id);
create index if not exists songs_artist_status_idx on public.songs(artist_id, status, published_at desc);
create index if not exists albums_artist_status_idx on public.albums(artist_id, status, release_date desc);
create index if not exists music_videos_artist_status_idx on public.music_videos(artist_id, status, published_at desc);
create index if not exists events_organizer_status_time_idx on public.events(organizer_id, status, starts_at);
create index if not exists events_venue_status_time_idx on public.events(venue_id, status, starts_at);

create or replace function public.get_related_content(
  p_entity_type text,
  p_entity_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_limit integer default 12
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := upper(trim(coalesce(p_entity_type, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
  v_result jsonb;
begin
  if p_entity_id is null or v_type not in ('EVENT','ARTIST','VENUE','SONG','ALBUM','MUSIC_VIDEO','PLAYLIST') then
    return jsonb_build_object('items','[]'::jsonb,'entity_type',v_type);
  end if;

  with candidates as (
    select 'EVENT'::text as content_type, e.id, e.title,
      coalesce(e.city, 'Event') as subtitle, e.cover_url as image_url,
      (case when v_type = 'EVENT' and (e.organizer_id = (select organizer_id from events where id=p_entity_id) or e.venue_id = (select venue_id from events where id=p_entity_id)) then 100 else 0 end)
      + (case when v_type in ('EVENT','VENUE') and e.event_type = (select event_type from events where id=p_entity_id) then 35 else 0 end)
      + (case when v_type = 'ARTIST' and exists (select 1 from event_artists ea where ea.event_id=e.id and ea.artist_id=p_entity_id) then 90 else 0 end)
      + (case when v_type in ('EVENT','VENUE','ARTIST') and e.starts_at > now() then 12 else 0 end)
      + (case when e.starts_at > now() then 5 else 0 end)::numeric as relevance_score,
      e.starts_at as recency_at
    from events e
    where e.id <> p_entity_id and e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')
      and (e.starts_at is null or e.starts_at >= now() - interval '1 day')

    union all
    select 'ARTIST', a.id, a.name, 'Artist', coalesce(a.image_url, a.background_url),
      (case when v_type = 'EVENT' and exists (select 1 from event_artists ea where ea.event_id=p_entity_id and ea.artist_id=a.id) then 100 else 0 end)
      + (case when v_type = 'ARTIST' and a.id <> p_entity_id then 50 else 0 end)
      + (case when v_type in ('SONG','ALBUM','MUSIC_VIDEO') and a.id = coalesce((select artist_id from songs where id=p_entity_id),(select artist_id from albums where id=p_entity_id),(select artist_id from music_videos where id=p_entity_id)) then 90 else 0 end)
      + least(coalesce(a.follower_count,0), 100)::numeric * 0.05 as relevance_score,
      a.updated_at as recency_at
    from artists a
    where a.id <> p_entity_id and a.verified = true

    union all
    select 'VENUE', v.id, v.name, coalesce(v.city, v.address, 'Venue'),
      case when jsonb_typeof(v.image_urls) = 'array' then v.image_urls->>0 else v.image_urls->>'url' end,
      (case when v_type = 'EVENT' and v.id = (select venue_id from events where id=p_entity_id) then 120 else 0 end)
      + (case when v_type = 'VENUE' and lower(coalesce(v.city,'')) = lower(coalesce((select city from venues where id=p_entity_id),'')) then 45 else 0 end)
      + (case when p_latitude is not null and p_longitude is not null and v.latitude is not null and v.longitude is not null then greatest(0, 35 - (6371 * acos(least(1,greatest(-1,sin(radians(p_latitude))*sin(radians(v.latitude))+cos(radians(p_latitude))*cos(radians(v.latitude))*cos(radians(v.longitude)-radians(p_longitude))))))) else 0 end)::numeric as relevance_score,
      v.updated_at as recency_at
    from venues v
    where v.id <> p_entity_id and v.status::text = 'ACTIVE'

    union all
    select 'SONG', s.id, s.title, coalesce(a.name, 'Artist pending'), s.cover_url,
      (case when v_type = 'ARTIST' and s.artist_id=p_entity_id then 110 else 0 end)
      + (case when v_type = 'SONG' and s.artist_id=(select artist_id from songs where id=p_entity_id) then 85 else 0 end)
      + (case when v_type = 'ALBUM' and exists (select 1 from album_songs ax where ax.song_id=s.id and ax.album_id=p_entity_id) then 100 else 0 end)
      + (case when v_type = 'PLAYLIST' and exists (select 1 from playlist_items px join playlist_items py on py.song_id=px.song_id where px.playlist_id=p_entity_id and py.playlist_id <> p_entity_id and py.song_id=s.id) then 70 else 0 end)
      + least(coalesce(s.play_count,0), 200)::numeric * 0.02 as relevance_score,
      coalesce(s.published_at,s.created_at) as recency_at
    from songs s left join artists a on a.id=s.artist_id
    where s.id <> p_entity_id and s.status::text='PUBLISHED' and s.audio_url is not null

    union all
    select 'ALBUM', al.id, al.title, coalesce(a.name, 'Artist pending'), al.cover_url,
      (case when v_type = 'ARTIST' and al.artist_id=p_entity_id then 110 else 0 end)
      + (case when v_type = 'ALBUM' and al.artist_id=(select artist_id from albums where id=p_entity_id) then 85 else 0 end)
      + (case when v_type = 'SONG' and exists (select 1 from album_songs ax where ax.album_id=al.id and ax.song_id=p_entity_id) then 100 else 0 end)
      + (case when v_type = 'PLAYLIST' and exists (select 1 from album_songs ax join playlist_items px on px.song_id=ax.song_id where ax.album_id=al.id and px.playlist_id=p_entity_id) then 65 else 0 end) as relevance_score,
      coalesce(al.release_date::timestamptz,al.created_at) as recency_at
    from albums al left join artists a on a.id=al.artist_id
    where al.id <> p_entity_id and al.status::text='PUBLISHED'

    union all
    select 'MUSIC_VIDEO', mv.id, mv.title, coalesce(a.name, 'Artist pending'), mv.thumbnail_url,
      (case when v_type = 'ARTIST' and mv.artist_id=p_entity_id then 110 else 0 end)
      + (case when v_type = 'MUSIC_VIDEO' and mv.artist_id=(select artist_id from music_videos where id=p_entity_id) then 85 else 0 end)
      + (case when v_type = 'SONG' and mv.song_id=p_entity_id then 120 else 0 end)
      + (case when v_type = 'ALBUM' and exists (select 1 from album_songs ax where ax.album_id=p_entity_id and ax.song_id=mv.song_id) then 90 else 0 end) as relevance_score,
      coalesce(mv.published_at,mv.created_at) as recency_at
    from music_videos mv left join artists a on a.id=mv.artist_id
    where mv.id <> p_entity_id and mv.status::text='PUBLISHED' and mv.video_url is not null

    union all
    select 'PLAYLIST', p.id, p.name, 'Public playlist', p.cover_url,
      (case when v_type='SONG' and exists (select 1 from playlist_items pi where pi.playlist_id=p.id and pi.song_id=p_entity_id) then 105 else 0 end)
      + (case when v_type='ARTIST' and exists (select 1 from playlist_items pi join songs s2 on s2.id=pi.song_id where pi.playlist_id=p.id and s2.artist_id=p_entity_id) then 95 else 0 end)
      + (case when v_type='ALBUM' and exists (select 1 from playlist_items pi join album_songs ax on ax.song_id=pi.song_id where pi.playlist_id=p.id and ax.album_id=p_entity_id) then 85 else 0 end)
      + (case when v_type='PLAYLIST' and exists (select 1 from playlist_items px join playlist_items py on py.song_id=px.song_id where px.playlist_id=p_entity_id and py.playlist_id=p.id) then 75 else 0 end) as relevance_score,
      coalesce(p.updated_at,p.created_at) as recency_at
    from playlists p
    where p.id <> p_entity_id and p.visibility='PUBLIC'
  ), ranked as (
    select content_type,id,title,subtitle,image_url,
      relevance_score + (case when recency_at > now()-interval '30 days' then 4 else 0 end) as score,
      recency_at,
      row_number() over (partition by content_type order by relevance_score desc, recency_at desc nulls last, title asc) as type_rank
    from candidates
    where relevance_score > 0
  )
  select jsonb_build_object(
    'entity_type', v_type,
    'items', coalesce(jsonb_agg(jsonb_build_object('contentType',content_type,'id',id,'title',title,'subtitle',subtitle,'imageUrl',image_url,'score',round(score,2)) order by score desc, recency_at desc nulls last, title asc) filter (where type_rank <= v_limit), '[]'::jsonb)
  ) into v_result
  from ranked;

  return coalesce(v_result, jsonb_build_object('entity_type',v_type,'items','[]'::jsonb));
end;
$$;

revoke all on function public.get_related_content(text,uuid,numeric,numeric,integer) from public;
grant execute on function public.get_related_content(text,uuid,numeric,numeric,integer) to anon, authenticated;
