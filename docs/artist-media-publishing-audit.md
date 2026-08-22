# Artist media and publishing audit

## Live Supabase project
- Project ref: `blalvoelllndmbppbkcy`
- Region: `eu-west-1`
- Status observed via Supabase project listing: `ACTIVE_HEALTHY`

## Local frontend/service contracts
- `src/services/user.js` uses bucket `atizzy-media`.
- Upload path is `${userId}/${mediaKind.toLowerCase()}/${crypto.randomUUID()}-${safeFileName(file.name)}` with `upsert: false`.
- Upload writes a `media_assets` row with `owner_id`, `bucket_id`, `object_path`, `public_url`, `media_kind`, `mime_type`, `byte_size`, `entity_type`, and `entity_id`.
- `managedMediaUrl` only accepts URLs containing `/storage/v1/object/public/atizzy-media/`.
- `loadArtistWorkspace` queries the user-owned `artists` row, then `songs`, `event_artists` with nested events/venues, and artist booking requests.
- `loadArtistCreatorContent` checks artist ownership and queries `albums` plus `music_videos`.
- Artist profile, song, album, and music-video mutation methods validate managed URLs before writes.
- Album and music-video status changes call `set_artist_album_status` and `set_artist_music_video_status` RPCs.
- `ArtistWorkspace` uploads profile image, song cover/audio, album cover, and video thumbnail/video before writing rows; it calls `loadArtistWorkspace` and `loadArtistCreatorContent` on account user changes.

## Live schema evidence
- `user_profiles` contains `avatar_url`; its `id` references `auth.users`.
- `user_roles` primary key is composite `(user_id, role_id)`.
- Live table metadata read was verbose and confirmed the system uses UUID IDs for content tables and bigint IDs for `roles`.
- `content_comments.author_id` has a foreign key to `user_profiles.id`.

## Potential root blockers identified for next inspection
1. The UI/service assumes public Storage URLs, so a private bucket or signed URL contract would make persisted media fail to render.
2. The managed-media trigger validates `songs.cover_url` and `songs.audio_url`, but the local Artist song service only updates existing songs; the create/publish path must be verified in the actual source/RPCs.
3. The Artist UI must be checked for a real song creation form and a song publish button; the workspace currently visibly exposes album/video creation and video publish controls, while the inspected song handler only saves an existing song.
4. The live database must be queried for bucket metadata, media_assets rows, Artist/song rows, function definitions, and RLS policies before modifying migrations.

Sources: live Supabase MCP project listing and table metadata for project `blalvoelllndmbppbkcy`; local source files under `/home/ubuntu/eventverse`.
