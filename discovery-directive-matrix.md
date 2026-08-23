# Atizzy Master Discovery and Analytics Directive

## Authority and implementation rule

The supplied `pasted_content.txt` is the authoritative specification for the discovery/home experience. Existing Atizzy cards, sections, navigation, loading states, empty states, and responsive structure must remain intact. Only the underlying live-data services, analytics, authorization, ranking calculations, and state wiring may change. No fabricated records, random ordering, hardcoded metrics, creation-date substitutes, or frontend-only ranking logic are permitted.

## Category contracts

| Category | Literal definition | Required data source | Calculation/order | Scope and privacy | Acceptance test |
|---|---|---|---|---|---|
| Events | General event catalogue | Published, non-cancelled events | Product discovery order: active/relevant, upcoming/available, then recent publication; not popularity by default | Public catalogue | No popular-only label or popularity substitution |
| Upcoming Events | Events beginning in the future | Event start timestamp and lifecycle status | `start_datetime > now()`, exclude ended/cancelled, ascending start time | Public | Soonest valid future event first |
| Popular Artists | Artists with measurable overall engagement | Qualified song plays, song likes, artist follows/likes, qualified video views | Deterministic documented weighted normalized score | Public aggregate only | Ranking changes from real engagement, never age/name/randomness |
| Trending Events | Events gaining recent momentum | Event views/interactions, purchases, saves, shares, attendance/booking events | Current recent window versus previous equivalent window; momentum score distinct from lifetime popularity | Public aggregate only | A fast-growing event can outrank an older high-total event |
| Events Near You | Events geographically near current user | User permissioned location and venue latitude/longitude | Great-circle distance, configured radius, proximity/relevance order | User location never exposed publicly | City-string matching is not accepted; denial has a truthful fallback |
| Popular Venues | Venues with meaningful engagement | Venue views, hosted events, event views, ticket purchases, bookings, favorites, attendance | Deterministic normalized engagement score | Public aggregate only | No created-at/name proxy |
| Recently Played | Current user’s latest unique tracks | Server playback history with `user_id`, `song_id`, `played_at` | Latest play per song, descending `played_at` | Private, authenticated user only | User A cannot see User B history |
| Most Played | Explicitly scoped ranking, never ambiguous | Personal history or platform aggregate depending on explicit UI label | Separate `personalMostPlayed` and `platformMostPlayed`; period documented | Scope follows label | No ambiguous `mostPlayed` data source |
| Popular Songs | Songs with highest overall engagement | Qualified plays, active likes, optional recent engagement | Lifetime/overall deterministic ranking; recent trend kept separate | Public aggregate only | No fake play/like counts |
| Popular Albums | Albums whose tracks perform best | Album tracks and aggregate track plays/likes, album saves/views if available | Deduplicated sum/normalized album-level score | Public aggregate only | Ten-track album aggregates each track once |
| Private Most Played Songs | Songs most played by current user | User-scoped qualified playback records | Count qualified plays per `(user_id, song_id)`, descending | Private and RLS-protected | No cross-user private-stat leakage |
| Platform Most Played Songs | Songs with most qualified plays platform-wide | Aggregate qualified playback records | `sum(qualified plays) group by song`, descending | Public aggregate without identities | No individual history or identity exposure |
| Most Liked Songs | Songs with highest active likes | Current active like state | Count active unique likes per song | Public aggregate; user toggle protected | Like/unlike does not permanently inflate count |
| Most Liked Artists | Artists with highest active follows/likes | Current artist relationship model | Count active unique follows/likes per artist | Public aggregate | Not derived from plays or creation date |
| Most Watched Music Videos | Videos with highest qualified views | Actual video play/view events with duration/completion | Qualified-view threshold, descending; completion secondary if reliable | Public aggregate without viewer identities | Page render alone never counts a view |
| Private Playlists | Owner-only playlists | Playlists with private visibility and owner identity | Owner-scoped query | Private; database RLS required | Absent from public discovery, profiles, search, recommendations |
| Publicly Collated Playlists | Intentionally public/discoverable playlists | Playlist visibility state | Public-only catalogue order defined by product | Public; private/collaborative semantics explicit | Database prevents private rows leaking |

