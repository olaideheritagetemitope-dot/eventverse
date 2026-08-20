# Urgent Home Data Trace — 2026-08-20

## Reported Home entities

The directive reports these visible Home entities as fake: Burna Boy, Burna Boy — The Summit, Eko Convention Centre, The Vibes Fest, Freedom Park, Wizkid Live In Concert, and ABC Event Centre.

## Repository trace

The named records are not present in the tracked frontend source or generated frontend data constants. They are present in `supabase/0004_eventverse_catalog_seed.sql`, which inserts catalog seed rows into `public.venues`, `public.artists`, `public.events`, and `public.songs`. Therefore the reported content is not coming from the current frontend mock arrays; it is seeded database content being returned by the live catalog service.

## Live Supabase trace

Production project: `blalvoelllndmbppbkcy` (EventVerse), status ACTIVE_HEALTHY, region eu-west-1.

Live `public.events` rows include:

- `Wizkid Live In Concert`
- `Burna Boy — The Summit`
- `The Vibes Fest`
- `Ayra Starr — Solar`
- `Phyno — Live In Enugu`
- `Odi Aviction Live`
- an additional user-created `Ggggv` row with status CANCELLED

Live `public.songs` rows include `Mood`, `Last Last`, `Rush`, `Calm Down`, and `Love Nwantiti`. Live rows use gradient strings such as `linear-gradient(...)` in media fields rather than managed Storage URLs.

Live schema confirms:

- `artists`: `id`, `user_id`, `name`, `bio`, `verified`, `follower_count`, `image_url`, timestamps.
- `events`: `id`, `organizer_id`, `venue_id`, `title`, `description`, `event_type`, `city`, `starts_at`, `ends_at`, `cover_url`, `status`, `rating`, `review_count`, timestamps.
- `songs`: `id`, `artist_id`, `title`, `duration_seconds`, `audio_url`, `cover_url`, `play_count`, `created_at`.
- `venues`: `id`, `owner_id`, `name`, `city`, `address`, `capacity`, description, venue type, amenities, rules, contact phone, `image_urls`, pricing, cancellation policy, timestamps.

## Deployment alignment

Repository: `https://github.com/olaideheritagetemitope-dot/eventverse.git`, branch `main`, current local HEAD before this investigation `324c28f` with inherited uncommitted changes. Supabase URL in `src/lib/supabase.js` is `https://blalvoelllndmbppbkcy.supabase.co`.

## Diagnosis

The Home mock-data problem has two layers: (1) the frontend is correctly using live catalog services rather than literal frontend demo arrays, but (2) the live database still contains catalog seed/demo rows from migration `0004_eventverse_catalog_seed.sql`, and the rows contain placeholder gradient media values. Removing only frontend constants cannot remove these records. The safe fix must preserve the UI and service architecture while either removing seed rows from the live production data through an explicitly scoped, server-authoritative cleanup or marking/replacing seed records so live catalog queries exclude them. Any cleanup must avoid deleting real user-created records such as `Ggggv` without a precise provenance guard.

Source: live Supabase MCP table/schema/row queries for project `blalvoelllndmbppbkcy`; repository source `supabase/0004_eventverse_catalog_seed.sql` and `src/lib/supabase.js`.

## Final implementation decision

The exact synthetic catalog IDs are now excluded centrally in `src/services/catalog.js` from catalog loading, search results, event detail, and venue detail. The seven named Home entities therefore cannot render through the live frontend service boundary even if the underlying seeded rows remain in Supabase.

Production cleanup was deliberately not destructive: the dependency audit found **3 order_items** tied to the synthetic ticket types, while tickets, staff assignments, private-access attempts, and posts were zero. Deleting the seeded rows would risk removing purchase history or breaking commerce references. The implementation preserves those records and removes only their frontend visibility. Regression coverage was added in `tests/urgent-home-synthetic-filter.acceptance.test.js`.

Validation: 37 test files, 123 passing tests, TypeScript, and production build. The build reports only the existing large-bundle advisory.
