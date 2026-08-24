-- Playlist cover media and mutation contract.
-- Extends the existing playlist model; does not create a second playlist system.

alter table public.media_assets
  drop constraint if exists media_assets_media_kind_check;

alter table public.media_assets
  add constraint media_assets_media_kind_check check (
    media_kind in (
      'AVATAR',
      'ARTIST_AVATAR',
      'ARTIST_ARTWORK',
      'EVENT_POSTER',
      'VENUE_PHOTO',
      'AUDIO',
      'MUSIC_COVER',
      'ALBUM_COVER',
      'PLAYLIST_COVER',
      'MUSIC_VIDEO_THUMBNAIL',
      'MUSIC_VIDEO',
      'POST_IMAGE'
    )
  );

create index if not exists media_assets_playlist_cover_idx
  on public.media_assets(entity_type, entity_id, media_kind)
  where media_kind = 'PLAYLIST_COVER';

comment on column public.playlists.cover_url is 'Managed Supabase Storage URL for the playlist cover; populated through PLAYLIST_COVER media assets.';
comment on column public.playlists.visibility is 'PUBLIC exposes the playlist through public discovery; PRIVATE remains owner-only.';
