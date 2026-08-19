# EventVerse Frontend Specification

## 1. Purpose and implementation contract

EventVerse is a dark, premium event discovery, ticketing, artist-booking, and music platform. The supplied `src/EventVerse.jsx` is the visual and interaction contract. The production implementation must preserve its charcoal, wood, green music, gold, ivory, Fraunces, and Inter design language while replacing mock data and simulated success paths with persistent, server-authoritative workflows.

The current prototype uses an in-memory navigation stack and hard-coded `EVENTS`, `ARTISTS`, `SONGS`, and `CATEGORIES` records. This document identifies the current behavior and the target production behavior. No client-calculated price, inventory, payment state, role, booking state, or ticket ownership is authoritative.

## 2. Screen inventory and navigation map

| Screen | Current prototype behavior | Required production behavior | Primary data |
|---|---|---|---|
| Onboarding | Four local slides; final action routes to Login | Persist completion preference locally; route anonymous users to Login; allow returning users to bypass onboarding | Onboarding preference |
| Login | Email/password fields are uncontrolled; Login locally replaces route; social buttons have no action | Authenticate through server auth; load session, profile, roles, and verification state; handle invalid credentials, unverified accounts, OAuth start/callback, and loading states | Credentials, session, roles |
| Signup | Form routes to Verify without account creation | Validate, check uniqueness, create account/profile, assign ATTENDEE, create expiring verification challenge, and send verification | User profile, credential, verification challenge |
| Verify | Local code state and navigation | Verify a hashed, expiring OTP with retry limits and resend cooldown; mark contact verified; audit event | Verification challenge |
| Home | Uses hard-coded featured events, categories, artists, music, and location | Load personalized and public discovery data with loading, empty, and error states | Events, categories, artists, songs, location |
| Explore | Category/event lists use local arrays | Query published events with category, city, date, price, artist, venue, availability, sort, pagination, and authorization-aware fields | Events, venues, ticket availability |
| Search | Local search UI with mock results | Debounced server search across events, artists, songs, albums, and venues with pagination and categorized results | Search index/query results |
| Event Detail | Displays selected mock event and local favorite state | Load published event detail; persist favorite; generate share/deep link; request a server reservation when purchasing | Event, venue, artists, schedules, ticket types |
| Ticket Selection | Quantity changes are local; price is trusted from client data | Fetch ticket types and server availability; atomically reserve inventory; enforce per-customer limits and reservation expiry | Ticket types, inventory, reservations |
| Checkout | Subtotal, service fee, discount, and total are locally calculated | Create/retrieve reservation-backed order; calculate all monetary fields server-side; validate customer and reservation ownership | Cart, reservation, order, order items, discounts |
| Payment | Pay action locally routes to processing | Initialize payment with provider; create idempotency key; return provider checkout; never mark paid from client return alone | Payments, attempts, transactions |
| Processing | `setTimeout` simulates payment confirmation | Show provider/server status; poll or receive verified result; handle failure, expiry, retry, and cancellation | Payment attempt, webhook status |
| Payment Success | Local route to digital ticket | Display only after verified payment; issue tickets server-side; create notification and audit record | Paid order, issued tickets |
| Digital Ticket | Displays locally fabricated ticket/QR content | Load owned ticket; render server-issued QR token and ticket state; hide sensitive data from unauthorized users | Ticket, event, ticket type, QR token |
| My Tickets | Maps mock events into local tickets | Query authenticated user's tickets with upcoming/past/cancelled filters; support ticket detail and entry state | Tickets, orders, events |
| Profile | Static profile/menu buttons | Load/update profile; show role-aware links; persist settings; support logout and account/security actions | User, profile, roles, preferences |
| Artist Profile | Uses mock artist, songs, events, and local tabs | Load verified artist profile, followers, songs, albums, events, and about data; persist follow; share profile; start booking | Artist profile, follows, songs, albums, events |
| Artist Booking | Form uses local state and `nav.pop()` on submit | Validate and persist booking request; notify artist; enforce requester/artist permissions; expose status history and negotiation | Booking request, messages, status history |
| Music Home | Plays mock songs locally and shows mock artists | Query catalog; create playback session/history; persist favorites and playlist relationships; support loading/error/empty states | Songs, albums, artists, play history, favorites, playlists |
| Full Music Player | Local play/pause state; controls are partly decorative | Support play, pause, seek, next, previous, shuffle, repeat, queue, playlist, favorite, and playback telemetry | Playback session, queue, library |
| Organizer Dashboard | Not present in current router | Add role-protected dashboard for event lifecycle, ticket sales, settlements, and team permissions | Organizer, events, tickets, orders, settlements |
| Event Management | Not present | Add draft creation, venue, artists, ticket types, pricing, media, preview, review submission, and state history | Event aggregate and audit history |
| Admin Dashboard | Not present | Add role-protected users, organizers, artists, venues, events, tickets, orders, payments, refunds, reports, disputes, moderation, audit, settings | Platform domains and audit logs |
| Venue Manager | Not present | Add venue profile, spaces, capacities, availability, media, and event access management | Venue aggregate |
| Event Staff / Check-in | Not present | Add staff-scoped scanner flow with server QR validation and duplicate-entry denial | Staff assignment, ticket scan, check-in |

