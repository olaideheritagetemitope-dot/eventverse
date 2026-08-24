-- Canonical Atizzy playlist system completion.
-- Extends the existing user-owned playlist model without replacing or duplicating it.

alter table public.playlists
  add column if not exists description text,
  add column if not exists cover_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.playlist_items
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists added_at timestamptz not null default now(),
  add column if not exists added_by uuid references auth.users(id) on delete set null;

update public.playlist_items
set id = gen_random_uuid()
where id is null;

alter table public.playlist_items
  alter column id set not null;

create unique index if not exists playlist_items_id_uidx
  on public.playlist_items(id);
create index if not exists playlist_items_playlist_position_idx
  on public.playlist_items(playlist_id, position, added_at);
create index if not exists playlists_visibility_created_idx
  on public.playlists(visibility, created_at desc);
create index if not exists playlists_user_updated_idx
  on public.playlists(user_id, updated_at desc);

do $$ begin
  alter table public.playlists
    add constraint playlists_name_not_blank_check check (length(trim(name)) > 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.playlist_items
    add constraint playlist_items_position_nonnegative_check check (position >= 0);
exception when duplicate_object then null;
end $$;

create or replace function public.touch_playlist_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_playlist_updated_at on public.playlists;
create trigger trg_touch_playlist_updated_at
before update on public.playlists
for each row execute function public.touch_playlist_updated_at();

drop policy if exists "public can view public playlists" on public.playlists;
create policy "public can view public playlists"
on public.playlists for select
using (visibility = 'PUBLIC');

drop policy if exists "public can view public playlist items" on public.playlist_items;
create policy "public can view public playlist items"
on public.playlist_items for select
using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id
      and p.visibility = 'PUBLIC'
  )
);

comment on table public.playlists is 'Canonical user-owned playlists. user_id is the owner identity; visibility controls public discovery.';
comment on column public.playlist_items.song_id is 'Foreign key to public.songs only; music-video IDs are not valid playlist items.';
