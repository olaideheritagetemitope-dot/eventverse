# Linked Directive 6a87796e — Frontend ↔ Backend Functionality Reconciliation

Source: https://chatgpt.com/s/t_6a87796ed2f48191a52b19f4ea44f186

## Core directive

Make the existing Atizzy UI a complete, live, functional frontend for the existing Supabase backend. Preserve the existing UI design and close the entire loop:

> DATABASE → BACKEND → SERVICE → UI → ACTION → DATABASE

Every backend function, permission, service, visible button, and resulting database mutation must be reconciled and reachable through the UI.

## Extracted findings to verify

The linked assessment identifies live backend domains for role governance, permissions, onboarding, private tickets, media, posts, analytics, admin governance, event staff, venue management, payments, wallets, comments, ratings, likes, notifications, search history, playlists, music favorites, artist following, venue booking, and venue availability.

It also identifies authoritative administrative capabilities including `admin_dashboard_snapshot`, `admin_list_users`, `admin_review_event`, `admin_review_role_application`, `admin_set_event_status`, `admin_suspend_user`, `admin_update_report`, `admin_payment_support_snapshot`, `admin_recent_audit_logs`, `admin_role_governance_snapshot`, `admin_governance_event_snapshot`, `set_admin_permission`, `list_admin_permission_grants`, `role_capability_matrix`, `get_super_admin_analytics`, `public_content_analytics`, `set_platform_fee_policy`, `set_role_fee_policy`, `update_policy_setting`, `save_onboarding_question`, and `submit_role_application`.

## Acceptance matrix

| Domain | Required reconciliation |
|---|---|
| Live catalog | Remove fallback/demo takeover when live collections are empty; preserve cards and empty states. |
| Role governance | Map role applications, permission delegation, role governance, policy control, and capability matrix to visible protected UI. |
| Administration | Expose user directories, event review, event status, suspension, reports, payment support, audit logs, and governance snapshots. |
| Fees and onboarding | Expose platform fees, role fees, configurable onboarding questions, application submission, review, and payment states. |
| Commerce | Expose private-ticket discovery, reservation, payment initialization/verification, ticket issuance, wallet credits, and ticket lifecycle. |
| Content and media | Expose media validation, posts, post edit/delete, uploads, playback, playlists, favorites, and persistent library actions. |
| Operations | Expose event-staff assignments/tasks, QR scanning, venue booking, availability, and role-scoped workspaces. |
| Engagement | Expose notifications, search history, follows, likes, comments, ratings, and live analytics. |
| UI integrity | Preserve Atizzy cards, boards, pills, tabs, navigation, detail layouts, responsive structure, and loading/empty/error/success states. |
| Security | Ensure every mutation is server-authoritative, permission-gated, owner-scoped, audited where required, and reflected in UI state. |

## Existing live-data warning

The linked assessment reports that empty Artists, Venues, Songs, and Categories collections must never cause frontend fallback content to appear. The existing Clean Slate work and Popular Venues correction must remain enforced.

## Implementation rule

Do not build a parallel backend or unrelated frontend. Reuse existing Supabase RPCs, service wrappers, Atizzy components, and routes. Add only the missing service-to-UI wiring, actions, and reactive states, with acceptance tests proving each completed loop.
