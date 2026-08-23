# Attached directives — execution checklist

| Directive area | Required execution | Current evidence/status | Implementation gate |
|---|---|---|---|
| Release integrity | Reconcile working tree, GitHub `main`, live migrations, Vercel deployment, then commit/push/deploy intended source | Prior audit confirmed drift: deployed `8e53d50`; local remediation later and partly uncommitted/untracked | Must establish exact source/deployment state before claiming any fix |
| Artist directory | Repair database → RLS → RPC/API → service → state → component path; cold load and refresh | Prior audit says live artist fallback/search fixes exist locally; production runtime still reported Artist failures | Must verify deployed UI and live query path |
| Artist search | Exact and partial name search through the existing live search system | Prior audit recorded selected-tab/live search fix locally | Must run deployed search smoke test |
| Venue deletion | Trace owner/admin mutation and preserve history through safe deletion semantics | Prior audit fixed stale role join and non-blocking media cleanup locally | Must verify active listing removal in deployed UI |
| Location and nearby events | Test granted, denied, unavailable, and successful coordinate states | Prior audit made location non-destructive and removed event-city fallback | Must run browser/device flow and confirm Home remains populated |
| Home blank-state regression | Ensure independent failures cannot overwrite shared catalog state | Prior audit fixed settled-promise indexing and raw-row normalization | Must verify deployed Home under partial RPC/location failure |
| Forensic F-01–F-13 | Apply applicable confirmed findings, not stale/falsified diagnoses | F-01 release drift, F-02 anonymous admin RPC grant, F-04 page-local metrics, F-05–F-13 payment/capability/lint/callback risks remain in inventory | Must fix confirmed applicable defects and verify live contracts |
| Payment integrity | Centralize provider-reference authority, tighten replay/idempotency, enforce webhook cardinality, remove client-only recovery reliance | Live runtime still has duplicate-reference/provider-attachment clusters; local code has inconsistent direct PATCH paths | Must trace and implement without weakening exactly-once ticket issuance |
| Super Admin projection | Make visible modules, counts, pages, and actions reflect authoritative live data | Pagination was added; metrics and some caps remain page-local per audit | Must correct counts/caps and preserve current registry UI |
| Validation | Database/RLS/RPC, tests, TypeScript, build, lint, production role/user-flow smoke matrix | Tests/TS/build pass; lint unavailable; production smoke not yet established | Must install/configure lint if needed and record actual deployed checks |
| Final proof | Local code → committed → migrated → deployed → production verified | Not yet satisfied | No success declaration until each link is evidenced |

## Already established facts not to regress

The current live RLS policies for songs and venues are status-scoped; this earlier diagnosis was falsified and should not be reopened as a UI-only patch. Payment-reference unique indexes exist table-by-table. Discovery, onboarding configuration, and aggregate engagement anonymous routines appear to be intentional public allowlist functions, while the anonymous governance-directory grant is not intentional and remains a security finding.