## Cross-cutting data and security requirements

| Area | Required behavior | Verification |
|---|---|---|
| Analytics source of truth | Persist ranking-driving events server-side; reuse existing playback system rather than creating a competing path | Schema/RPC audit and end-to-end mutation tests |
| Qualified song play | Record only after audio actually starts; capture start, duration, completion, timestamp, user, song, and session; deduplicate rerender/retry noise | Start/pause/resume/seek/end tests and duplicate-attempt test |
| Video view | Record meaningful playback, duration, completion, and viewer/session where available; page render is insufficient | Player event tests |
| Time windows | Document per-category windows: lifetime, 30-day, 7-day, 24-hour, or chronological as appropriate | Query/RPC assertions per category |
| Ranking normalization | Put normalized weighting in one backend/data layer; avoid scattered frontend constants | Deterministic score fixtures and source audit |
| Data consistency | Plays, likes, follows, views, playlist changes, event creation/booking, and purchases eventually update relevant rankings | Mutation-to-discovery refresh/invalidation tests |
| Privacy | Private categories use authenticated user scope; public categories expose only aggregates | RLS and unauthorized-query tests |
| Performance | Start correct; add indexes/views/aggregates only against actual schema and volume | Explain/query review and indexed-column audit |
| Empty states | Preserve Atizzy empty-state shells and use truthful copy for no history, no nearby events, and no public playlists | UI state tests |
| No fake data | Remove `Math.random`, fabricated counts, static ranking data, and misleading labels from all reachable paths | Repository grep and zero-record production checks |
| Centralization | One discovery service/data layer exposes explicit functions for all categories | Import graph and service contract tests |
| Semantic acceptance | Every displayed title must match its literal data contract | Category-by-category acceptance matrix |

## Required centralized service surface

`getEvents`, `getUpcomingEvents`, `getPopularArtists`, `getTrendingEvents`, `getNearbyEvents`, `getPopularVenues`, `getRecentlyPlayed(userId)`, `getPersonalMostPlayed(userId)`, `getPlatformMostPlayed()`, `getPopularSongs`, `getPopularAlbums`, `getUserMostPlayedSongs(userId)`, `getPlatformMostPlayedSongs`, `getMostLikedSongs`, `getMostLikedArtists`, `getMostWatchedMusicVideos`, `getPrivatePlaylists(userId)`, and `getPublicPlaylists` must be implemented in one authoritative discovery/data layer and consumed by the preserved frontend sections.

## Final report contract

Before completion, report for every category the exact definition, source tables/events, calculation and normalization method, privacy scope, time window, empty-state behavior, and verification result. Any user-only gates, such as granting browser location permission or scanning with a physical device, must be explicitly identified rather than represented as completed.

## Execution status note — 2026-08-23
The local canonical discovery migration, service integration, frontend semantic bindings, and acceptance coverage are implemented and locally validated. Applying and verifying migration `0081_canonical_discovery_analytics.sql` against the live Supabase project is still pending because the Supabase connector reported that its service is under maintenance. This is an explicit release gate; no live completion claim is made until the migration, RLS policies, RPCs, trigger, and production snapshot are verified remotely.

## Cold-start implementation status — 2026-08-23

The cold-start directive is implemented in the repository and live Supabase project. Migration `0081_canonical_discovery_analytics` applied successfully, followed by `0082_cold_start_discovery_catalogues`. The live database exposes `get_discovery_snapshot(numeric,numeric,numeric)` and `get_cold_start_discovery_catalogue(integer,integer)`. The live catalogue response currently contains eligible latest songs, all songs, new venues, and latest events; empty arrays for artists, albums, videos, public playlists, and future events accurately reflect the current dataset rather than fabricated content.

Local verification passed: 56 Vitest files, 198 tests passed, 2 skipped; TypeScript passed; production Vite build passed; and `git diff --check` passed. The remaining release gate is committing/pushing the final source and saving a checkpoint.
