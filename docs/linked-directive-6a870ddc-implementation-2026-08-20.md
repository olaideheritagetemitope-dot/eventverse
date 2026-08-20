# Linked Directive 6a870ddc — Implementation Evidence

## Scope

The supplied role-control-surface directive was extracted from the authenticated ChatGPT conversation and preserved in `docs/linked-directive-6a870ddc-role-control-surface.txt`. The directive spans Super Admin control-center navigation, role preview, user and authority operations, artist/organizer/venue/staff workflows, payment and moderation surfaces, scanner and device fallback behavior, notifications, loading/error states, security boundaries, and acceptance validation.

## Implemented in this pass

Atizzy now includes a protected `AdminControlCenter` reachable from RoleCenter for Super Admin users. It groups real existing workflows into System, Users & Authority, Artists & Music, Organizers & Events, Venues & Tickets, and User Experience sections. Each item routes to an existing live workflow rather than a placeholder screen. The control center includes a role-preview selector. Preview mode is visibly labeled and explicitly preserves the authenticated Super Admin identity and backend authorization.

RoleCenter now accepts preview context and shows a non-authorizing preview banner. The protected route map exposes the new control-center screen, and Super Admin RoleCenter navigation opens it directly while ordinary Admin users continue to use the delegated Admin Operations screen.

The ticket check-in screen now uses `@zxing/browser` (`BrowserMultiFormatReader`) as a browser-compatible QR decoding path. It still requires HTTPS and `getUserMedia`, requests the rear-facing camera, handles denied/blocked/unsupported camera states, shows an explicit camera permission explanation, keeps manual ticket-token entry available at all times, stops media tracks and decoder controls on stop/unmount, and submits all entry decisions through the existing server-authoritative RPCs.

## Validation

Focused private-ticket and role-capability tests passed: 8 tests. The complete Atizzy regression suite passed: 28 test files and 100 tests. TypeScript validation passed. The Vite production build passed after adding `@zxing/browser`; the only output is the existing large-chunk advisory.

## Files changed

- `src/EventVerse.jsx`
- `src/components/CheckInScreen.jsx`
- `tests/check-in-camera.acceptance.test.js`
- `tests/event-operations-responsibilities.acceptance.test.js`
- `package.json`
- `pnpm-lock.yaml`
- `docs/admin-workspace-current.txt`

## Security note

The new UI is only a navigation and preview surface. It does not grant access, mutate roles, or bypass authorization. Existing Supabase RLS, security-definer RPCs, effective-role inheritance, assignment scope, and delegated Admin permission checks remain the source of truth.
