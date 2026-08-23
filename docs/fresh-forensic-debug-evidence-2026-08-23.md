# Fresh Forensic Debug Evidence — 2026-08-23

## Scope
Read-only audit of the full Atizzy repository, frontend, Vercel API routes, Supabase live contracts, payments, media, playback, authentication, governance, and deployment/tooling.

## Local validation baseline
- Vitest: 61 files passed; 225 tests passed; 3 skipped.
- TypeScript: `pnpm exec tsc --noEmit` passed.
- Production build: passed; minified JS chunk is approximately 1.57 MB and triggers the existing >500 kB warning.
- Lint: failed because `/home/ubuntu/eventverse/package.json` has no `lint` script (`ERR_PNPM_NO_SCRIPT`).

## Live Supabase evidence

### RLS policies
The live `songs` and `venues` public SELECT policies are not unconditional. They restrict anonymous/public visibility to `songs.status = 'PUBLISHED'` and `venues.status = 'ACTIVE'`, while allowing owner/admin access. Albums, music videos, and events also have publication/status predicates. Engagement row reads are self-only for authenticated users or Super Admin (`content_likes`, `content_ratings`). This falsifies the stale diagnosis that those tables currently have `USING (true)` public reads.

### RPC privilege drift
Live privilege query confirmed:
- `public.admin_list_users_page(text,text,text,integer,integer)` is `SECURITY DEFINER`, executable by `anon = true` and `authenticated = true`.
- Its repository migration `0098_paginated_governance_user_directory.sql` intends to revoke public execution and grant only `authenticated`/`service_role`, so this is confirmed production grant drift or migration-state regression.
- Live body does include `where public.has_admin_permission('users.manage')`, which reduces exploitability but does not remove the defense-in-depth issue or anonymous attack surface.
- `get_discovery_snapshot`, `get_cold_start_discovery_catalogue`, `get_role_onboarding_public_config`, and `get_content_engagement_summary` are anonymous-callable and appear to be intended public allowlist routines; body review is still required for each data boundary.
- Protected examples `admin_dashboard_snapshot`, `admin_list_users`, `activate_artist_fee_transaction`, `validate_ticket_qr`, and `wallet_credit_for_cancelled_order` are not anonymously executable.

### Governance frontend accuracy
`src/components/SuperAdminModuleRegistry.jsx` currently derives `users.length`, role counts, `pending.length`, and directory record counts from the loaded page. The directory is now paginated, but overview metrics and role coverage remain page-local rather than using a server aggregate. The component still renders `filteredUsers.slice(0, 100)` and filters pending applications with `PENDING`, `PENDING_REVIEW`, and `REQUEST_CHANGES`. This can make overview counts and role-directory totals inaccurate when more than one page exists, even though page navigation is present.

## Payment source review
- Ticket initializer uses the authoritative `initialize_order_payment` RPC, requires an idempotency key, returns a server transaction reference, initializes Paystack in kobo, attaches the provider reference through a service-authorized RPC, and persists checkout fields.
- Role and Artist initializers similarly use server-generated transaction references and idempotency keys, but persist provider checkout fields through direct service-role REST PATCHes rather than a single provider-attachment RPC. This is a consistency/auditability risk and should be checked against unique constraints, row-count assertions, and replay behavior.
- Premium webhook resolves payment with an OR lookup across `transaction_reference` and `provider_reference` with `limit=1`; it does not assert that exactly one payment row matched. Because references are intended unique, this is currently a defense-in-depth ambiguity risk, not proven exploitable.

## Stale/false-positive classification
The independent debugging diagnosis that `songs`/`venues` remain publicly readable regardless of status is stale/false based on current live policy predicates. The anonymous execution of `admin_list_users_page` is confirmed live and conflicts with migration intent. The missing lint script and governance page-local aggregate issue are confirmed local defects.

## No modifications
No source, database data, schema, configuration, or deployment changes have been made during this fresh audit.

## Static scan evidence
- `package.json` exposes `dev`, `build`, `preview`, `check`, and `test`, but no `lint` script; any CI or delivery procedure invoking `pnpm lint` fails immediately with `ERR_PNPM_NO_SCRIPT`.
- Production source uses `window.localStorage` for onboarding completion and pending ticket, Artist, and Premium payment callback state. This is not automatically a vulnerability, but it is a cross-tab/device recovery limitation and can leave callbacks unrecoverable after storage clearing, private browsing, browser changes, or a callback landing on a different device.
- Static scan output was truncated in the terminal; the full raw scan was captured temporarily at `/tmp/atizzy-static-audit.txt` and should be regenerated if exact line-by-line evidence is needed.

