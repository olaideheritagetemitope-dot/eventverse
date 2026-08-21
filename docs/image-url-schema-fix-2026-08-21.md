# Atizzy image_url schema mismatch fix — 2026-08-21

## Incident

New record creation failed with PostgreSQL reporting that `record "new" has no field "image_url"`. The shared managed-media trigger had been rewritten to reference heterogeneous table columns directly. Because the same trigger function runs on `user_profiles`, `artists`, `songs`, `events`, `posts`, and `venues`, direct references such as `NEW.image_url`, `NEW.avatar_url`, and `NEW.image_urls` are not valid for every trigger table.

## Root cause

Migration `0041_managed_media_security_definer.sql` reintroduced direct row-field references into the shared trigger after migration `0037` had correctly moved the implementation to table-agnostic JSON row access.

## Fix

Added and applied Supabase migration `0047_fix_managed_media_trigger_regression.sql` to the live Atizzy project. The shared trigger now:

- Converts the trigger row with `to_jsonb(new)`.
- Reads table-specific fields from the JSON row.
- Preserves the managed-Storage-only policy for profiles, artists, songs, events, posts, and venues.
- Reasserts table-specific trigger columns.
- Keeps the security-definer owner and restricted browser permissions.

No URL-only image fallback was restored.

## Validation

- Live Supabase migration applied successfully: `0047_fix_managed_media_trigger_regression`.
- Schema regression coverage added in `tests/image-url-schema-regression.acceptance.test.js`.
- TypeScript passed.
- Focused regression test passed.
- Full suite passed: 41 test files, 140 passing tests, 2 credential-dependent tests skipped.
- Production Vite build passed.
- Existing large-bundle advisory remains non-blocking.
