# Home Blank-Screen Root-Cause Evidence

## Production inspection

- URL inspected: https://eventverse-eight.vercel.app/
- At 2026-08-23 05:55 UTC, unauthenticated production rendered the Atizzy Login screen, not a blank page.
- The browser console had no uncaught output on the unauthenticated route.
- Production HTML referenced `/assets/index-DSwSbt7S.js`.
- The deployed bundle contains `get_discovery_snapshot`, `get_cold_start_discovery_catalogue`, and `Promise.allSettled`, confirming the resilience code is deployed.

## Source trace

- `src/services/catalog.js:133-150` still has an authoritative `Promise.all` across events, artists, songs, categories, and venues; any base catalog query error throws and returns no catalog to the root loader.
- The root loader sets `catalogError` on a failed `loadCatalog`, while `catalog` remains the initial empty object.
- `src/EventVerse.jsx` constructs every screen element in the `screens` object before selecting `screens[current.screen]`, so an exception in any non-active screen component can blank the whole React tree.
- Auth restore sets `authReady` in `finally`; authenticated users are routed to Home only from the restore/session listener paths.

## Current hypothesis to prove, not yet a fix

The previous resilience change only isolated the two discovery RPCs. It did not isolate the five-query base `loadCatalog()` request, and it did not protect the eager construction of all screens. The persistent production symptom must be reproduced with authenticated runtime evidence to determine which of these is the first failing invariant.

## Proven catalog-loader failure — 2026-08-23

The persistent Home failure was not caused by the new discovery RPCs after all. The base `loadCatalog()` path still used a fatal `Promise.all`, but the attempted isolation fix introduced a second deterministic bug in `settleCatalogQueries()`: `entries.map(([name], _query, index) => ...)` read the callback's third argument (the full entries array) as `index`, so `settled[index]` was `undefined` for every catalog query. Accessing `result.status` then threw before `loadCatalog()` could return any catalog. This exactly explains why Home remained blank after the prior resilience patch.

Root fix: use the actual map index, `entries.map(([name], index) => ...)`, and settle each query into `{ data, error }`, preserving successful base arrays while exposing isolated `catalogErrors`. Regression coverage now asserts the corrected index contract and non-throwing partial result contract.

## Proven discovery render-shape failure — 2026-08-23

The recording shows Home first rendering placeholder cards and then returning to a black screen. The current source confirms that `loadDiscoverySnapshot()` preferred raw SQL-shaped rows from `get_discovery_snapshot` and `get_cold_start_discovery_catalogue` over the normalized base catalog. Those RPC rows contain fields such as `starts_at`, `city`, and `cover_url`, but not the UI contract required by `EventCard`, especially the derived `date` string used by `ev.date.split(" ")`, nor the derived `venue` and `img` fields.

This created a render-time invariant failure when Home switched from its initial empty/loading state to a non-empty discovery array. The previous Promise settlement fix was correct but insufficient: it preserved data without converting it to the existing Atizzy card contract. The root fix is a single normalization boundary in `src/services/discovery.js`, using the existing catalog transformers before discovery data reaches Home and Explore. Focused regression coverage now proves that a raw discovery event has a safe `date`, `venue`, and `img`, and that the EventCard date operation cannot throw.

## Proven deletion authorization schema failure — 2026-08-23

The reported `column ur.role does not exist` error came from the destructive RPC authorization checks in migrations 0072, 0073, and 0076. The live `user_roles` table stores `role_id`; the role name is stored in `roles.code`. The failing functions therefore errored before artist or Super Admin authorization could be evaluated.

Migration 0083, `fix_delete_role_column`, recreated `delete_artist_song(uuid)` and `delete_owned_venue(uuid)` with `join public.roles r on r.id = ur.role_id` and `r.code in ('ADMIN','SUPER_ADMIN')`, while preserving ownership checks, active-status checks, audit logging, venue booking-history preservation, and existing return contracts. Supabase accepted the migration, and live function inspection confirmed both deployed bodies use the canonical join.

Validation passed: focused deletion regression, full suite with 58 files and 209 passing tests plus 2 skipped, TypeScript validation, production build, diff check, and source scan showing no stale executable `ur.role` reference in `src`, `api`, or tests. Live authenticated deletion smoke testing remains the final user-side confirmation gate.

## Music-video visibility regression — 2026-08-23

The artist publishing path and Supabase `music_videos` public-read policy were already present. The user-visible omission occurred after publishing: the root catalog did not load music videos as a base live-data resource, `loadArtistDetail` returned only the artist row, and the public Music and Artist Profile render branches contained no music-video section/tab. Discovery arrays were preserved but could not guarantee visibility when discovery was empty or unavailable.

Root fix applied: added a published-video base catalog query with URL eligibility, a shared `toMusicVideo` UI normalization boundary, published-video loading in artist detail, a Music screen section using the existing Atizzy section/card patterns, and a Music Videos tab on Artist Profile using the existing music-detail route. No mock records or visual redesign were introduced.

Validation: focused music-video visibility tests passed; full suite passed with 59 files, 210 passing tests, and 3 skipped; TypeScript validation, production build, and `git diff --check` passed. Production deployment verification remains pending.
