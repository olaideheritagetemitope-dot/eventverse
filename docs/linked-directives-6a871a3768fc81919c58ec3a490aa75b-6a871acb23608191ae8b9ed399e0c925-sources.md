# Atizzy Linked Directive Sources

## Source 1
URL: https://chatgpt.com/s/t_6a871a3768fc81919c58ec3a490aa75b

Extracted themes: complete Super Admin user directory; role-specific lists for attendees, artists, organizers, venue managers, event staff, admins, and Super Admins; configurable onboarding questions; role-specific verification fees; questions-before-payment; organizer 24-hour review policy; organizer event history; event lifecycle states; public/private ticket inventory; platform percentage/fixed ticket fees; immutable refund and wallet-credit accounting; user wallets; cross-domain analytics for music, music videos, albums, artists, events, venues, organizers; configurable rankings; public Top/Trending surfaces; event comments and ratings; music comments; comment moderation; event moderation; artist moderation; organizer moderation; compact Super Admin control-center groups.

## Source 2
URL: https://chatgpt.com/s/t_6a871acb23608191ae8b9ed399e0c925

Extracted directive title: ATIZZY — SUPER ADMIN GOVERNANCE, ROLE MANAGEMENT, ONBOARDING, VERIFICATION, ANALYTICS, TICKETS, WALLET, MODERATION & PLATFORM POLICY — COMPLETE IMPLEMENTATION DIRECTIVE.

Critical constraints: do not create UI mockups, placeholders, fake statistics, hardcoded records, or duplicate existing infrastructure; preserve existing UI structure; connect database -> backend services -> authorization -> frontend -> mutation -> live result -> audit log -> notification where appropriate; Super Admin authority must be backend-enforced; all users and role lists must be live with search/filter/sort/pagination/status/verification/date filters and refresh; Organizer must be a complete distinct role; role application must support Artist, Organizer, Venue Manager; configurable database-backed onboarding questions; database-backed role-specific verification fees; server-side payment verification; configurable Organizer review window (default 24 hours) without implicit auto-approval; unverified organizers may create/edit/preview drafts but cannot publish; organizer history; event lifecycle including draft, pending review, upcoming, active, past, suspended, cancelled, archived; Super Admin event actions with refund workflow; public/private ticket types; ticket inventory/accounting; dynamic platform fees; integer minor-unit money; immutable cancellation/refund/wallet ledger; wallet credits/debits/purchases/history; and a final report covering existing/missing/implemented items, database/backend/frontend changes, tables/functions/RLS/routes/screens/workflows/analytics/financial/moderation/tests/security/build/deployment/commit evidence.

The second directive continues in /home/ubuntu/eventverse/docs/linked-directive-6a871acb-role-governance.md; the first directive is preserved in /home/ubuntu/page_texts/chatgpt.com_s_t_6a871a3768fc81919c58ec3a490aa75b.md.
