-- Permanent owner-authorized deletion for songs and venues.
-- Public/archive workflows remain available; these RPCs are the explicit destructive path.
-- Songs cascade only through existing schema-defined dependent rows. Venue deletion
-- refuses when bookings exist and relies on events.venue_id ON DELETE SET NULL.

create or replace function public.delete_artist_song(p_song_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song public.songs;
  v_paths text[] := '{}'::text[];
  v_role_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('ADMIN','SUPER_ADMIN')
      and coalesce(ur.status::text, 'ACTIVE') not in ('SUSPENDED','REVOKED','INACTIVE')
  ) into v_role_allowed;

  select s.* into v_song
  from public.songs s
  where s.id = p_song_id
    and (
      exists (select 1 from public.artists a where a.id = s.artist_id and a.user_id = auth.uid())
      or v_role_allowed
    )
  for update;

  if not found then
    raise exception 'Song access denied or song does not exist';
  end if;

  select coalesce(array_agg(ma.object_path) filter (where ma.object_path is not null), '{}'::text[])
    into v_paths
  from public.media_assets ma
  where ma.entity_id = p_song_id
    and ma.entity_type in ('SONG','MUSIC','MUSIC_VIDEO');

  delete from public.media_assets
  where entity_id = p_song_id
    and entity_type in ('SONG','MUSIC','MUSIC_VIDEO');

  delete from public.songs where id = p_song_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'DELETE', 'SONG', p_song_id,
    jsonb_build_object('title', v_song.title, 'media_paths', to_jsonb(v_paths)));

  return jsonb_build_object('id', p_song_id, 'media_paths', to_jsonb(v_paths));
end;
$$;

grant execute on function public.delete_artist_song(uuid) to authenticated;

create or replace function public.delete_owned_venue(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue public.venues;
  v_paths text[] := '{}'::text[];
  v_role_allowed boolean := false;
  v_booking_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('ADMIN','SUPER_ADMIN')
      and coalesce(ur.status::text, 'ACTIVE') not in ('SUSPENDED','REVOKED','INACTIVE')
  ) into v_role_allowed;

  select v.* into v_venue
  from public.venues v
  where v.id = p_venue_id
    and (v.owner_id = auth.uid() or v_role_allowed)
  for update;

  if not found then
    raise exception 'Venue access denied or venue does not exist';
  end if;

  select count(*) into v_booking_count
  from public.venue_bookings vb
  where vb.venue_id = p_venue_id;

  if v_booking_count > 0 then
    raise exception 'Venue cannot be permanently deleted while booking records exist; archive it instead';
  end if;

  select coalesce(array_agg(ma.object_path) filter (where ma.object_path is not null), '{}'::text[])
    into v_paths
  from public.media_assets ma
  where ma.entity_id = p_venue_id
    and ma.entity_type in ('VENUE','VENUE_IMAGE');

  delete from public.media_assets
  where entity_id = p_venue_id
    and entity_type in ('VENUE','VENUE_IMAGE');

  delete from public.venues where id = p_venue_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'DELETE', 'VENUE', p_venue_id,
    jsonb_build_object('name', v_venue.name, 'media_paths', to_jsonb(v_paths), 'booking_count', v_booking_count));

  return jsonb_build_object('id', p_venue_id, 'media_paths', to_jsonb(v_paths));
end;
$$;

grant execute on function public.delete_owned_venue(uuid) to authenticated;

notify pgrst, 'reload schema';
