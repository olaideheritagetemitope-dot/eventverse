# Backend-to-UI Alignment Audit — 2026-08-20

## Finding
The Supabase backend contains broad production contracts across catalog, RBAC, effective-role inheritance, artist and organizer onboarding, venue management, event staff operations, private tickets, media and posts, payments, wallets, ticket issuance/check-in, governance, analytics, comments, ratings, likes, support, and policy configuration. The frontend already exposes many of these through `src/EventVerse.jsx`, `src/services/user.js`, `src/components/SuperAdminModuleRegistry.jsx`, `src/components/AdvancedGovernancePanels.jsx`, and `src/components/CheckInScreen.jsx`.

## Backend contract inventory
The live migration set is `0001` through `0045`, including role governance, payment initialization and verification, artist/organizer/venue workflows, event staff responsibilities, private ticket access, media security, posts, dynamic policies, Super Admin governance, clean-slate cleanup, and ticket-fee governance.

## Existing frontend reachability
Declared and rendered UI workspaces include Admin, Super Admin Governance, Artist onboarding/workspace, Organizer onboarding/events, Venue Manager onboarding/workspace, Event Staff workspace, Post Workspace, Check-in, Profile Collections, Role Center, Role Resource, Dynamic Policy, System Health, and Advanced Governance panels. Existing services include catalog loading/search, role governance snapshots, admin snapshots, onboarding, payment support, event staff, venue, media, posts, engagement, notifications, and profile collections.

## High-risk alignment areas for the next pass
The next audit must verify that every authoritative commerce RPC is reachable from the visible ticket/payment flow, especially reservation, order-payment initialization, payment failure, provider reference attachment, payment verification and ticket issuance, QR issuance, and wallet credit. It must also verify that onboarding application review and fee-transaction activation are reachable from the verification queues, that private-ticket discovery and redemption are visible in the ticket flow, and that support, analytics, comments, ratings, likes, media, and posts expose mutation feedback and permission states.

## Preservation rule
The Atizzy cards, boards, pills, sections, navigation, detail layouts, role dashboards, loading states, and empty states must remain. The alignment pass should reuse the existing Supabase wrappers and protected RPCs rather than duplicating backend logic or creating client-authoritative mutations.
