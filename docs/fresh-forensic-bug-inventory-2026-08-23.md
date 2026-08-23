# Atizzy Full-Code Forensic Debug Inventory

**Audit date:** 23 August 2026
**Mode:** Read-only; no source, database data, schema, configuration, or deployment changes were made during this audit.
**Scope:** Frontend routes and state, Supabase schema/RPC/RLS/grants, authentication and RBAC, onboarding, Paystack payments, media/storage, playback, API routes, tests/build/lint, GitHub state, and Vercel production evidence.

## Executive assessment

The application is locally buildable and has broad regression coverage, but the deployment and source-of-truth boundaries are not currently reliable enough to claim production parity. The most serious issue is **release-integrity drift**: the production deployment is still on commit `8e53d50`, while the working tree contains later remediation edits and untracked migrations. Several confirmed production error clusters are therefore plausibly running code that differs from the locally audited code.

The second highest-priority issue is a live **anonymous execution grant on `admin_list_users_page`**, a `SECURITY DEFINER` routine that returns account directory metadata after an internal permission check. The body check reduces exploitability, but anonymous execution is not consistent with the intended authenticated-only governance boundary and must be revoked in the deployed database.

The fresh audit also confirms a missing lint toolchain, page-local Super Admin aggregate metrics, duplicated provider-reference mutation paths across payment types, and stale/ambiguous replay handling in role and Artist payment initializers. The earlier diagnosis that songs and venues have unconditional public reads is **not confirmed**: live RLS predicates currently require published/active status for public access.

## Severity and evidence matrix

| ID | Severity | Finding | Evidence | Confidence | Recommended remediation |
|---|---:|---|---|---|---|
| F-01 | P0 | **Production deployment/source drift.** Current `main` remains at `8e53d50`; later remediation files and migrations `0084–0098` are untracked or uncommitted. | `docs/fresh-forensic-debug-evidence-2026-08-23.md:49–53`; Git status and Vercel deployment inspection. | Confirmed | Establish a clean release process: commit migrations and source, push the intended branch, verify Vercel commit/status, and reconcile live migration history before further feature claims. |
| F-02 | P0 | **Anonymous execution of governance directory RPC.** `public.admin_list_users_page(text,text,text,integer,integer)` is `SECURITY DEFINER` with `anon=X`. Its body selects email, sign-in timestamps, ban state, profile names, and role arrays after an internal permission check. | Live ACL/body query, evidence lines `17–23` and `55–58`. | Confirmed | Revoke `EXECUTE` from `anon`; grant only `authenticated` and `service_role`; verify with a live anonymous negative test and authenticated Super Admin positive test. |
| F-03 | P0 | **Live production payment failures are still occurring.** Vercel reports duplicate transaction references, provider-reference authority rejection, Artist profile gating, and disabled Artist policy errors. | Five grouped runtime-error clusters, 23 total occurrences across the reported groups; evidence `52–53`. | Confirmed | Deploy and verify the current payment/policy fixes, then replay each failure class with an authenticated test user and confirm database state transitions. |
| F-04 | P1 | **Governance overview metrics are page-local.** User counts, role counts, pending counts, and directory totals are derived from the current loaded page even though the directory is paginated. | `SuperAdminModuleRegistry.jsx` current render logic; evidence `25–26`. | Confirmed | Add server aggregate fields to the directory/snapshot contract or use a dedicated aggregate RPC. Keep page counts and global counts explicitly labeled. |
| F-05 | P1 | **Payment provider-reference writes are duplicated across domains.** Ticket payments use `attach_payment_provider_reference`, while role, Artist, and venue initializers directly PATCH tables using the service role. | `api/paystack/role-initialize.js:28–44`, `artist-initialize.js:28–42`, `venue-initialize.js`; evidence `63–66`. | Confirmed architectural defect | Consolidate provider attachment behind one authoritative RPC/state transition per payment family, or one generic audited provider-attachment routine. Assert exactly one row changed and validate status/idempotency ownership in the database. |
| F-06 | P1 | **Role/Artist replay detection is too broad.** Existing `authorization_url` or `provider_reference` is treated as a successful replay without validating payment status, idempotency-key ownership, transaction/reference consistency, or whether checkout is complete. | `role-initialize.js:55`, corresponding Artist initializer; evidence `67`. | Confirmed state-machine risk | Replay only the same authenticated payment attempt and only from an allowed pending/initialized state. Reject stale/partial checkout records and return an explicit recoverable state. |
| F-07 | P1 | **Webhook lookup does not enforce exact cardinality.** Multi-payment and Premium webhooks use OR matching across provider and transaction references with `LIMIT 1`, without asserting that one and only one row matched. | `api/paystack/webhook.js`, `premium-webhook.js`; evidence `31`, `47`, `68`. | Confirmed defense-in-depth risk | Replace ambiguous lookup with a database routine that detects zero, one, or multiple matches; reject multiple matches and log an integrity alert. |
| F-08 | P1 | **Provider-reference uniqueness is table-local, not globally centralized.** Live unique indexes exist in each payment table, but reference resolution spans multiple payment families and multiple reference columns. | Live `pg_indexes` inspection; evidence `44–47`. | Confirmed design risk, not proven exploit | Use a shared payment-attempt identity or enforce globally unique references across all payment families if the webhook namespace is shared. |
| F-09 | P1 | **Missing explicit order cardinality assertion in payment verification.** `verify.js:51` queries an order without `limit=1` and consumes the first row. | `api/paystack/verify.js:51`; evidence `69`. | Confirmed defensive defect | Add `limit=1`, assert exactly one order, and fail closed on duplicate/missing order records. |
| F-10 | P1 | **Lint validation is unavailable.** `package.json` has no `lint` script and ESLint is not installed in the project, so lint cannot act as a CI quality gate. | `audit-fresh-validation-2026-08-23.txt`, `audit-lint-drift-2026-08-23.txt`; evidence `6–10`, `60–61`. | Confirmed | Add a pinned ESLint configuration and dependency, define `pnpm lint`, and run it in CI before deployment. |
| F-11 | P1 | **Callback recovery relies on browser localStorage.** Onboarding and pending payment callback state use `window.localStorage`, which is device/browser scoped and can be lost or unavailable when a callback opens elsewhere. | Static scan; evidence `39–42`. | Confirmed reliability limitation | Make the server-side payment/application record the recovery source. Use URL reference plus authenticated server lookup, with localStorage only as an optional convenience cache. |
| F-12 | P1 | **Super Admin visible module projection is incomplete.** Many categories render explanatory text and analytics snapshot values rather than module-specific live records/actions; commerce categories can show an empty message that says records remain in existing panels. | `SuperAdminModuleRegistry.jsx` around lines `115–116`; capability/no-op scan evidence. | Confirmed capability-projection gap | For each visible module, define a live query, loading/error/empty state, and role-scoped actions, or hide only modules that are not yet implemented while preserving the design system. Do not claim a module is operational merely because a category is visible. |
| F-13 | P1 | **Super Admin event and verification lists are capped locally.** Event and application render paths use `slice(0,50)` and users use `slice(0,100)`, independent of total-result metadata. | `SuperAdminModuleRegistry.jsx` current render logic, lines around `113–114`; evidence `26`. | Confirmed | Replace local caps with server pagination or explicit “load more” using total/has-more metadata. Apply the same contract to applications and events. |
| F-14 | P2 | **Large production bundle.** The minified JavaScript bundle is approximately 1.57 MB and triggers Vite’s >500 kB warning. | Fresh build evidence `6–10`, `60–61`. | Confirmed | Split route/workspace modules and lazy-load admin, media, analytics, and payment surfaces. Track compressed transfer size, not only raw chunk size. |
| F-15 | P2 | **No full physical-device production proof.** Local tests do not establish QR scan reliability, camera continuity, mobile OAuth callback behavior, or physical audio behavior. | Existing checkpoint/user-only gates and audit scope. | Confirmed validation gap | Perform authenticated production smoke tests on a real device for QR, camera, OAuth, audio, payment callback, and navigation persistence. Record database and UI state at each step. |

