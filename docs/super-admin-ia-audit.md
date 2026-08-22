# Atizzy Super Admin Information Architecture Audit

## Scope

This audit records the existing Super Admin surface before navigation restructuring. The implementation must preserve the existing Atizzy shell, live Supabase data contracts, server-authoritative mutations, role capability projection, and all current routes. The new navigation is an information-architecture layer over the existing screens rather than a replacement dashboard.

## Existing operational entry points

| Existing route key | Existing surface | Target category | Preservation contract |
|---|---|---|---|
| `roleCenter` | Universal role workspace and Super Admin platform analytics | Overview / System Control | Preserve effective-role workspace access and live analytics loading. |
| `adminControlCenter` | Super Admin governance dashboard | Overview | Preserve live governance snapshot, event controls, role directories, verification queue, policy editing, and advanced panels. |
| `adminWorkspace` | Admin operations, system health, user search, payment support, audit/moderation links | People / Tickets & Payments / Moderation / System Control | Preserve Admin capability checks and Super Admin policy access. |
| `roleCapabilities` | Live role capability matrix and delegated Admin permission grants | System Control | Preserve `loadRoleCapabilityMatrix`, `loadAdminPermissionGrants`, and `setAdminPermission`. |
| `governanceDashboard` | Legacy governance event and verification control surface | Verification / Events | Keep reachable as a compatibility route while grouped navigation points to the same controls. |
| `artistWorkspace` | Artist content management | Content | Keep existing artist-owned CRUD and publishing UI intact. |
| `organizerEvents` | Organizer event operations | Events | Keep existing organizer workflow intact. |
| `venueManager` | Venue management | Content / Events | Keep existing venue workflow intact. |
| `eventStaff` and `eventStaffTasks` | Assigned event operations and check-in responsibilities | Events / System Control | Keep assignment-scoped capabilities intact. |

## Existing live service contracts

The current admin service layer already provides live Supabase-backed contracts for dashboard snapshots, user directories, suspension, event review, report updates, payment support, audit logs, policy settings, role capability matrices, Admin delegation, role-governance snapshots, onboarding configuration, role applications, application review, wallet credits, content analytics, engagement actions, fee policies, event status, and governance event snapshots. The restructure must call these existing services rather than introduce mock datasets or parallel authority logic.

## Existing Super Admin registry modules

The current registry exposes Overview, All Users, Artists, Organizers, Venue Managers, Event Staff, Admins, Super Admins, Attendees, Other Roles, Applications, Verification, Events, Tickets, Payments, Wallets & Refunds, Niche Analytics, Moderation, Support, Audit Logs, Policies & Fees, and System Health. These modules map into the requested categories as follows.

| Existing module group | Target category |
|---|---|
| Overview | Overview |
| All Users, role directories | People |
| Applications, Verification | Verification |
| Existing content/admin workspace links | Content |
| Events | Events |
| Tickets, Payments, Wallets & Refunds | Tickets & Payments |
| Moderation | Moderation |
| Niche Analytics | Analytics |
| Support | Communications |
| Audit Logs, System Health, role capabilities, Admin delegation | System Control |
| Policies & Fees | Settings |

## Required implementation guardrails

The target navigation must provide compact grouped dropdowns, active section/page/nested-page states, breadcrumbs, global live search, detail-page entry points, contextual action menus, and responsive mobile/desktop behavior. Dangerous operations must remain available but use confirmation dialogs. Pending verification review should remain a visible primary action. Existing routes must continue to work as compatibility destinations, while the target `/admin/...` information architecture should resolve to the existing live screens or newly added wrappers without changing backend RLS or RPC authorization.

No counts, users, events, payments, tickets, analytics, or content may be fabricated. Empty, loading, unavailable, and error states must remain explicit within the existing Atizzy visual language.
