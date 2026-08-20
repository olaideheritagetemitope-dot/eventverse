-- Correct Atizzy managed-media trigger to support table-specific media columns.
-- The previous live function referenced NEW.image_url generically, which fails on
-- user_profiles, events, songs, and venues because their real columns differ.

create or replace function public.validate_atizzy_media_writes()
returns trigger
language plpgsql
security invoker
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
