-- Playlist permissions: owners retain full control; owners may optionally allow public edits.
-- Public editors can mutate only items and metadata on playlists that remain PUBLIC.

alter table public.playlists
  add column if not exists public_edit_enabled boolean not null default false;

create index if not exists playlists_public_edit_enabled_idx
  on public.playlists(visibility, public_edit_enabled, updated_at desc);

comment on column public.playlists.public_edit_enabled is
  'Owner-controlled opt-in allowing authenticated users to edit items and metadata while the playlist remains PUBLIC.';

-- The original owner policy remains authoritative for owners. These policies add
-- narrowly scoped capabilities for authenticated non-owners only when opted in.
drop policy if exists "public editors update public playlists" on public.playlists;
create policy "public editors update public playlists"
on public.playlists for update
using (
  auth.uid() is not null
  and auth.uid() <> user_id
  and visibility = 'PUBLIC'
  and public_edit_enabled = true
)
with check (
  auth.uid() is not null
  and user_id = user_id
  and visibility = 'PUBLIC'
  and public_edit_enabled = true
);

drop policy if exists "public editors add playlist items" on public.playlist_items;
create policy "public editors add playlist items"
on public.playlist_items for insert
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.playlists p
    where p.id = playlist_items.playlist_id
      and p.visibility = 'PUBLIC'
      and p.public_edit_enabled = true
  )
);

drop policy if exists "public editors update playlist items" on public.playlist_items;
create policy "public editors update playlist items"
on public.playlist_items for update
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.playlists p
    where p.id = playlist_items.playlist_id
      and p.visibility = 'PUBLIC'
      and p.public_edit_enabled = true
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.playlists p
    where p.id = playlist_items.playlist_id
      and p.visibility = 'PUBLIC'
      and p.public_edit_enabled = true
  )
);

drop policy if exists "public editors remove playlist items" on public.playlist_items;
create policy "public editors remove playlist items"
on public.playlist_items for delete
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.playlists p
    where p.id = playlist_items.playlist_id
      and p.visibility = 'PUBLIC'
      and p.public_edit_enabled = true
  )
);