### Navigation rules

Anonymous users may browse public discovery and onboarding but must authenticate for favorites, reservations, checkout, tickets, bookings, playlists, and profile actions. Authenticated users route according to their verified session and roles. The client may request navigation, but the server determines identity, permission, ownership, inventory, order state, payment state, and ticket state.

## 3. Button and action inventory

| Screen | Action | Current behavior | Required backend operation | Success | Failure |
|---|---|---|---|---|---|
| Onboarding | Get Started / Next | Changes local slide or routes to Login | Persist onboarding completion preference; no backend required | Continue or Login | Preserve slide and show recoverable error if persistence fails |
| Onboarding | Login | Pushes Login | Open auth screen | Login screen | Remain on onboarding |
| Login | Login | Replaces route with Home | Authenticate credentials; create session; load roles and verification | Home or Verify | Inline generic authentication error; rate-limit audit |
| Login | Forgot Password | No operation | Create recovery challenge without revealing account existence | Recovery flow | Generic response and cooldown |
| Login | Google / Apple / Facebook | Decorative | Start OAuth provider flow and handle verified callback | Authenticated route | OAuth error and retry |
| Login | Sign up | Pushes Signup | Open account creation | Signup screen | Remain on Login |
| Signup | Sign Up | Routes to Verify | Validate, create user/profile, assign ATTENDEE, issue challenge | Verify screen | Field errors; duplicate-safe response |
| Signup | Back | Pops stack | No backend operation | Previous screen | Remain |
| Verify | Verify & Continue | Local code check/navigation | Verify hashed OTP with expiry/retry rules | Authenticated Home | Invalid/expired/locked error |
| Verify | Resend | Local UI if present | Rotate challenge, enforce cooldown, send notification | New challenge | Cooldown/provider error |
| Home | Event card | Pushes Event Detail | Fetch event detail by ID | Event detail | Not-found/unpublished state |
| Home | Category | Local filter | Query published events by category | Explore results | Error/empty state |
| Home | Artist | Pushes Artist Profile | Fetch artist profile | Artist profile | Not-found state |
| Home | Music item / Play | Local playback | Start playback session and record history | Playback feedback | Media unavailable state |
| Explore | Filter/sort | Local state | Server query with validated filters and pagination | Results | Empty/error state |
| Search | Search / category | Local query | Debounced multi-domain search | Categorized results | Empty/error state |
| Event Detail | Favorite | Local visual state | Upsert/delete event favorite for current user | Updated state | Auth prompt or mutation error |
| Event Detail | Share | UI only | Create safe share/deep-link payload | Native/web share | Copy-link fallback/error |
| Event Detail | Get Tickets | Navigates | Validate event sales state and create reservation session | Ticket selection | Sold-out/sales-window error |
| Ticket Selection | Plus / Minus | Local quantities | Server reservation mutation with atomic inventory lock | Updated availability/quantity | Availability/limit error |
| Ticket Selection | Continue | Navigates | Persist reservation and create order draft | Checkout | Reservation expiry/ownership error |
| Checkout | Continue | Navigates | Recalculate order server-side and move to pending payment | Payment | Validation/expiry error |
| Payment | Pay | UI routes to Processing | Initialize provider payment with idempotency key | Provider checkout/Processing | Initialization error |
| Processing | Poll/return | `setTimeout` simulation | Read verified payment status; issue tickets only after webhook verification | Success | Failed/expired/cancelled state |
| Success | View Tickets | Routes | Load paid order tickets | Digital Ticket/My Tickets | Ticket issuance pending/error |
| Success | Back Home | Resets route | No purchase mutation | Home | Remain |
| Digital Ticket | Back | Pops | No backend operation | Previous | Remain |
| My Tickets | Tabs / ticket | Local filter/navigation | Query authenticated tickets by state | Ticket list/detail | Empty/error state |
| Profile | Menu item | Mostly inert | Route to implemented profile/security/role features | Destination | Feature-specific error |
| Profile | Logout | If present, local | Revoke session and clear client cache | Login | Error with safe local cleanup |
| Artist Profile | Follow | UI only | Upsert/delete artist follower relationship | Updated follower count | Auth/error state |
| Artist Profile | Share | UI only | Create artist deep link/share payload | Share/copy | Fallback/error |
| Artist Profile | Book Artist | Pushes Booking | Load booking form and artist availability | Booking form | Artist unavailable state |
| Booking | Send request | `nav.pop()` | Validate and create booking request; notify artist; audit | Request status screen | Field/auth/availability error |
| Music Home | Play | Local player | Start session and record history | Player state | Media/error state |
| Music Home | Favorite/Add Playlist | UI/local | Persist music relationship | Updated library | Auth/duplicate/error state |
| Full Player | Play/pause/seek/next/previous | Local or decorative | Control media session; record playback state/history | Updated player | Media unavailable/error |
| Organizer | Create/save/submit | New | Persist event aggregate and enforce organizer permissions/state transitions | Draft/review status | Validation/permission/state error |
| Staff | Scan QR | New | Verify token, event, ticket state, duplicate use; atomically check in | Check-in success | Denied with reason |
| Admin | Moderation/refund/role actions | New | Protected permission-scoped mutations with audit logs | Updated state | Permission/conflict/error |

