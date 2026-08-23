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
