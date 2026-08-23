-- Standalone Music Video contract.
-- A video is first-class and may optionally reference a Song; deleting a Song
-- must not delete an independently published Music Video.
alter table public.music_videos
  add column if not exists song_id uuid references public.songs(id) on delete set null;

create index if not exists music_videos_song_id_idx on public.music_videos(song_id);

notify pgrst, 'reload schema';