## 4. Input inventory and validation

| Input | Required | Client validation | Server validation and sanitization |
|---|---:|---|---|
| Email | Conditional | Valid email syntax, length limit | Normalize lowercase, uniqueness/recovery-safe response |
| Phone | Conditional | E.164-friendly format | Normalize, uniqueness, verified challenge |
| Password | Yes for password auth | Minimum 10 characters, strength feedback | Hash through auth provider; reject breached/weak values where available |
| Confirmation password | Yes on Signup | Must match password | Recheck server-side |
| Verification code | Yes | Numeric fixed-length input | Hash comparison, expiry, retry limit, invalidation |
| Full name | Yes | Length and allowed characters | Trim/sanitize; profile ownership |
| Search query | No | Debounce, max length | Normalize, escape query, paginate, rate limit |
| Ticket quantity | Yes | Integer range and per-type max | Atomic inventory validation and reservation ownership |
| Event name | Yes for organizers | Length and whitespace validation | Sanitize, organizer ownership, uniqueness policy |
| Event type/category | Yes | Allowed option | Validate against categories |
| Booking date | Yes | Valid future date | Availability and timezone validation |
| Audience size | Yes | Positive bounded integer | Range and business-rule validation |
| Budget | Yes | Non-negative currency amount | Decimal precision, currency, requester authorization |
| Booking message | Yes | Length limit | Sanitize and audit |
| Payment information | Provider-controlled | Never store raw card data | Provider token/checkout only; webhook signature verification |
| Event location/venue | Yes for event creation | Valid selection/form | Venue ownership/availability and capacity validation |
| Ticket pricing | Yes for organizers | Non-negative decimal | Server currency/precision and permission checks |
| Media upload | Optional/required by workflow | Type/size validation | MIME/content validation, ownership, storage policy |

