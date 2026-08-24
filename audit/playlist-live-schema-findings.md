# Playlist live schema findings — 2026-08-24

The verified EventVerse Supabase project is `blalvoelllndmbppbkcy`.

The live `public.songs` columns include `id`, `artist_id`, `title`, `duration_seconds`, `audio_url`, `cover_url`, `play_count`, `created_at`, `status`, `published_at`, `music_video_url`, and `lyrics_text`. There is **no `lyrics` column**.

The live `public.playlists` columns include `id`, `user_id`, `name`, `created_at`, `visibility`, `description`, `cover_url`, and `updated_at`.

The live `public.playlist_items` columns include `playlist_id`, `song_id`, `position`, `id`, `added_at`, and `added_by`.

Source: bounded `information_schema.columns` query executed against the verified EventVerse Supabase project on 2026-08-24.
