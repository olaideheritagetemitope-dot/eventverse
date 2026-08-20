begin;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'atizzy-media',
  object_path text not null unique,
  public_url text not null,
  media_kind text not null check (media_kind in ('AVATAR','ARTIST_ARTWORK','EVENT_POSTER','VENUE_PHOTO','AUDIO','POST_IMAGE')),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

alter table public.media_assets enable row level security;

drop policy if exists "media assets owner read" on public.media_assets;
create policy "media assets owner read" on public.media_assets for select to authenticated using (
  owner_id = auth.uid()
  or public.has_any_app_role(array['ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role])
);

drop policy if exists "media assets owner insert" on public.media_assets;
create policy "media assets owner insert" on public.media_assets for insert to authenticated with check (
  owner_id = auth.uid()
);

drop policy if exists "media assets owner delete" on public.media_assets;
create policy "media assets owner delete" on public.media_assets for delete to authenticated using (
  owner_id = auth.uid()
  or public.has_any_app_role(array['ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role])
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atizzy-media',
  'atizzy-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/x-m4a']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "atizzy media authenticated upload own folder" on storage.objects;
create policy "atizzy media authenticated upload own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'atizzy-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "atizzy media public read" on storage.objects;
create policy "atizzy media public read" on storage.objects for select to public using (
  bucket_id = 'atizzy-media'
);

drop policy if exists "atizzy media owner update" on storage.objects;
create policy "atizzy media owner update" on storage.objects for update to authenticated using (
  bucket_id = 'atizzy-media'
  and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'atizzy-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "atizzy media owner delete" on storage.objects;
create policy "atizzy media owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'atizzy-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
