-- Canonical typed favorite relationship for standalone and linked Music Videos.
-- Song favorites remain in music_favorites(song_id); videos use their own FK.
create table if not exists public.music_video_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  music_video_id uuid not null references public.music_videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, music_video_id)
);

create index if not exists music_video_favorites_video_idx
  on public.music_video_favorites(music_video_id, created_at desc);

alter table public.music_video_favorites enable row level security;

drop policy if exists "users manage own music video favorites" on public.music_video_favorites;
create policy "users manage own music video favorites"
  on public.music_video_favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
