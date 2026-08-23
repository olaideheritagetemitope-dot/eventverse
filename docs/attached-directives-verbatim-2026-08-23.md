# Attached Directive 1 — Verbatim

_Source: `/home/ubuntu/upload/pasted_content.txt`_

EVENTVERSE — TURN THE FORENSIC AUDIT INTO ACTUAL FIXES. DO NOT JUST REPORT.

You already performed the forensic audit. I have the report. It identified confirmed production/source drift (F-01), production failures, and multiple architectural issues. The application is STILL broken in production.

STOP AUDITING. NOW EXECUTE THE FIXES.

CRITICAL FIRST:
Production is reported to still be on commit 8e53d50 while later remediation code/migrations exist locally. Establish the actual source-of-truth state FIRST. Inspect git status, commits, migrations and Vercel deployment. Determine exactly which code/database migrations are deployed. Commit the correct remediation changes, push them, apply required migrations safely, and deploy the intended version. Verify the deployed commit afterward.

THEN FIX THE USER-FACING REGRESSIONS:

1. ARTISTS NOT FETCHING
Trace database → RLS → RPC/API → service → hook/state → component.
Fix the actual broken contract.
Artists must appear normally after refresh and cold load.

2. ARTIST SEARCH BROKEN
Trace search input → query → API/RPC → filtering → state → UI.
Exact and partial artist-name searches must return artists.
Do not hardcode data or create a duplicate search system.

3. VENUE DELETION BROKEN
Trace delete UI → mutation → API/RPC → RLS → foreign keys/dependencies → UI refresh.
Find the exact database/API error.
Implement the correct deletion architecture. If venues must be soft-deleted because historical events/tickets depend on them, implement soft deletion consistently instead of destroying historical records.
Authorized venue owners/admins must be able to remove venues from active listings.

4. LOCATION BROKEN
Trace browser/device permission → geolocation → coordinates → state → discovery RPC/API → Events Near You.
Fix the real failure.
Test permission granted, denied, unavailable and successful coordinates.
Location failure MUST NEVER cause Home or the entire discovery UI to become blank.

5. PREVIOUS BLANK-STATE REGRESSION
Inspect the changes that attempted to fix the previous blank Home state.
Look specifically for async race conditions, Promise.all failures, empty-array overwrites, discovery snapshot/RPC changes, location effects and shared catalog state.
A failed artist/location/venue request must not wipe the entire Home state.

6. USE THE FORENSIC FINDINGS
Address confirmed F-01 through F-13 where applicable, especially:
- deployment/source drift
- payment/provider reference state issues
- replay/idempotency problems
- webhook cardinality
- callback recovery
- Super Admin capability projection
- pagination/list caps
- missing lint/CI

Do NOT blindly modify unrelated working systems.

7. AFTER FIXING
Run:
- database/RLS validation
- Supabase RPC validation
- frontend tests
- TypeScript
- build
- lint (install/configure it if required)
- production smoke tests

Then manually verify in the DEPLOYED production application:

✓ Artists visible
✓ Artist search works
✓ Artist profile opens
✓ Venues visible
✓ Authorized venue deletion works
✓ Deleted venue disappears correctly
✓ Location permission works
✓ Events Near You works
✓ Home remains populated when location fails
✓ Events load
✓ Music loads
✓ Premium UI still works
✓ Existing roles still work
✓ No blank states
✓ No new console/API/RPC errors

IMPORTANT:
Do not tell me "the code is fixed" based only on local tests.

The final proof must be:
LOCAL CODE → COMMITTED → MIGRATED → DEPLOYED → PRODUCTION VERIFIED.

If deployment is blocked, identify the exact blocker and fix it. Do not stop at diagnosis.

Finally give me:
1. Exact root cause of each regression.
2. Exact files/functions/RPCs changed.
3. Exact migrations applied.
4. Exact commit deployed.
5. Production verification results.
6. Any remaining errors.
7. Confirmation that the deployed production environment is running the fixed code.

DO NOT DECLARE SUCCESS UNTIL THE ACTUAL DEPLOYED UI HAS BEEN VERIFIED.

# Attached Directive 2 — Verbatim

_Source: `/home/ubuntu/upload/pasted_content_2.txt`_

You have ALREADY completed the forensic study and identified the regressions. The study and attempted remediation happened in the same run, yet the actual UI is STILL broken.

DO NOT START ANOTHER GENERIC AUDIT. USE THE FINDINGS YOU JUST PRODUCED AND EXECUTE THE FIXES NOW.

Fix every confirmed issue that affects the current production UI, especially:

1. ARTISTS
- Artists must actually fetch and render.
- Artist-name search must work.
- Trace and repair the complete database → RLS → RPC/API → service → frontend state → UI chain.
- Do not hardcode or create duplicate systems.

2. VENUES
- Venue deletion must actually work for authorized users.
- Trace the real mutation through frontend → API/RPC → RLS → database constraints.
- If historical event/ticket relationships require soft deletion, implement the correct safe architecture.
- Verify the deleted venue disappears from active listings.

3. LOCATION
- Fix the complete geolocation flow from browser/device permission through coordinates → frontend state → discovery/backend → Events Near You.
- Test permission granted, denied, unavailable and successful location.
- Location failure MUST NOT blank or destroy Home/discovery.

4. PREVIOUS BLANK-STATE REGRESSION
- Inspect the exact changes that caused/fixed the previous blank state.
- Find shared state, async race conditions, discovery RPC failures, empty-array overwrites or location effects that are still breaking unrelated sections.
- One failed data source must never wipe the entire Home UI.

5. APPLY ALL OTHER CONFIRMED FORENSIC FINDINGS THAT ARE CURRENTLY BROKEN.
Do not leave findings as recommendations. Implement the necessary fixes.

CRITICAL:
Do not stop after changing source code.

For every fix:
SOURCE CODE
→ DATABASE/RLS/RPC MIGRATION if required
→ COMMIT
→ DEPLOY
→ VERIFY ACTUAL DEPLOYED VERSION
→ TEST THE LIVE USER FLOW.

If the previous implementation created backend capabilities that the frontend is not consuming correctly, repair the connection rather than creating another parallel implementation.

After fixing, perform a targeted regression test of:
- Attendee
- Premium attendee
- Artist
- Organizer
- Venue Manager
- Event Staff
- Admin
- Super Admin

Verify in the actual deployed UI:

✓ Artists visible
✓ Artist search works
✓ Artist profiles work
✓ Venues load
✓ Venue deletion works
✓ Location works
✓ Events Near You works
✓ Home never goes blank
✓ Events load
✓ Music loads
✓ Premium UI still works
✓ Existing dashboards still work
✓ No new RPC/API/RLS errors

DO NOT tell me that something is fixed merely because the code compiles or local tests pass.

I need actual end-to-end verification of the deployed application.

If something cannot be fixed, do not hide it or mark it complete. Give the exact blocker and continue fixing everything else.

FINAL REPORT MUST STATE:
- exact root cause
- exact fix
- files/functions/RPCs changed
- migrations applied
- commit deployed
- production deployment identifier
- actual production tests performed
- remaining errors, if any.

SUCCESS = the broken functionality actually works in the deployed UI, not merely that the source code was modified.
