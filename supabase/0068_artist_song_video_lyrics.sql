-- Artist songs: optional attached music video and synchronized lyrics payload.
alter table public.songs
  add column if not exists music_video_url text,
  add column if not exists lyrics_text text;

notify pgrst, 'reload schema';
