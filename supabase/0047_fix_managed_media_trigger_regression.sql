-- Fix the managed-media trigger regression introduced by the security-definer rewrite.
-- Direct NEW.image_url/NEW.avatar_url/NEW.image_urls references are unsafe in a
-- trigger shared by tables with different schemas. Read the row as JSON instead.

create or replace function public.validate_atizzy_media_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), 'anon');
  v_row jsonb := to_jsonb(new);
  v_url text;
  v_item jsonb;
begin
  if v_role = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'venues' then
    if jsonb_typeof(coalesce(v_row -> 'image_urls', '[]'::jsonb)) <> 'array' then
      raise exception 'Venue photos must be uploaded image assets.' using errcode = '22023';
    end if;

    for v_item in
      select value from jsonb_array_elements(coalesce(v_row -> 'image_urls', '[]'::jsonb))
    loop
      if jsonb_typeof(v_item) <> 'string'
        or not public.is_atizzy_managed_media_url(v_item #>> '{}') then
        raise exception 'Venue photos must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
      end if;
    end loop;
  elsif tg_table_name = 'songs' then
    if not public.is_atizzy_managed_media_url(v_row ->> 'cover_url') then
      raise exception 'Song covers must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
    end if;
    if not public.is_atizzy_managed_media_url(v_row ->> 'audio_url') then
      raise exception 'Audio files must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
    end if;
  else
    v_url := case tg_table_name
      when 'user_profiles' then v_row ->> 'avatar_url'
      when 'artists' then v_row ->> 'image_url'
      when 'events' then v_row ->> 'cover_url'
      when 'posts' then v_row ->> 'image_url'
      else null
    end;

    if not public.is_atizzy_managed_media_url(v_url) then
      raise exception 'Images and media must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_atizzy_media_writes() from public, anon, authenticated;
alter function public.validate_atizzy_media_writes() owner to postgres;

-- Reassert the table-specific trigger columns after replacing the shared function.
drop trigger if exists trg_validate_user_profile_media on public.user_profiles;
create trigger trg_validate_user_profile_media
before insert or update of avatar_url on public.user_profiles
for each row execute function public.validate_atizzy_media_writes();

drop trigger if exists trg_validate_artist_media on public.artists;
create trigger trg_validate_artist_media
before insert or update of image_url on public.artists
for each row execute function public.validate_atizzy_media_writes();

drop trigger if exists trg_validate_song_media on public.songs;
create trigger trg_validate_song_media
before insert or update of cover_url, audio_url on public.songs
for each row execute function public.validate_atizzy_media_writes();

drop trigger if exists trg_validate_event_media on public.events;
create trigger trg_validate_event_media
before insert or update of cover_url on public.events
for each row execute function public.validate_atizzy_media_writes();

drop trigger if exists trg_validate_post_media on public.posts;
create trigger trg_validate_post_media
before insert or update of image_url on public.posts
for each row execute function public.validate_atizzy_media_writes();

drop trigger if exists trg_validate_venue_media on public.venues;
create trigger trg_validate_venue_media
before insert or update of image_urls on public.venues
for each row execute function public.validate_atizzy_media_writes();
