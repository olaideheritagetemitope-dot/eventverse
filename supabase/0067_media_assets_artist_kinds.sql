-- Reconcile the media-assets kind contract with the existing Artist Workspace.
-- Keep legacy kinds valid while allowing the explicit Artist upload kinds used by
-- uploadMediaFile for avatars, artwork, covers, audio, thumbnails, and videos.

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
      'MUSIC_VIDEO_THUMBNAIL',
      'MUSIC_VIDEO',
      'POST_IMAGE'
    )
  );
