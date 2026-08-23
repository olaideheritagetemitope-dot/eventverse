-- Premium attendee surfaces: one server-authoritative read boundary for every Premium-only attendee feature.
-- This migration is additive and reuses the existing Atizzy event, artist, ticket, favorite,
-- and play-history tables. No synthetic catalogue rows are generated.

create or replace function public.get_premium_event_discovery(
  p_category text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_radius_km numeric default 25
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v jsonb;
  v_radius numeric := greatest(coalesce(p_radius_km, 25), 1);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.premium_feature_enabled('advanced_discovery', v_user) then
    raise exception 'Premium advanced discovery is required';
  end if;
  if p_min_price is not null and p_min_price < 0 then raise exception 'Minimum price cannot be negative'; end if;
  if p_max_price is not null and p_max_price < 0 then raise exception 'Maximum price cannot be negative'; end if;
  if p_min_price is not null and p_max_price is not null and p_min_price > p_max_price then raise exception 'Minimum price cannot exceed maximum price'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Both coordinates are required'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at asc, x.created_at desc), '[]'::jsonb)
    into v
  from (
    select
      e.id,
      e.title,
      e.description,
      e.event_type,
      e.city,
      e.starts_at,
      e.ends_at,
      e.cover_url,
      e.status,
      e.rating,
      e.review_count,
      e.venue_id,
      e.created_at,
      coalesce((select min(tt.price) from public.ticket_types tt where tt.event_id = e.id), 0) as min_price,
      coalesce((select jsonb_agg(c.name order by c.name) from public.event_categories ec join public.categories c on c.id = ec.category_id where ec.event_id = e.id), '[]'::jsonb) as categories,
      case when p_latitude is null or p_longitude is null or v.latitude is null or v.longitude is null then null else round((6371 * acos(least(1, greatest(-1, sin(radians(p_latitude))*sin(radians(v.latitude)) + cos(radians(p_latitude))*cos(radians(v.latitude))*cos(radians(v.longitude)-radians(p_longitude))))))::numeric, 2) end as distance_km
    from public.events e
    left join public.venues v on v.id = e.venue_id
    where e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')
      and e.starts_at > now()
      and (nullif(trim(p_category), '') is null or exists (
        select 1 from public.event_categories ec join public.categories c on c.id = ec.category_id
        where ec.event_id = e.id and (lower(c.name) = lower(trim(p_category)) or lower(c.slug) = lower(trim(p_category)))
      ))
      and (p_min_price is null or exists (select 1 from public.ticket_types tt where tt.event_id = e.id and tt.price >= p_min_price))
      and (p_max_price is null or exists (select 1 from public.ticket_types tt where tt.event_id = e.id and tt.price <= p_max_price))
      and (p_latitude is null or p_longitude is null or v.latitude is null or v.longitude is null or (6371 * acos(least(1, greatest(-1, sin(radians(p_latitude))*sin(radians(v.latitude)) + cos(radians(p_latitude))*cos(radians(v.latitude))*cos(radians(v.longitude)-radians(p_longitude)))))) <= v_radius)
    order by e.starts_at asc, e.created_at desc
    limit 100
  ) x;
  return coalesce(v, '[]'::jsonb);
end;
$$;

create or replace function public.get_premium_attendee_snapshot() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_premium_access(v_user) then raise exception 'Active Premium entitlement required'; end if;

  select jsonb_build_object(
    'hasPremium', true,
    'features', jsonb_build_object(
      'follow_radar', public.premium_feature_enabled('follow_radar', v_user),
      'planner', public.premium_feature_enabled('planner', v_user),
      'personal_statistics', public.premium_feature_enabled('personal_statistics', v_user),
      'premium_badge', public.premium_feature_enabled('premium_badge', v_user),
      'advanced_discovery', public.premium_feature_enabled('advanced_discovery', v_user),
      'advanced_location', public.premium_feature_enabled('advanced_location', v_user)
    ),
    'followRadar', case when public.premium_feature_enabled('follow_radar', v_user) then coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts_at asc)
      from (
        select distinct on (e.id)
          e.id,
          e.title,
          e.starts_at,
          e.ends_at,
          e.city,
          e.cover_url,
          e.status,
          a.id as artist_id,
          a.name as artist_name,
          a.image_url as artist_image_url
        from public.artist_followers f
        join public.artists a on a.id = f.artist_id and a.verified = true
        join public.event_artists ea on ea.artist_id = a.id
        join public.events e on e.id = ea.event_id
        where f.user_id = v_user
          and e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')
          and e.starts_at > now()
        order by e.id, e.starts_at asc
        limit 100
      ) x
    ), '[]'::jsonb) else '[]'::jsonb end,
    'planner', case when public.premium_feature_enabled('planner', v_user) then coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts_at asc)
      from (
        select distinct on (e.id)
          e.id,
          e.title,
          e.starts_at,
          e.ends_at,
          e.city,
          e.cover_url,
          e.status,
          case when ef.event_id is not null then true else false end as saved,
          case when t.owner_id is not null then true else false end as ticketed
        from public.events e
        left join public.event_favorites ef on ef.event_id = e.id and ef.user_id = v_user
        left join public.tickets t on t.ticket_type_id in (select tt.id from public.ticket_types tt where tt.event_id = e.id) and t.owner_id = v_user and t.status::text not in ('CANCELLED','REFUNDED','EXPIRED')
        where (ef.user_id is not null or t.owner_id is not null)
          and e.status::text not in ('CANCELLED','REJECTED')
          and e.starts_at >= now()
        order by e.id, e.starts_at asc
        limit 100
      ) x
    ), '[]'::jsonb) else '[]'::jsonb end,
    'musicStats', case when public.premium_feature_enabled('personal_statistics', v_user) then jsonb_build_object(
      'totalPlays', (select count(*) from public.play_history ph where ph.user_id = v_user),
      'totalSeconds', coalesce((select sum(ph.seconds_played) from public.play_history ph where ph.user_id = v_user), 0),
      'uniqueSongs', (select count(distinct ph.song_id) from public.play_history ph where ph.user_id = v_user),
      'likedSongs', (select count(*) from public.music_favorites mf where mf.user_id = v_user),
      'topSongs', coalesce((select jsonb_agg(to_jsonb(x) order by x.plays desc, x.title asc) from (
        select s.id, s.title, s.cover_url, s.artist_id, count(*) as plays, coalesce(sum(ph.seconds_played), 0) as seconds_played
        from public.play_history ph join public.songs s on s.id = ph.song_id
        where ph.user_id = v_user
        group by s.id, s.title, s.cover_url, s.artist_id
        order by count(*) desc, s.title asc
        limit 10
      ) x), '[]'::jsonb)
    ) else jsonb_build_object('totalPlays', 0, 'totalSeconds', 0, 'uniqueSongs', 0, 'likedSongs', 0, 'topSongs', '[]'::jsonb) end,
    'generatedAt', now()
  ) into v;
  return v;
end;
$$;

revoke all on function public.get_premium_event_discovery(text,numeric,numeric,numeric,numeric,numeric) from public;
revoke all on function public.get_premium_attendee_snapshot() from public;
grant execute on function public.get_premium_event_discovery(text,numeric,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.get_premium_attendee_snapshot() to authenticated;

notify pgrst, 'reload schema';
