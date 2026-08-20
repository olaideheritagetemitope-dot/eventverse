# Atizzy Strict Root-Cause Audit — 20 August 2026

## Executive finding

The frontend catalog and governance surfaces now use live Supabase services and preserve explicit loading, empty, success, and error states. The remaining production-integrity defect was configuration drift: the browser client had been made environment-driven, but two runtime acceptance tests still carried project-specific Supabase fallbacks. Those test fallbacks were removed so the repository no longer encodes a silent project choice outside deployment configuration.

## Source and data-path evidence

The audited catalog chain is `Supabase query/RPC → catalog service → React state → existing Atizzy cards/sections`. Empty collections retain their original visual structures and render empty-state messaging. Request failures are surfaced as error states; they do not substitute fictional catalog records.

A repository-wide scan of `src/**` found no remaining `MOCK`, `DEMO`, `mockData`, `demoData`, `fakeData`, `sampleData`, `fallbackData`, or static `EVENTS`/`ARTISTS`/`SONGS`/`VENUES`/`TICKETS`/`ALBUMS` catalog declarations.

## Configuration repair

`src/lib/supabase.js` now reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exclusively. It derives a non-secret project reference for diagnostics and uses an invalid sentinel only to keep the shell mountable when deployment configuration is absent; no catalog data is fabricated. The browser client remains session-persistent, auto-refreshing, URL-aware, and PKCE-enabled.

The runtime hardening and service-role tests now read the same environment variables and skip credential-dependent checks when those variables are not supplied. The Paystack order, artist, venue, and webhook routes now also read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`/service-role configuration from deployment environment variables and fail explicitly when required configuration is absent. They no longer fall back to the historical Supabase project URL or publishable key.

## Validation

| Check | Result |
|---|---|
| TypeScript no-emit check | Passed |
| Vitest | 38 files passed; 132 tests passed; 2 credential-dependent tests skipped without configured secrets |
| Vite production build | Passed; only the existing large-chunk advisory remains |
| Forbidden mock/fallback source scan | No matches in `src/**` or live payment route configuration |
| Vercel project | `eventverse`, Vite, production domain `eventverse-eight.vercel.app` |
| Latest Vercel production deployment | READY, but built from GitHub SHA `7e7954794e729d6d16114dc484384189355ecf0f` with commit `Fix recursive orders RLS authorization` |
| Current audited source | Local `main` is ahead of that deployment and still requires a production push/deploy to reflect this audit |

## Production conclusion

The code-side strict-fix is validated. Vercel is linked to the correct GitHub repository and production domain, but the currently reported production deployment predates the latest local strict-fix source. The final operational step is to commit and push the audited changes to `main`, then confirm the resulting Vercel production deployment is `READY` and uses the intended Supabase environment variables. The Vercel project metadata endpoint available in this session exposes project and deployment metadata but not secret values, so exact variable-value comparison must be completed in the Vercel project settings or deployment build environment without exposing credentials.
