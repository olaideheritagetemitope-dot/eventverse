begin;

-- Artist profile background images use the same managed Storage contract as avatar images.
-- Validate both fields on artist writes while preserving null values for existing profiles.
create or replace function public.validate_atizzy_media_writes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), 'anon');
  v_url text;
  v_item jsonb;
begin
  if v_role = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'venues' then
    if jsonb_typeof(coalesce(new.image_urls, '[]'::jsonb)) <> 'array' then
      raise exception 'Venue photos must be uploaded image assets.' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(coalesce(new.image_urls, '[]'::jsonb)) loop
      if jsonb_typeof(v_item) <> 'string' or not public.is_atizzy_managed_media_url(v_item #>> '{}') then
        raise exception 'Venue photos must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
      end if;
    end loop;
  else
    v_url := case tg_table_name
      when 'user_profiles' then new.avatar_url
      when 'artists' then new.image_url
      when 'songs' then coalesce(new.cover_url, new.audio_url)
      when 'events' then new.cover_url
      when 'posts' then new.image_url
      else null
    end;
    if not public.is_atizzy_managed_media_url(v_url) then
      raise exception 'Images and media must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
    end if;
    if tg_table_name = 'artists' and not public.is_atizzy_managed_media_url(new.background_url) then
      raise exception 'Artist background images must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
    end if;
    if tg_table_name = 'songs' and not public.is_atizzy_managed_media_url(new.cover_url) then
      raise exception 'Song covers must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
    end if;
    if tg_table_name = 'songs' and not public.is_atizzy_managed_media_url(new.audio_url) then
      raise exception 'Audio files must be selected and uploaded through Atizzy Storage.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_atizzy_media_writes() from public, anon, authenticated;

drop trigger if exists trg_validate_artist_media on public.artists;
create trigger trg_validate_artist_media
before insert or update of image_url, background_url on public.artists
for each row execute function public.validate_atizzy_media_writes();

commit;

