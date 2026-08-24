-- Playlist visibility/delete policy hardening.
-- Owners retain full lifecycle control; opted-in public editors cannot change ownership.

-- Make the owner delete path explicit and independently inspectable.
drop policy if exists "owners delete own playlists" on public.playlists;
create policy "owners delete own playlists"
on public.playlists for delete
using (auth.uid() = public.playlists.user_id);

-- Replace the ambiguous legacy owner check with a stable owner-preserving check.
drop policy if exists "public editors update public playlists" on public.playlists;
create policy "public editors update public playlists"
on public.playlists for update
using (
  auth.uid() is not null
  and auth.uid() <> public.playlists.user_id
  and public.playlists.visibility = 'PUBLIC'
  and public.playlists.public_edit_enabled = true
)
with check (
  auth.uid() is not null
  and public.playlists.user_id = (
    select p.user_id
    from public.playlists as p
    where p.id = public.playlists.id
  )
  and public.playlists.visibility = 'PUBLIC'
  and public.playlists.public_edit_enabled = true
);

comment on policy "owners delete own playlists" on public.playlists is
  'Explicit owner-only playlist deletion. Child playlist items cascade through playlist_items_playlist_id_fkey.';