## Payment uniqueness and webhook evidence
Live `pg_indexes` inspection shows unique indexes exist for `transaction_reference` and provider references on `payments`, `artist_fee_transactions`, `role_application_payments`, `venue_booking_payments`, and `premium_payments`; scoped idempotency indexes also exist on the expected ownership/application keys. The earlier information_schema result was incomplete because it did not expose index-only uniqueness for several tables. No missing unique transaction-reference boundary was confirmed.

The multi-payment webhook and Premium webhook resolve records using `OR(provider_reference = reference, transaction_reference = reference) LIMIT 1`. Because the deployed transaction/provider references are unique within each table, cross-column ambiguity is unlikely, but neither handler asserts an exact single-row match. This remains a defense-in-depth correctness risk if legacy data violates assumptions or future schema changes weaken uniqueness.

## Repository/deployment drift — confirmed high risk
The current working tree is dirty while `main` tracks `origin/main` at commit `8e53d50`. Fifteen tracked files contain uncommitted remediation edits, including core frontend, payment routes, services, and tests. Migrations `0084` through `0094` and `0096` through `0098`, plus Premium API routes, are untracked. Therefore the current checkout does not prove that live fixes are versioned in GitHub or reproducible by a fresh clone; a deployment sourced from `origin/main` can omit these changes. This is a release-integrity/P0 risk even though local tests/builds pass.

## Vercel production runtime errors — confirmed
The linked production project reports five grouped error clusters in the last seven days. The highest-impact live failures are: `role-initialize` Duplicate Transaction Reference (10 occurrences, 2 users); ticket `/api/paystack/initialize` rejecting provider-reference attachment (5 occurrences, 2 users); ticket `/api/paystack/initialize` Duplicate Transaction Reference (4 occurrences, 2 users); Artist initialization requiring an Artist profile before verification (2 occurrences, 2 users); and Artist initialization disabled by platform policy (2 occurrences, 2 users). These are real production failures, not merely static concerns. The latest production deployment is still commit `8e53d50`, while the working tree contains later uncommitted payment and policy changes, confirming deployment drift is likely contributing.

## Deep live RPC body audit
The live `admin_list_users_page(text,text,text,integer,integer)` remains `SECURITY DEFINER` with ACL `anon=X`, `authenticated=X`, and `service_role=X`; its body checks `public.has_admin_permission('users.manage')` before selecting `auth.users.email`, sign-in timestamps, ban state, profile names, and role status arrays. The body-level check lowers immediate exploitability, but anonymous execution remains a confirmed defense-in-depth and privacy exposure because the routine is callable by unauthenticated clients and returns directory/account metadata when authorization context is bypassed or misconfigured.

`get_cold_start_discovery_catalogue` is anonymous-callable and visibly limits content to published songs with audio URLs, verified artists, published albums, active venues, published/sold-out/live/completed events, published music videos, and public playlists. `get_content_engagement_summary` is anonymous-callable and returns aggregate counts plus authenticated-user-specific booleans only when `auth.uid()` exists; this is consistent with an intentional public engagement-summary contract. `get_discovery_snapshot` is anonymous-callable and filters public discovery records by publication/status predicates, but its full body requires separate performance review because it computes multiple correlated aggregate subqueries.

## Fresh validation discrepancy
Current local validation has 61 passing test files, 225 passing tests, and 3 skipped. TypeScript and Vite production build pass. `pnpm lint` fails because the package has no `lint` script, and a direct `pnpm exec eslint .` also fails because ESLint is not installed in the project. The production bundle is approximately 1.57 MB minified and triggers Vite’s >500 kB chunk warning.

## Deep payment-route findings

- `api/paystack/role-initialize.js:28-44` and `api/paystack/artist-initialize.js:28-42` persist provider references and checkout fields through direct service-role REST `PATCH` calls, unlike ticket payments which use the provider-attachment RPC. This duplicates authority across payment domains and can diverge from the database state machine; the route does not assert that exactly one row was updated.
- `api/paystack/venue-initialize.js` follows the same direct service-role PATCH pattern for `venue_booking_payments`, so provider-reference authority is not centralized across all Paystack flows.
- `api/paystack/role-initialize.js:55` and `artist-initialize.js` treat any existing `authorization_url` or `provider_reference` as a replay, without checking the persisted payment status, reference ownership, or whether the checkout fields are internally consistent. This can return a stale or partially initialized provider checkout as successful replay state. Confirmed defense-in-depth/state-machine risk; requires live replay tests to prove user impact.
- `api/paystack/premium-webhook.js` and `api/paystack/webhook.js` use OR lookups with `limit=1` and do not assert exactly one matching row. Unique indexes reduce likelihood but do not eliminate ambiguity across legacy/incorrect records. Confirmed defense-in-depth correctness risk.
- `api/paystack/verify.js:51` requests the order without an explicit `limit=1`; it later uses the first row. The order id is expected unique, but the route lacks a row-count assertion and is less defensive than the payment query.
