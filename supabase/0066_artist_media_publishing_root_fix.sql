-- Artist media and publishing root fix.
-- The live atizzy-media bucket was public but rejected video MIME types, while
-- public.songs had no publishing state or status RPC. Keep existing rows intact.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/gif',
  'audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/x-m4a',
  'video/mp4','video/webm'
]
where id = 'atizzy-media';

alter table public.songs
  add column if not exists status text not null default 'DRAFT',
  add column if not exists published_at timestamptz;

update public.songs
set status = 'PUBLISHED', published_at = coalesce(published_at, created_at)
where status is null;

alter table public.songs drop constraint if exists songs_status_check;
alter table public.songs add constraint songs_status_check check (status in ('DRAFT','PUBLISHED','ARCHIVED'));

create index if not exists songs_artist_status_created_idx
  on public.songs(artist_id, status, created_at desc);

alter table public.songs enable row level security;

drop policy if exists "songs public published read" on public.songs;
create policy "songs public published read" on public.songs
for select using (
  status = 'PUBLISHED'
  or exists (select 1 from public.artists a where a.id = songs.artist_id and a.user_id = auth.uid())
  or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[])
);

drop policy if exists "songs owner write" on public.songs;
create policy "songs owner write" on public.songs
for all using (
  exists (select 1 from public.artists a where a.id = songs.artist_id and a.user_id = auth.uid())
  or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[])
) with check (
  exists (select 1 from public.artists a where a.id = songs.artist_id and a.user_id = auth.uid())
  or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[])
);

create or replace function public.set_artist_song_status(p_song_id uuid, p_status text)
returns public.songs
language plpgsql security definer set search_path = public
as $$
declare result public.songs;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('DRAFT','PUBLISHED','ARCHIVED') then raise exception 'Invalid song status'; end if;
  update public.songs x
  set status = p_status,
      published_at = case when p_status = 'PUBLISHED' then coalesce(x.published_at, now()) else x.published_at end
  where x.id = p_song_id
    and (
      exists (select 1 from public.artists a where a.id = x.artist_id and a.user_id = auth.uid())
      or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[])
    );
  if not found then raise exception 'Song access denied'; end if;
  select * into result from public.songs where id = p_song_id;
  return result;
end;
$$;

grant execute on function public.set_artist_song_status(uuid,text) to authenticated;
notify pgrst, 'reload schema';