## 5. Role and permission matrix

Roles are assigned server-side and permissions are explicit rather than scattered role checks.

| Role | Scope | Representative permissions |
|---|---|---|
| ATTENDEE | Own account and public marketplace | events.view, orders.create, tickets.view_own, favorites.manage_own, bookings.create, music.manage_own |
| ARTIST | Own artist profile and bookings | artists.update_own, bookings.review_assigned, music.manage_own, events.view |
| ORGANIZER | Owned organization/events | events.create/update/submit/publish, tickets.manage, orders.view_owned, reports.view_owned |
| VENUE_MANAGER | Assigned venues/spaces | venues.manage_owned, availability.manage, events.view_assigned |
| EVENT_STAFF | Assigned live events | tickets.scan_assigned, checkins.create_assigned |
| ADMIN | Platform moderation and operations | users.manage, events.moderate, refunds.manage, reports.view, audit.view |
| SUPER_ADMIN | Full platform administration | All permissions plus roles.manage and system.settings |

Every mutation must check permission, resource scope, state transition, and audit requirements server-side.

## 6. Persistent domain model

The shared domain vocabulary is organized around users, identity, events, ticketing, orders, payments, artists, music, bookings, social features, and platform operations.

Core tables include `users`, `user_profiles`, `roles`, `permissions`, `user_roles`, `sessions`, `verification_tokens`, `password_reset_tokens`; `artists`, `artist_profiles`, `artist_verifications`, `artist_followers`, `artist_social_links`, `artist_availability`; `organizers`, `organizer_profiles`, `organizer_verifications`, `organizer_members`; `venues`, `venue_profiles`, `venue_spaces`, `venue_capacity`, `venue_availability`, `venue_media`; `events`, `event_categories`, `categories`, `event_artists`, `event_media`, `event_schedules`, `event_status_history`; `ticket_types`, `ticket_inventory`, `ticket_reservations`, `tickets`, `ticket_scans`, `check_ins`; `carts`, `cart_items`, `orders`, `order_items`, `discounts`, `order_discounts`, `refunds`; `payments`, `payment_attempts`, `transactions`, `payment_webhooks`, `settlements`, `payouts`; `songs`, `albums`, `audio_assets`, `playlists`, `playlist_items`, `user_music_library`, `favorites`, `play_history`; `artist_booking_requests`, `booking_messages`, `booking_status_history`, `booking_contracts`; `event_favorites`, `reviews`, `ratings`, `notifications`; `reports`, `disputes`, `audit_logs`, `system_settings`.

Money and inventory mutations require database transactions, idempotency keys, row locking or atomic conditional updates, and immutable audit records. Temporary reservations have `ACTIVE`, `EXPIRED`, and `CANCELLED` states with server timestamps.

## 7. API/service contract

The application should expose typed server procedures grouped by domain, with all protected procedures deriving identity from the session.

| Domain | Procedures |
|---|---|
| Auth | `auth.me`, `auth.signup`, `auth.login`, `auth.logout`, `auth.verify`, `auth.resendVerification`, `auth.requestPasswordReset`, `auth.resetPassword`, `auth.startOAuth` |
| Discovery | `events.featured`, `events.list`, `events.detail`, `events.favorite`, `events.shareLink`, `search.global`, `categories.list`, `artists.list` |
| Ticketing | `tickets.types`, `tickets.reserve`, `tickets.releaseReservation`, `tickets.myTickets`, `tickets.detail`, `tickets.scan` |
| Orders | `orders.createFromReservation`, `orders.detail`, `orders.recalculate`, `orders.cancel`, `orders.refundRequest` |
| Payments | `payments.initialize`, `payments.status`, `payments.webhook`, `payments.retry` |
| Artists | `artists.detail`, `artists.follow`, `artists.availability`, `artists.booking.create`, `artists.booking.list`, `artists.booking.update` |
| Music | `music.home`, `music.search`, `music.playback.start`, `music.playback.history`, `music.favorite`, `music.playlists`, `music.playlists.add` |
| Organizer | `organizer.dashboard`, `organizer.events.create`, `organizer.events.update`, `organizer.events.submit`, `organizer.ticketTypes.update`, `organizer.sales` |
| Admin | `admin.dashboard`, `admin.users`, `admin.events.review`, `admin.payments`, `admin.refunds`, `admin.reports`, `admin.auditLogs`, `admin.roles` |

