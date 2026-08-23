-- Atizzy public catalogue visibility hardening.
-- Remove unconditional public reads that exposed non-published songs and non-active venues.
-- Preserve owner/admin access through the existing owner policies.

begin;

 drop policy if exists "public can view songs" on public.songs;
 drop policy if exists "songs public published read" on public.songs;
 create policy "songs public published read" on public.songs
   for select
   to public
   using (
     status = 'PUBLISHED'
     or exists (
       select 1
       from public.artists a
       where a.id = songs.artist_id
         and a.user_id = auth.uid()
     )
     or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[])
   );

 drop policy if exists "public can view venues" on public.venues;
 create policy "venues public active read" on public.venues
   for select
   to public
   using (
     status = 'ACTIVE'
     or owner_id = auth.uid()
     or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::public.app_role[])
   );

 notify pgrst, 'reload schema';
 commit;
