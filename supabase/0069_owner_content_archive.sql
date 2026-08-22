-- Owner-authorized archival for artist songs and venue listings.
-- Archiving preserves historical references while removing content from public discovery.

alter table public.venues add column if not exists status text not null default 'ACTIVE';
update public.venues set status = 'ACTIVE' where status is null;

create or replace function public.archive_artist_song(p_song_id uuid)
returns public.songs
language plpgsql
security definer
set search_path = public
as $$
declare result public.songs;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.songs s
  set status = 'ARCHIVED'
  where s.id = p_song_id
    and (exists (select 1 from public.artists a where a.id = s.artist_id and a.user_id = auth.uid())
      or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
  if not found then raise exception 'Song access denied'; end if;
  select * into result from public.songs where id = p_song_id;
  return result;
end;
$$;
grant execute on function public.archive_artist_song(uuid) to authenticated;

create or replace function public.archive_owned_venue(p_venue_id uuid)
returns public.venues
language plpgsql
security definer
set search_path = public
as $$
declare result public.venues;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.venues v
  set status = 'ARCHIVED', updated_at = now()
  where v.id = p_venue_id
    and (v.owner_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
  if not found then raise exception 'Venue access denied'; end if;
  select * into result from public.venues where id = p_venue_id;
  return result;
end;
$$;
grant execute on function public.archive_owned_venue(uuid) to authenticated;

notify pgrst, 'reload schema';