Every procedure returns typed success/error data, validates inputs with schemas, checks authorization, persists state, and emits notifications/audit records where required.

## 8. Event, order, payment, ticket, and booking state machines

### Events

`DRAFT → PENDING_REVIEW → CHANGES_REQUESTED → PENDING_REVIEW → APPROVED → PUBLISHED → SOLD_OUT → LIVE → COMPLETED`; cancellation and rejection are permissioned terminal or alternate paths.

### Orders

`CART → RESERVED → PENDING_PAYMENT → PAID → FULFILLED`; alternate states are `PAYMENT_FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`, and `PARTIALLY_REFUNDED`.

### Payments

`INITIALIZED → PROVIDER_PENDING → VERIFIED_SUCCESS` or `FAILED`/`EXPIRED`; only a verified provider webhook may move an order to `PAID` and issue tickets.

### Tickets

`ISSUED → ACTIVE → CHECKED_IN`; alternate states are `CANCELLED`, `REFUNDED`, and `EXPIRED`. QR check-in validates token, assigned event, current ticket state, and duplicate use in one protected transaction.

### Bookings

`DRAFT → SUBMITTED → REVIEWING → NEGOTIATING → ACCEPTED → CONFIRMED → COMPLETED`, with `REJECTED` and `CANCELLED` transitions governed by actor and current state.

## 9. Responsive reconstruction requirements

The current fixed 390×780 phone treatment has already been removed from the root viewport. The implementation must continue with genuine layouts rather than stretching the mobile composition.

| Breakpoint | Required layout behavior |
|---|---|
| 320–767px | Bottom navigation, horizontal carousels, sticky purchase CTA where appropriate, touch targets, safe-area padding, vertical scroll, no overflow |
| 768–1199px | Expanded spacing, larger cards, adaptive two-column sections, tablet navigation, wider ticket and checkout surfaces |
| 1200px+ | Desktop top/side navigation, event grids, multi-column event details, desktop checkout, organizer/admin dashboards, analytics and data tables |

## 10. Testing and definition of done

For each implemented workflow, test success, validation failure, unauthorized access, expired state, duplicate/idempotency behavior, loading, empty, server error, responsive layout, and audit/notification side effects. Automated tests must cover server procedures and business rules. Browser verification must cover onboarding, login/signup/verify, discovery/search, event-to-ticket flow, payment status handling, digital ticket access, artist booking, music actions, and role-restricted management screens.

A phase is complete only when frontend, backend, database, validation, authorization, error handling, loading states, persistence, auditability, automated tests, responsive behavior, and security work together. The final product must be one coherent EventVerse platform rather than disconnected demos.

## 11. Sequenced implementation plan

1. Complete the forensic specification and shared domain vocabulary.
2. Establish server-backed authentication and role/permission foundations.
3. Create database schema, migrations, seed data, and typed query helpers.
4. Connect Home, Explore, Search, Artist Profile, and Music Home to real data.
5. Implement organizer event lifecycle and role-protected management screens.
6. Implement atomic ticket inventory, reservations, orders, and server-calculated checkout.
7. Implement payment initialization, webhook verification, ticket issuance, and check-in.
8. Implement artist following, booking workflow, music persistence, playlists, and playback history.
9. Add admin, venue manager, organizer, and event staff interfaces.
10. Harden security, auditing, error states, tests, responsive behavior, and production deployment.
