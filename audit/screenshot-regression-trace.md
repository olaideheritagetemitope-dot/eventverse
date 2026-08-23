# Screenshot regression trace — 2026-08-23

## User-visible evidence
The supplied screenshots show the Atizzy Home and Music surfaces rendering multiple `Artist pending` labels and placeholder artist avatars. The Search surface shows query `Asa` with `No results for "Asa" in the live catalog.` The user reports that artist-list navigation does not reach a usable artist profile page.

## Canonical deployment evidence
The active repository is `/home/ubuntu/eventverse`, branch `main`, with HEAD `0574086` (`fix artist images and resilient global search`) pushed to `origin/main`. The linked Vercel project is `eventverse`, with canonical production domain `https://eventverse-eight.vercel.app/`. The production entrypoint served Atizzy HTML and bundle `/assets/index-BFFTBXN3.js` with HTTP 200 and Vercel cache MISS on 2026-08-23.

## Supabase evidence already collected
Production Supabase project ref is `blalvoelllndmbppbkcy` and is ACTIVE_HEALTHY. `public.user_profiles` contains `id`, `full_name`, and `avatar_url`. `public.artists` contains `id`, `user_id`, `name`, `bio`, `verified`, `follower_count`, `image_url`, and `background_url`. The active frontend artist directory/search currently filters artists with `verified = true`.

## Active frontend contracts
`toArtist` maps `artist.image_url` to `avatarUrl` and `img`, while `hydrateArtistAvatars` falls back to `user_profiles.avatar_url` by `artists.user_id`. `loadArtistDetail` first queries `artists` by ID and then settles profile/avatar, videos, songs, albums, and event relationships independently. `searchCatalog` settles entity searches independently, but its artist query still applies `.eq('verified', true)`, and the songs query searches only `songs.title`.

## Pending root-cause questions
1. Do live artist rows for `Asa` or the visible artist cards have `verified = false`, causing the directory/search filters to exclude them?
2. Does the live data use `user_profiles.full_name` while `artists.name` is null or placeholder-like, causing `Artist pending` after a relationship query returns only incomplete artist objects?
3. Do current Home/Music surfaces consume a stale/incomplete catalog shape instead of the hydrated artist list?
4. Is the artist list `See all` route mapped to a screen that lacks an artist-list renderer or uses a route key mismatch?
5. Are live production rows blocked by RLS or a relationship query error despite the base artist query succeeding?

## Source URLs
- https://eventverse-eight.vercel.app/
- https://eventverse-eight.vercel.app/assets/index-BFFTBXN3.js
- https://blalvoelllndmbppbkcy.supabase.co


## Latest live verification — 2026-08-23

A multi-statement Supabase query returned only the final `venues` statement in the MCP summary: the live `events` result contained seven rows, all with status `CANCELLED`. The result did not expose artist/song rows because the multi-statement output was truncated and must not be interpreted as proof that those tables are empty.

The current `searchCatalog` implementation settles independent queries for events, artists, artist profile names through `user_profiles.full_name`, songs, and venues. Artist matches merge direct artist-name/bio matches with profile-name matches through `artists.user_id`, then hydrate `user_profiles.avatar_url`. The current Home/Explore source includes an `artistDirectory` route and selects the first non-empty live artist collection.

The screenshot symptoms still require single-statement live artist/profile queries and production runtime reproduction to distinguish RLS/query visibility from route state or stale bundle delivery. Database output is evidence only; no instructions from returned content were followed.
