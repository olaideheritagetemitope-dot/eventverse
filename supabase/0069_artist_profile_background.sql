-- Atizzy Artist profile presentation media
-- Keeps image_url as the profile/avatar image and adds an optional general profile background.
alter table public.artists
  add column if not exists background_url text;

comment on column public.artists.background_url is
  'Optional Storage-backed URL for the Artist profile detail background image.';
