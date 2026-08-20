# Atizzy Image Upload Selection Implementation — 2026-08-20

## Scope

Replaced URL-oriented image entry with a shared device-photo selection workflow across profile, artist, event, venue, post, and music-cover surfaces. The uploader now supports explicit selection, previews, replacement, removal, accessible labels, MIME validation, wildcard MIME matching, and a 50 MB limit.

## Frontend

`src/EventVerse.jsx` now uses the shared `MediaUploadField` as a real photo selector. URL-only image controls are removed from the active app source. New selections are previewed with `URL.createObjectURL`, and existing managed assets can be replaced or removed.

## Service layer

`src/services/user.js` validates image-bearing mutations with `managedMediaUrl`. Authenticated mutations reject manually pasted external URLs and require an Atizzy Storage public asset URL. Uploads continue through the authenticated `atizzy-media` bucket and `media_assets` registration flow.

## Database enforcement

`supabase/0036_managed_media_write_guard.sql` was applied to the live Supabase project. It adds managed-media validation triggers for `user_profiles`, `artists`, `songs`, `events`, `posts`, and `venues`. Legacy records remain readable, service-role maintenance remains allowed, and authenticated direct writes using arbitrary external URLs are rejected.

## Validation

- Focused image upload contract: 3/3 tests passed.
- Full Vitest suite: 29 test files, 103 tests passed.
- TypeScript: passed.
- Vite production build: passed.
- Existing build advisory: the main JavaScript bundle remains above 500 kB; no build failure occurred.
- Live migration result: successful.

## Trigger correction

A production error reported `record "new" has no field "image_url"`. The live schema audit confirmed that media columns differ by table: `user_profiles.avatar_url`, `artists.image_url`, `events.cover_url`, `posts.image_url`, `songs.cover_url` and `audio_url`, and `venues.image_urls` JSONB. The original live trigger function had a generic `NEW.image_url` reference.

Migration `0037_fix_managed_media_trigger_columns.sql` was applied successfully. The corrected trigger serializes `NEW` to JSONB and reads only the table-specific field names, so it cannot dereference a missing column. All six managed-media triggers remain installed. The full suite then passed with 29 test files and 103 tests, TypeScript passed, and the production build passed.