## Falsified or downgraded findings

| Earlier concern | Fresh result |
|---|---|
| Songs and venues have unconditional public `USING (true)` reads. | **Falsified for the current live database.** Public predicates require `songs.status = 'PUBLISHED'` and `venues.status = 'ACTIVE'`; owner/admin access is separate. |
| All payment reference fields lack uniqueness. | **Falsified.** Live unique indexes exist for transaction and provider references in the inspected payment tables, with scoped idempotency indexes. |
| Anonymous discovery, onboarding configuration, and aggregate engagement RPCs are automatically defects. | **Not automatically defects.** They appear to be intentional public allowlist routines, subject to continued body-level boundary review. |

## Validation status

| Check | Result |
|---|---|
| Vitest | 61 files passed; 225 tests passed; 3 skipped |
| TypeScript | Passed |
| Production build | Passed; approximately 1.57 MB minified chunk warning |
| Lint | Not runnable: no project lint script and ESLint unavailable |
| Live Supabase metadata | Completed for high-risk tables, RPCs, policies, grants, indexes, and advisors |
| Vercel runtime evidence | Completed; five grouped production failure clusters reported |
| Source/deployment parity | **Failed**: working tree differs materially from deployed commit |

## Recommended remediation order

First restore release integrity and revoke the anonymous governance RPC grant, because subsequent production conclusions are unreliable while the deployment does not contain the audited changes. Next consolidate provider-reference mutation and replay state handling, then fix global governance metrics and all local list caps. After that, install lint/CI enforcement, replace browser-only callback recovery with server-authoritative recovery, and perform the authenticated physical-device smoke matrix. The existing UI design should remain unchanged throughout; the required work is in authoritative data contracts, lifecycle guards, and capability projection.

## Audit conclusion

This is **not a clean bill of health**. The local code is substantially covered by tests and compiles, and several historical security diagnoses are stale, but there are confirmed production and release-integrity risks. The highest-confidence blockers are F-01 through F-04, with F-05 through F-13 requiring remediation or explicit architectural hardening before declaring the platform workflow-complete.
