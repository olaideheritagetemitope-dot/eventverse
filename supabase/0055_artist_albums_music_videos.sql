-- Atizzy artist-owned albums and music-video domains.
-- Uses the existing artists.user_id ownership boundary and managed media URLs.
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.music_videos (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  description text,
  thumbnail_url text,
  video_url text,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists albums_artist_created_idx on public.albums(artist_id, created_at desc);
create index if not exists music_videos_artist_created_idx on public.music_videos(artist_id, created_at desc);

alter table public.albums enable row level security;
alter table public.music_videos enable row level security;

drop policy if exists "albums public published read" on public.albums;
create policy "albums public published read" on public.albums for select using (status = 'PUBLISHED' or exists (select 1 from public.artists a where a.id = albums.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
drop policy if exists "albums owner write" on public.albums;
create policy "albums owner write" on public.albums for all using (exists (select 1 from public.artists a where a.id = albums.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[])) with check (exists (select 1 from public.artists a where a.id = albums.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));

drop policy if exists "music videos public published read" on public.music_videos;
create policy "music videos public published read" on public.music_videos for select using (status = 'PUBLISHED' or exists (select 1 from public.artists a where a.id = music_videos.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
drop policy if exists "music videos owner write" on public.music_videos;
create policy "music videos owner write" on public.music_videos for all using (exists (select 1 from public.artists a where a.id = music_videos.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[])) with check (exists (select 1 from public.artists a where a.id = music_videos.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));

create or replace function public.set_artist_album_status(p_album_id uuid, p_status text)
returns public.albums language plpgsql security definer set search_path = public as $$
declare result public.albums;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('DRAFT','PUBLISHED','ARCHIVED') then raise exception 'Invalid album status'; end if;
  update public.albums x set status = p_status, updated_at = now()
  where x.id = p_album_id and (exists (select 1 from public.artists a where a.id = x.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
  if not found then raise exception 'Album access denied'; end if;
  select * into result from public.albums where id = p_album_id;
  return result;
end; $$;

create or replace function public.set_artist_music_video_status(p_video_id uuid, p_status text)
returns public.music_videos language plpgsql security definer set search_path = public as $$
declare result public.music_videos;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('DRAFT','PUBLISHED','ARCHIVED') then raise exception 'Invalid music-video status'; end if;
  update public.music_videos x set status = p_status, published_at = case when p_status = 'PUBLISHED' then coalesce(x.published_at, now()) else x.published_at end, updated_at = now()
  where x.id = p_video_id and (exists (select 1 from public.artists a where a.id = x.artist_id and a.user_id = auth.uid()) or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
  if not found then raise exception 'Music-video access denied'; end if;
  select * into result from public.music_videos where id = p_video_id;
  return result;
end; $$;

grant execute on function public.set_artist_album_status(uuid,text) to authenticated;
grant execute on function public.set_artist_music_video_status(uuid,text) to authenticated;
notify pgrst, 'reload schema';
