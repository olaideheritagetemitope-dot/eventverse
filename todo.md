# Project TODO

- [x] Read the canonical EventVerse-1.jsx UI source
- [x] Read the EventVerse UX arrangement directive
- [x] Scaffold a clean responsive EventVerse web project
- [x] Preserve EventVerse-1.jsx as the canonical source reference
- [ ] Implement the supplied EventVerse UI without visual redesign
- [ ] Implement the directive’s module hierarchy and CTA placement rules
- [ ] Validate onboarding, discovery, ticketing, music, profile, and payment flows
- [ ] Validate 390px mobile and desktop responsive layouts
- [ ] Run production build and deployment checks
- [ ] Create a GitHub repository and Vercel deployment handoff

- [ ] Reconnect the EventVerse GitHub repository to the Vercel project
- [ ] Deploy the `main` branch to Vercel production
- [ ] Verify and provide the live Vercel URL

- [ ] Verify access to the reconfigured GitHub, Vercel, and Supabase connections
- [ ] Confirm EventVerse repository and Vercel deployment configuration
- [ ] Retry the live Vercel deployment and inspect Supabase readiness
- [ ] Report connected-service status and live access result

- [x] Remove the simulated phone frame and any visual device chrome
- [x] Convert the root to a full viewport AppViewport using responsive and safe-area CSS
- [x] Preserve all existing screens, routes, navigation, and approved visual tokens
- [x] Validate mobile, tablet, desktop, and production build behavior
- [x] Deploy the viewport correction and verify the live URL

- [ ] Reproduce the regression in local and live EventVerse builds
- [ ] Identify the regression source introduced by the viewport refactor
- [ ] Apply the smallest compatible regression fix
- [ ] Validate responsive layouts and production build after the fix
- [ ] Deploy the regression fix and verify the live result

- [x] Restore missing login page after onboarding transition
- [x] Verify login page navigation and post-login flow
- [x] Redeploy and verify the login regression fix

- [x] Resolve Vercel production deployment block
- [x] Promote the corrected build to the canonical EventVerse URL
- [x] Verify the canonical URL reaches the login page after onboarding

- [x] Create and maintain frontend specification from the attached directive
- [x] Replace mock discovery, artist, and music data with persistent backend data
- [x] Implement server-backed authentication, verification, recovery, and OAuth pathways
- [x] Implement role and permission foundations for all required roles
- [ ] Implement persistent event discovery, search, favorites, sharing, and artist flows
- [ ] Implement organizer event lifecycle and management interfaces
- [x] Implement server-authoritative ticket inventory, reservations, orders, and checkout
- [ ] Implement verified payment lifecycle, ticket issuance, digital tickets, and check-in
- [x] Implement artist booking, music library, playlists, playback history, and player persistence
- [ ] Implement admin, venue manager, and event staff interfaces
- [x] Add validation, loading/error/empty states, auditability, automated tests, and responsive verification

- [ ] Replace localhost email confirmation links with production-safe email code verification
- [ ] Configure production redirect URLs and auth callback handling
- [ ] Enable Google authentication and add its login button
- [ ] Enable Facebook authentication and add its login button
- [ ] Enable Spotify authentication and add its login button
- [ ] Verify email-code and social-login flows in production

- [x] Add branded Google, Facebook, Spotify, and Apple provider icons/buttons to the login UI
- [x] Keep Google active and clearly mark Facebook, Spotify, and Apple unavailable until independent credentials are configured

- [ ] Enable Facebook OAuth with its own provider credentials
- [x] Enable Spotify OAuth with its own provider credentials
- [ ] Replace Spotify and Facebook login icons with current brand-accurate marks
- [ ] Keep Apple provider unavailable
- [ ] Verify Facebook and Spotify login buttons in production

- [x] Replace placeholder Spotify icon with the official Spotify circular icon mark
- [x] Replace placeholder Facebook icon with the current official Facebook logo mark
- [x] Enable Spotify OAuth in Supabase and verify its callback configuration
- [ ] Verify Google, Spotify, and email OTP flows in production
- [x] Run production build and confirm Vercel deployment health

- [x] Trace Spotify/Google OAuth callback handling and session hydration in production
- [x] Ensure new OAuth users can create accounts and persist their profile/session
- [x] Route successful OAuth and email authentication to the correct home/profile destination
- [x] Prevent authenticated users from being sent back to login on repeat visits
- [x] Restore consistent first-launch onboarding before login for new users
- [ ] Validate onboarding, OAuth callback, account creation, and repeat-login flows in production

- [x] Inspect the attached Spotify authentication failure and callback behavior
- [x] Trace Spotify-specific Supabase provider redirect and session exchange behavior
- [x] Fix Spotify authentication so a successful provider return reaches EventVerse Home
- [ ] Validate Spotify authentication on the production deployment

- [x] Verify Supabase Site URL is the canonical EventVerse Vercel URL
- [x] Verify Supabase allowed redirect URL includes the canonical EventVerse wildcard
- [x] Verify Spotify callback URI and client redirectTo alignment
- [x] Confirm the Spotify button uses only signInWithOAuth and session-driven routing
- [ ] Rebuild, redeploy, and re-test Spotify authentication

- [x] Analyze the second Spotify failure recording for the exact return URL and session state
- [x] Trace why the live Spotify callback still restores to Login
- [x] Apply and validate the smallest correct Spotify authentication fix
- [ ] Re-test the corrected Spotify flow on production

- [x] Persist the confirmed Spotify redirect-loop evidence and affected production URL
- [x] Instrument Spotify callback, Supabase session events, and route transitions
- [x] Identify why the authenticated session is not reaching the user profile/home route
- [x] Remove the redirect loop at its root without adding another manual redirect workaround
- [ ] Build, deploy, and verify the final Spotify authentication flow

- [x] Inspect Supabase Auth logs for Spotify callback failures and provider errors
- [x] Verify Spotify Developer Dashboard redirect URI, app mode, and response configuration
- [x] Identify and fix the provider-level cause of the missing Spotify session
- [x] Remove obsolete client-side workarounds if the provider diagnosis makes them unnecessary
- [ ] Deploy and verify Spotify authentication end to end

- [ ] Audit the last known working auth implementation against current deployed code
- [ ] Trace Google and Spotify OAuth from initiation through callback, session, profile, role, and destination
- [ ] Verify shared Supabase client, storage, redirect, environment, and auth-guard behavior
- [ ] Add safe diagnostic status logging without exposing tokens or secrets
- [x] Fix the shared auth initialization/profile/role routing regression
- [ ] Validate Google and Spotify on fresh, existing, mobile, and desktop sessions
- [ ] Validate logout and provider-switch flows
- [x] Deploy a clean production build and confirm session persistence after refresh

- [x] Trace why Google and Spotify buttons return directly to EventVerse without provider authorization
- [x] Verify provider authorization URLs, redirect targets, and Supabase callback configuration
- [x] Restore the provider authorization step while preserving PKCE session restoration
- [x] Build, deploy, and validate Google and Spotify authorization flows

- [x] Rebrand the app display name from EventVerse to Atizzy
- [x] Install the supplied Atizzy artwork as the unchanged square app icon
- [x] Generate correctly sized icon, splash, favicon, and adaptive-icon assets from the supplied artwork
- [x] Update branding metadata without changing the application UI design
- [x] Build and verify the Atizzy branding update

- [x] Audit every app, web, favicon, splash, adaptive-icon, and metadata branding reference
- [x] Install the supplied Atizzy logo in every required branding location
- [x] Remove stale EventVerse icon and logo references where they represent the app identity
- [x] Build and verify complete Atizzy logo coverage without changing UI design
- [x] Deploy the complete Atizzy logo update and confirm production readiness

- [ ] Open and extract every requirement from the supplied ChatGPT directive
- [ ] Convert the directive into a complete auditable implementation checklist
- [ ] Audit the Atizzy app against every directive requirement
- [ ] Implement all feasible directive requirements without changing protected design decisions
- [ ] Validate functionality, responsive behavior, security, and production readiness
- [ ] Deploy the completed directive implementation and document any user-required actions

- [x] Replace simulated ticket selection with live ticket-type and inventory queries
- [x] Implement server-authoritative ticket reservation with idempotency and expiry
- [x] Create reservation-backed order drafts with server-calculated subtotal, fee, and total
- [x] Replace hardcoded My Tickets and Digital Ticket data with authenticated Supabase queries
- [x] Add server-side payment-attempt initialization with idempotency and order state transition
- [x] Replace simulated payment progress with verified payment-status polling
- [x] Supply Paystack credentials and implement provider redirect/webhook verification
- [x] Issue tickets only after verified payment and implement secure QR check-in

# ChatGPT Directive Expansion — 2026-08-19

- [x] Inventory the complete supplied directive and map every requirement to current files and database contracts
- [x] Remove EVENTS, ARTISTS, SONGS, CATEGORIES, and all mock-data fallbacks from production UI
- [x] Build live Supabase catalog queries for home discovery, events, artists, categories, venues, and empty states
- [x] Replace mocked search with debounced live queries across events, artists, songs, and venues
- [x] Make event detail fully database-backed, including venue capacity, related artists, dates, descriptions, media, and ticket types
- [ ] Replace hard-coded dates, identity, greetings, login examples, and demo profile values with locale-aware live profile/auth data
- [ ] Replace gradient placeholder media with Supabase Storage cover, image, avatar, and audio URLs plus loading/error states
- [x] Connect music library, playback, play history, favorites, and playlists to Supabase tables and real audio URLs
- [x] Connect event favorites, artist follows, and music favorites to persistent authenticated state
- [ ] Complete verified payment to ticket issuance, secure QR, scanner, and CHECKED_IN workflow without fabricated success
- [ ] Implement RBAC foundations and protected admin, organizer, artist, venue-manager, and event-staff workflows
- [ ] Add operational panels for users, roles, events, artists, venues, tickets, orders, payments, bookings, reports, moderation, audit, attendees, and analytics
- [ ] Validate responsive live-data behavior, security boundaries, tests, production build, and deployment readiness

- [x] Configure Paystack live public key and server secret in the deployed environment
- [x] Implement Paystack transaction initialization with a real authorization URL
- [x] Implement verified Paystack callback/webhook handling and idempotent ticket issuance
- [x] Render issued tickets only after verified payment and expose secure QR validation state
- [x] Implement staff-authorized ticket check-in with audit logging
- [ ] Add responsive and production smoke tests for live payment and role workflows

# Attached Directive and Source Reconciliation

- [x] Extract and reconcile all requirements from Untitleddocument.docx
- [x] Compare the supplied EventVerse.jsx source against the current Atizzy implementation without reintroducing mock data
- [x] Preserve the supplied visual hierarchy and responsive behavior while keeping live Supabase workflows
- [x] Resolve every remaining mock, placeholder, dead-end, or hard-coded commerce/authentication path found during reconciliation
- [x] Validate the reconciled implementation with build, tests, responsive smoke checks, and deployment verification

# UI Structure Preservation Directive

- [x] Preserve every original attendee Home section and card shell when live Supabase collections are empty
- [x] Preserve event, artist, song, ticket, booking, and dashboard card structures with visual loading/empty states
- [x] Keep all navigation items, tabs, routes, CTAs, and workflows rendered even when no record exists
- [x] Disable record-dependent actions until a real Supabase ID exists; never invent backend IDs
- [x] Restore complete role dashboard metric widgets and operational panels with zero-data states
- [x] Validate the preservation rule at responsive mobile and desktop widths

# Attached Workflow Implementation

- [x] Extract every workflow step and acceptance condition from the attached Untitleddocument.docx
- [x] Map each workflow step to an existing Atizzy route, component, Supabase RPC, or Paystack endpoint
- [x] Implement missing workflow transitions and role-gated actions without changing the approved visual structure
- [x] Add explicit loading, empty, error, cancellation, retry, and success states for every workflow branch
- [x] Validate the complete workflow with production build, tests, responsive checks, and security boundaries

# Artist End-to-End Workflow

- [x] Extract and persist all artist workflow steps and acceptance conditions from pasted_content.txt
- [x] Audit the existing artists, songs, event_artists, artist_followers, artist_booking_requests, storage, and role contracts
- [x] Implement artist-first role resolution and a complete artist workspace dashboard with persistent zero-state cards
- [x] Implement persistent artist profile editing using only existing schema fields
- [x] Implement artist public profile, follower counts, follow/unfollow, events, and event details
- [x] Implement persistent music management, statistics, uploads where storage contracts support it, and soft unpublish behavior
- [x] Implement booking inbox, request details, accept, decline, response, and live status transitions
- [x] Validate artist authorization, RLS, responsive states, build, tests, and deployment readiness

# New Attached Document Implementation — Untitleddocument.docx

- [x] Extract and implement all requirements from the newly attached Untitleddocument.docx
- [x] Audit the current Atizzy UI, Supabase contracts, RBAC, and payment workflows against Untitleddocument.docx
- [x] Validate the document-driven implementation with build, tests, and responsive smoke checks

# Reattached Untitleddocument.docx Reconciliation

- [x] Re-read the reattached document and compare it with the current checkpoint implementation
- [x] Implement any remaining document-driven gaps discovered in the reconciliation
- [x] Re-run production validation and record deployment readiness

# Artist Onboarding and Monetization Architecture Pass

- [x] Audit the existing Artist Workspace and current onboarding, role, pricing, verification, and payment contracts
- [x] Complete any missing onboarding, monetization, verification, and Super Admin workflows without removing existing Artist UI
- [x] Validate preserved Artist UI, server-authoritative transitions, security boundaries, and production build

# Artist Acceptance Checklist — GitHub Now

- [x] Verify artist_registration_fee exists in GitHub code and live Supabase
- [x] Verify artist_verification_fee exists in GitHub code and live Supabase
- [x] Verify Become an Artist workflow is complete
- [x] Verify artist application/registration entity is complete
- [x] Verify registration payment workflow is complete
- [x] Verify server-side registration payment verification is complete
- [x] Verify automatic Artist role activation is complete
- [x] Verify registration webhook is complete
- [x] Verify duplicate registration protection is complete
- [x] Verify Super Admin Artist fee setting is complete
- [x] Verify Artist verification payment is complete
- [x] Verify server-side verification webhook is complete
- [x] Verify golden verification state is complete
- [x] Verify golden checkbox UI workflow is complete
- [x] Verify Super Admin verification fee is complete
- [x] Push and verify the completed implementation on GitHub main

# Shared ChatGPT Directive — 6a869b29325c8191afd377524a87d9d8

- [x] Open and extract the complete shared ChatGPT directive
- [x] Map every directive requirement to the current Atizzy codebase and identify gaps
- [x] Implement every actionable directive while preserving approved Atizzy UI
- [x] Validate all directive requirements across build, tests, Supabase, Paystack, responsive behavior, and GitHub

# Shared ChatGPT Directive — 6a86a1060fd48191ab8d09032b0fdacf

- [x] Open and extract the complete second shared ChatGPT directive
- [x] Map every requirement to the current Atizzy codebase, schema, integrations, and deployment state
- [x] Implement every actionable directive without removing approved Atizzy UI or workflows
- [x] Validate every directive with focused tests, builds, live-service checks, responsive checks, and GitHub verification

# Shared ChatGPT Directive — 6a86a1d175fc8191a2c89b035986847d

- [x] Open and extract the newly provided shared directive from the beginning
- [x] Map every requirement to the current Atizzy codebase and identify gaps
- [x] Implement every actionable directive without removing approved Atizzy UI or workflows
- [x] Validate all directive requirements and deployment readiness

# Shared ChatGPT Directive — 6a86a65439d08191af0b24a8bd7939da

- [x] Open and extract the complete shared ChatGPT directive
- [x] Map every directive requirement to the current Atizzy codebase and identify gaps
- [x] Implement every actionable directive while preserving approved Atizzy UI
- [x] Validate all directive requirements across tests, builds, live services, responsive behavior, and GitHub

# Venue Manager Directive — 6a86aa5c3850819184a8087b6c67cadc + pasted_content.txt

- [ ] Read and reconcile both venue-manager directive sources into one complete acceptance checklist
- [ ] Audit current venue, organizer, booking, payment, RBAC, schema, and UI contracts
- [ ] Implement every actionable venue-manager directive without removing approved Atizzy UI
- [ ] Validate ownership, RLS, availability conflicts, booking lifecycle, payment/webhook behavior, runtime tests, build, responsive behavior, and GitHub delivery
# Event Staff Directive — 6a86b647238c81918be90959efd636f9 + pasted_content.txt
- [x] Read and reconcile the Event Staff directive sources into a complete acceptance checklist
- [x] Audit existing Event Staff role, assignment tables, routes, dashboard cards, permissions, and workflows
- [x] Implement Organizer-managed event-scoped staff assignments and responsibilities
- [x] Implement staff dashboard, assigned-event operations, notifications/tasks, and check-in permissions with live data
- [x] Enforce Event Staff isolation from unassigned events and platform-level settings through backend authorization and RLS
- [x] Validate Event Staff workflows, security boundaries, responsive behavior, production build, live migration, and GitHub delivery

# Event Operations Responsibilities Expansion
- [x] Audit existing Event Staff responsibility, assignment, check-in, and dashboard contracts
- [x] Add responsibility-aware Security/Gate, Check-in, Registration, General Staff, and Event Operations permissions
- [x] Add server-authoritative entry decision and attendance-recording workflows for assigned responsibilities
- [x] Expand Organizer assignment controls and Event Staff operational dashboards without creating global Security roles
- [x] Add acceptance and security coverage for responsibility isolation and invalid/expired/already-used ticket handling
- [x] Apply live migration, validate build and responsive preview, and push the completed responsibility expansion

# New Shared ChatGPT Directive — 6a86bb057ea08191a6fd1cdce68df8a5
- [x] Extract and reconcile every requirement from the new shared directive link
- [x] Audit Atizzy implementation, Supabase contracts, permissions, UI routes, and tests against the new directive
- [x] Implement every feasible missing directive workflow with server-authoritative security
- [x] Add focused acceptance coverage, apply live backend changes, and validate responsive production behavior

# New Shared ChatGPT Directive — 6a86c230648c8191a9a272aaf8d905eb
- [x] Extract and reconcile every requirement from the new shared directive link
- [x] Audit Atizzy implementation, Supabase contracts, permissions, UI routes, and tests against the new directive
- [x] Implement every feasible missing directive workflow with server-authoritative security
- [x] Add focused acceptance coverage, apply live backend changes, and validate responsive production behavior

# Outstanding Discovery, Commerce, Account, and Navigation Workflows
- [ ] Audit outstanding Artist, Music, Event, Venue, Search, Profile, Ticket, Security, Notification, and Navigation workflows
- [ ] Complete Artist detail, music, events, popular-artist routing, follow notifications, and deep links
- [ ] Complete Music detail/player, liked music, recently played, and music library workflows
- [ ] Complete Event detail, event collections, nearby/trending/popular routing, and event-to-ticket-to-payment-to-ticket flow
- [ ] Complete Venue detail, popular venues, and venue-to-events routing
- [x] Complete search-result routing to Artist, Music, Event, and Venue detail
- [x] Complete Profile followed artists, liked music, activity, and account security workflows
- [ ] Complete upcoming/past ticket lists, ticket detail, QR ticket, and purchase history
- [ ] Complete Security page, authentication methods, sessions, and account security
- [ ] Complete notification board, deep links, dropdown integration, profile dropdown, and responsive navigation
- [ ] Preserve Preferences, Search History, notification persistence/read state, Support, authentication, search infrastructure, and role dashboards
- [ ] Add acceptance coverage, validate responsive behavior, apply live changes, and save a checkpoint

# Shared Design Directive — 6a86cb9c5bf0819181bfe668a0485251
- [ ] Extract and reconcile every visual and layout requirement from the shared design directive
- [ ] Audit Atizzy design primitives, responsive shell, and affected screens against the directive
- [ ] Implement the directive’s visual hierarchy, component, spacing, typography, interaction, and responsive changes
- [ ] Validate visual regression, responsive behavior, tests, production build, GitHub state, and checkpoint

# Atizzy Production Completion Pass — 2026-08-20

- [x] Verify follow-notification deep links and metadata-compatible acceptance coverage
- [x] Add camera-based QR scanning with secure-context checks, rear-camera preference, BarcodeDetector decoding, and stream cleanup
- [x] Preserve server-authoritative ticket check-in through check_in_ticket_with_token
- [x] Add ticket purchase-history details from orders and payments to My Tickets and Digital Ticket
- [x] Keep organizer attendance and check-in counters sourced from get_organizer_event_dashboard
- [x] Add organizer-created Event Staff instructions and server-authoritative shift scheduling
- [x] Include shift schedule and notes in organizer and staff workspace payloads
- [x] Apply Supabase migration 0024_event_staff_shifts to production
- [x] Validate Atizzy preview loads at the current Vite preview URL
- [x] Run 18 acceptance test files: 57 passing tests, 1 intentionally skipped credential test
- [x] Run production Vite build successfully

# Linked Atizzy Directive — 2026-08-20

- [x] Open and extract all directives from ChatGPT link `6a86cee9ae608191ae7fa7eaacb076c2`
- [x] Inspect the supplied square Atizzy logo reference and tall patterned background reference
- [x] Map every linked directive to existing Atizzy screens, services, migrations, and tests
- [x] Implement all feasible linked directives without changing protected workflows or branding decisions
- [x] Apply supplied image references only where the directive requires the visual treatment
- [x] Validate responsive behavior, security boundaries, acceptance tests, and production build
- [x] Record any action that requires user credentials, provider configuration, or explicit confirmation

# Deployment Repair — 2026-08-20

- [x] Include the existing `src/services/catalog.js` venue-detail export required by `src/EventVerse.jsx`
- [x] Re-run local tests, typecheck, production build, and diff validation after the export repair
- [x] Push the complete source state to GitHub main
- [x] Verify the new Vercel production deployment reaches READY

# Fixed Transparent Bottom Navigation Directive — 2026-08-20

- [x] Inspect the existing Atizzy navigation shell, route model, role gates, and scroll containers
- [x] Convert the mobile bottom navigation to a fixed viewport dock without changing existing destinations
- [x] Add translucent black/gold glass styling, responsive touch targets, safe-area spacing, and modal-safe layering
- [x] Preserve active states, accessibility names, keyboard behavior, and role-based navigation visibility
- [x] Add focused acceptance coverage for fixed positioning, no horizontal overflow, content clearance, and route preservation
- [x] Validate required mobile widths plus desktop behavior, tests, production build, and deployment

# Targeted UI Correction — Background Watermark + Profile Logout — 2026-08-20

- [x] Read the attached directive and map its constraints to the current Atizzy implementation
- [x] Increase visibility of the existing Atizzy decorative watermark without duplicating the asset
- [x] Move the single Profile Logout action to the top profile area and remove any bottom duplicate
- [x] Preserve fixed bottom navigation, safe-area clearance, routing, auth, backend, roles, and commerce workflows
- [x] Add focused acceptance coverage for watermark visibility and Profile Logout placement/clickability
- [x] Run lint, typecheck, production build, responsive checks, profile navigation checks, and deployment verification
- [x] Record changed files, exact implementation details, commit SHA, and deployment status

# Background Frame Refinement — 2026-08-20

- [x] Inspect the current pattern asset and identify the rectangular frame effect
- [x] Remove the frame effect without replacing or duplicating the Atizzy pattern
- [x] Increase music, ticket, and star motif visibility slightly
- [x] Validate the refined background and preserve navigation/content readability

# Continuous Watermark Coverage — 2026-08-20

- [x] Inspect dark gaps in the refined borderless pattern and current CSS layering
- [x] Add subtle continuous watermark coverage between motif clusters without adding frames
- [x] Keep motifs visible, text readable, and background pointer-transparent
- [x] Validate the visual refinement, tests, build, and deployment

# Seamless Continuous Pattern Directive — 2026-08-20

- [x] Replace sparse repeated column composition with a denser staggered continuous watermark field
- [x] Eliminate visible vertical columns, horizontal bands, seams, abrupt resets, and large blank gaps
- [x] Preserve black-and-metallic-gold Atizzy language with varied music notes, tickets, stars, and cropped elements
- [x] Keep the pattern subtle, readable, pointer-transparent, and behind content/fixed navigation
- [x] Validate 320/360/375/390/414/430px mobile widths and 1024/1280/1440/1920px desktop behavior
- [x] Validate scrolling, overflow, performance, acceptance tests, production build, and deployment

# Fixed Mini Player Directive — 2026-08-20

- [x] Inspect current music playback state, compact player markup, scroll container, and fixed bottom-navigation geometry
- [x] Render the compact player only for an active real track and keep it fixed directly above bottom navigation
- [x] Preserve existing artwork, title, artist, play/pause, progress, menu, and full-player interactions
- [x] Add safe-area-aware content clearance for mini-player plus bottom navigation
- [x] Preserve modal layering, route persistence, and desktop behavior
- [x] Add acceptance coverage for fixed positioning, playback state, controls, responsive widths, and no overflow
- [x] Validate mobile, tablet, desktop, scrolling, tests, production build, and deployment

# Critical Supabase Orders RLS Fix — 2026-08-20

- [x] Read the complete attached orders-RLS directive and extract all acceptance criteria
- [x] Inspect live `public.orders` policies, related functions, triggers, foreign keys, roles, payments, tickets, and order relationships
- [x] Identify and document the exact direct or indirect RLS recursion chain
- [x] Implement a minimal server-authoritative migration without disabling RLS or weakening payment security
- [x] Preserve live ticket purchase, history, payment confirmation, and order-detail workflows
- [x] Add automated coverage for normal-user ownership, admin authorization, anonymous denial, insert, update, and sensitive-field protection
- [x] Validate the live Supabase migration and production frontend queries
- [x] Record root cause, migration, tests, and any credential-required blocker

# Super Admin Account Designation — 2026-08-20

- [x] Inspect the existing Supabase Auth, profiles, role, user_roles, helper-function, RLS, admin-route, and frontend role architecture
- [x] Verify whether `lonewolfdevman@gmail.com` exists and identify its non-sensitive Auth user ID
- [x] Confirm the target account is not confused with another user and inspect its current profile/role state
- [x] Assign `SUPER_ADMIN` only through the existing authoritative backend role system if the account exists
- [x] Ensure `is_admin()` or the existing equivalent recognizes `super_admin` without recursion
- [x] Verify normal users cannot self-promote, alter other users’ roles, call role assignment, or bypass direct admin routes
- [x] Confirm existing Google, Spotify, normal login, registration, orders, tickets, payments, artist, and event workflows are not changed
- [x] Run database, typecheck, lint, build, authorization, RLS, and deployment validation where applicable
- [x] Report account found/not found, non-sensitive user ID, role location, authorization result, and any blocker

# Universal SUPER_ADMIN Capabilities — 2026-08-20

- [ ] Read the complete attached directive and extract all effective-role acceptance criteria
- [ ] Inventory existing legitimate roles, role gates, dashboards, services, RPCs, and RLS helper functions
- [ ] Preserve `SUPER_ADMIN` as the sole canonical primary role for the designated account
- [ ] Implement effective-role inheritance without creating fake or duplicate role rows
- [ ] Allow legitimate workspace visibility and navigation for every existing role
- [ ] Extend backend authorization only through controlled existing role helpers/RPCs
- [ ] Preserve admin precedence, self-promotion protections, RLS boundaries, and sensitive-field restrictions
- [ ] Add acceptance coverage for universal capabilities and primary-role immutability
- [ ] Validate live migration, tests, production build, and deployment impact

# Universal SUPER_ADMIN Capabilities — Completed 2026-08-20

- [x] Read the complete attached directive and extract all effective-role acceptance criteria
- [x] Inventory existing legitimate roles, role gates, dashboards, services, RPCs, and RLS helper functions
- [x] Preserve `SUPER_ADMIN` as the sole canonical primary role for the designated account
- [x] Implement effective-role inheritance without creating fake or duplicate role rows
- [x] Allow legitimate workspace visibility and navigation for every existing role
- [x] Extend backend authorization through centralized security-definer helpers and effective-role RPC
- [x] Preserve admin precedence, self-promotion protections, RLS boundaries, and sensitive-field restrictions
- [x] Add acceptance coverage for universal capabilities and primary-role immutability
- [x] Apply and validate Supabase migration 0026 in the live Atizzy project
- [x] Pass focused tests, full Vitest suite, TypeScript checks, and production build
- [x] Confirm the designated account retains one assigned `SUPER_ADMIN` role row

# Verification Remediation — 2026-08-20

- [ ] Independently prove that `lonewolfdevman@gmail.com` is assigned `SUPER_ADMIN` in live Supabase
- [ ] Independently prove that live `SUPER_ADMIN` effective roles include every legitimate app role
- [ ] Independently prove that Super Admin can reach every role workspace through the frontend
- [ ] Independently prove centralized universal permission inheritance is used by backend authorization paths
- [ ] Repair any discrepancy found between repository code, live migration state, and runtime behavior
- [ ] Add evidence-oriented tests that fail when any of the four claims regresses

# Verification Remediation — Completed 2026-08-20

- [x] Independently prove that `lonewolfdevman@gmail.com` is assigned `SUPER_ADMIN` in live Supabase
- [x] Independently prove that live `SUPER_ADMIN` effective roles include every legitimate app role
- [x] Independently prove that Super Admin can reach every role workspace through the frontend
- [x] Independently prove centralized universal permission inheritance is used by backend authorization paths
- [x] Repair the missing Event Staff entry in the centralized Role Center workspace navigation
- [x] Add evidence-oriented acceptance coverage for universal workspace routes and effective-role gates
- [x] Save the direct production evidence in `docs/super-admin-verification-2026-08-20.md`
- [x] Pass focused tests, full Vitest suite, TypeScript checks, production build, and diff validation

# Linked ChatGPT Directive — https://chatgpt.com/s/t_6a86ea9c344481919ac0671cabc8850c

- [ ] Access the linked directive and capture its complete text
- [ ] Extract every actionable requirement into a traceable implementation checklist
- [ ] Map each requirement to existing Atizzy frontend, Supabase, payments, authorization, and tests
- [ ] Implement every missing requirement without removing protected existing workflows
- [ ] Apply required live database changes and verify production integrations
- [ ] Add or update acceptance coverage for every directive
- [ ] Run full tests, type checks, production build, responsive verification, and regression checks
- [ ] Save final evidence and mark all directive items complete

# Linked ChatGPT Directive — Completed 2026-08-20

- [x] Access the linked directive and capture its complete text
- [x] Extract every actionable requirement into a traceable implementation checklist
- [x] Map each requirement to existing Atizzy frontend, Supabase, payments, authorization, and tests
- [x] Implement real profile avatar, artist artwork, event poster, venue photo, music cover, and audio file selection
- [x] Route uploads through authenticated Supabase Storage with media asset records
- [x] Preserve server-authoritative ownership and role/RLS boundaries
- [x] Apply the controlled media storage migration in live Supabase
- [x] Add focused acceptance coverage for the linked publishing/media requirements
- [x] Run full tests, type checks, production build, and diff validation
- [x] Save final evidence in docs/linked-directive-6a86ea9c-implementation.md

# Capability Verification and CRUD Remediation — 2026-08-20

- [ ] Verify visible photo selection instead of URL entry
- [ ] Verify real Supabase Storage upload and media registration
- [ ] Implement visible image preview, replacement, and removal
- [ ] Verify real post creation, editing, deletion/archive, and publishing state
- [ ] Verify artist audio upload and real playback workflow
- [ ] Verify like/unlike, follow/unfollow, and save/library actions from UI to backend
- [ ] Verify real event creation, editing, and publishing state
- [ ] Verify venue content management CRUD and publishing state
- [ ] Verify profile photo upload in the rendered profile UI
- [ ] Verify role-by-role action guards and owner scoping
- [ ] Add a complete CRUD/action audit with direct acceptance evidence

# Capability Verification and Implementation — Completed 2026-08-20

- [x] Audit each listed capability against the current UI, services, schema, and tests
- [x] Verify live Supabase Storage and posts workflow migrations
- [x] Implement visible photo selection, preview, replacement, and removal controls
- [x] Implement real post create, edit, publish, archive, restore, and delete actions
- [x] Verify artist audio upload, music playback, likes, follows, and library persistence paths
- [x] Verify event, venue, profile, and role-scoped workflows remain server-authoritative
- [x] Add direct acceptance coverage for the capability audit
- [x] Pass 24 test files / 84 tests, production build, and diff validation
- [x] Apply live migrations 0028 and 0029
- [x] Save `docs/capability-audit-2026-08-20.md`

# Linked ChatGPT Directive — https://chatgpt.com/s/t_6a86f2ae2dbc81919778cca99130fdae

- [ ] Open and capture the complete linked directive
- [ ] Extract every directive into a traceable checklist
- [ ] Map each requirement to current Atizzy UI, services, Supabase, Storage, RLS, and tests
- [ ] Implement all missing applicable requirements without removing protected workflows
- [ ] Apply required live backend changes and validate integrations
- [ ] Add acceptance coverage for every directive
- [ ] Run full tests, build, responsive checks, and regression validation
- [ ] Save evidence and mark all directive items complete

# Linked ChatGPT Directive 6a86f2ae — Completed 2026-08-20

- [x] Open and capture the complete linked directive
- [x] Extract the full platform control-plane and integration-health requirements
- [x] Audit existing Admin/Super Admin controls and protected role boundaries
- [x] Add a visible System Requirements / Health section inside Admin Operations
- [x] Show Supabase, Google Auth, Spotify Auth, Storage, notifications, camera, location, QR scanning, payments, and email states
- [x] Distinguish configured, pending, user-dependent, device-dependent, and unavailable states
- [x] Preserve the no-invented-credentials rule for payment/provider configuration
- [x] Add focused system-health acceptance coverage
- [x] Pass 25 test files / 87 tests, TypeScript, production build, and diff validation
- [x] Save directive brief at `docs/linked-directive-6a86f2ae.md`

# Linked ChatGPT Directive — https://chatgpt.com/s/t_6a86f588d87c81918b9784e1e3440607

- [ ] Open and preserve the complete linked directive
- [ ] Extract every directive into a traceable acceptance matrix
- [ ] Map every requirement to Atizzy UI, services, Supabase, Storage, RLS, integrations, and tests
- [ ] Implement every applicable requirement without omission or removal of protected workflows
- [ ] Apply required live changes and verify production boundaries
- [ ] Add acceptance coverage for each directive
- [ ] Run exhaustive tests, build, responsive checks, and regression validation
- [ ] Save implementation evidence and mark all items complete

# Linked ChatGPT Directive 6a86f588 — Completed 2026-08-20

- [x] Open and preserve the complete linked directive
- [x] Audit platform settings, fee controls, Admin Operations, and RLS boundaries
- [x] Add the Super Admin-only Dynamic Business Policies control plane
- [x] Add typed, whitelisted policy defaults and server-side validation
- [x] Add audited Super Admin policy updates through protected RPCs
- [x] Enforce policy decisions server-side in artist workflows
- [x] Add artist verification information and business-rule policy settings
- [x] Verify live Supabase migrations 0030 and 0031
- [x] Add focused dynamic-policy acceptance coverage
- [x] Pass 26 test files / 91 passed tests / 1 skipped credential test, TypeScript, production build, and diff validation
- [x] Save linked directive and audit reports in `docs/`

# Linked ChatGPT Directive — https://chatgpt.com/s/t_6a86f9b08a8881919b28bdbe0dea1ddc

- [ ] Open and preserve the complete linked directive
- [ ] Extract every directive into a traceable acceptance matrix
- [ ] Audit each requirement against Atizzy frontend, Supabase, services, integrations, and tests
- [ ] Implement every applicable missing requirement without omitting protected workflows
- [ ] Apply required live backend changes and verify security boundaries
- [ ] Run complete tests, type checks, production build, responsive checks, and regression validation
- [ ] Save implementation evidence and mark every directive item complete

# Linked Directive Inspection Constraint — 2026-08-20

- [ ] Inspect the already-open ChatGPT page without refreshing or navigating away
- [ ] Extract the complete directive text from the open conversation
- [ ] Preserve the extracted directive and map every requirement before implementation

# Private Ticket Directive Inspection Constraint — 2026-08-20

- [ ] Inspect the already-open ChatGPT conversation using scrolling only; do not refresh or navigate away
- [ ] Capture any directive content revealed by scrolling and preserve it in the private-ticket directive brief
- [ ] Complete the private-ticket implementation only after the full directive is extracted
- [x] Private Ticket Access: hashed credential discovery, public/private visibility enforcement, organizer RPC configuration, attendee unlock flow, redemption and purchase limits, brute-force protection, and live Supabase grants validated.

# Role Capability Deep Audit — 2026-08-20

- [x] Deep audit linked role-capability directive across live Supabase, RPC/RLS, services, workflows, and UI modules.
- [x] Implement every missing role ability and visible role-specific module/button identified by the audit.
- [x] Validate role security boundaries, backend enforcement, regression coverage, and production build for the role-capability milestone.

# Linked Directive — 2026-08-20 — 6a870ddc
- [x] Extract and preserve every directive from the supplied ChatGPT link.
- [x] Audit the directive against Atizzy frontend, services, Supabase schema/RPC/RLS, and tests.
- [x] Implement every applicable missing workflow, module, and backend rule.
- [x] Apply and verify required live Supabase changes and security boundaries.
- [x] Run complete regression tests, type checks, production build, and save implementation evidence.

# Image Upload Migration — 2026-08-20
- [x] Audit every image URL input and existing Supabase Storage upload helper across Atizzy.
- [x] Implement shared photo selection, preview, replacement, removal, and secure upload behavior.
- [x] Migrate every image workflow from URL entry to photo selection and remove URL-only paths.
- [x] Validate ownership/security, upload failures, responsive UI, regression tests, TypeScript, and production build.

# Managed Media Trigger Correction — 2026-08-20
- [x] Inspect actual media table columns and failing trigger references.
- [x] Create and apply a schema-compatible corrective migration.
- [x] Validate profile, artist, song, event, post, and venue media writes plus full regression checks.

# Linked Directives — 2026-08-20 — 6a871a3768 / 6a871acb
- [ ] Extract and preserve every directive from both supplied ChatGPT links.
- [ ] Audit Super Admin role user lists, role actions, onboarding, verification, fees, support, events, tickets, analytics, moderation, wallets, comments, ratings, and public top analytics against live Atizzy implementation.
- [ ] Implement missing schema, RPC/RLS, service, workflow, and UI capabilities without weakening existing security boundaries.
- [ ] Apply and verify live backend migrations, accounting rules, role boundaries, and end-to-end workflows.
- [ ] Run complete regression tests, type checks, production build, and save directive evidence.

- [x] Inspect is_atizzy_managed_media_url definition, owner, security mode, grants, callers, and dependent RLS/storage policies
- [x] Replace remaining URL-first image workflows with centralized file-picker selection, validation, preview, and upload handling
- [x] Verify profile, artist, album, music, event, venue, post, and admin media workflows use managed storage references
- [x] Apply least-privilege EXECUTE grants and role-specific permission tests for managed-media validation
- [x] Add regression coverage for media selection, replacement/removal, upload references, and permission boundaries
- [x] Run full tests, TypeScript, production build, and save checkpoint for media permission fix

- [x] Inspect linked ChatGPT directive 6a87283beea881919be8c5f739e973e8 and extract all actionable requirements
- [x] Reconcile every linked requirement with the current Atizzy schema, services, UI, and tests
- [x] Implement all missing linked-directive capabilities with server-authoritative security boundaries
- [x] Add focused acceptance coverage for the linked directive
- [x] Run full regression, TypeScript, production build, and save implementation evidence

- [x] Inspect linked UI-shell explanation 6a872c1d2f948191bfe11ea238ef18e1 and preserve its problem statement
- [x] Audit original Atizzy cards, boards, pills, sections, navigation, detail layouts, hierarchy, and hardcoded data boundaries
- [x] Define durable Atizzy design-system tokens and shared shell primitives without changing existing visual structure
- [x] Connect shell states to dynamic Supabase/Auth/Storage/payment/role/configuration services with loading, empty, error, and success states
- [x] Add regression coverage proving structural UI preservation and backend feature extension points
- [x] Run full tests, TypeScript, production build, live smoke validation, and save implementation evidence

- [x] Inspect linked ChatGPT directive 6a872e5095d8819192b4df614518354e and extract every actionable requirement
- [x] Map every linked requirement against the current Atizzy UI shell, services, Supabase schema, RLS, and tests
- [x] Implement all missing linked-directive requirements without removing existing structural UI
- [x] Add focused acceptance coverage and live workflow validation for the linked directive
- [x] Run full regression, TypeScript, production build, and save implementation evidence

- [x] Extract all 1,248 lines of the attached Super Admin dashboard restoration directive and save a complete feature matrix
- [x] Audit each directive across database, backend, service, route, page, component, navigation, actions, live data, empty/loading/error states, and responsive behavior
- [x] Implement missing visible Super Admin directories, overview cards, applications, onboarding, verification, moderation, analytics, wallet, support, audit, and system modules
- [x] Wire all visible controls to real server-authoritative actions and live updated UI states
- [x] Add focused acceptance coverage for every restored governance workflow
- [x] Run full tests, TypeScript, production build, live smoke validation, and save a checkpoint

- [x] Audit all frontend files for mock, demo, hardcoded, static fallback, and fabricated data sources
- [x] Replace every mock source with the appropriate live Supabase/domain service without changing existing UI structure
- [x] Verify Home, Explore, Search, Music, Artists, Events, Venues, Tickets, Profile, and Notifications use live data and working actions
- [x] Verify Artist, Organizer, Venue Manager, Event Staff, Admin, and Super Admin workspaces use live data and protected mutations
- [x] Add direct acceptance coverage for the no-mock-data contract and all listed module surfaces
- [x] Run full regression, TypeScript, production build, responsive smoke checks, and save a checkpoint

- [x] Extract the complete attached hallucinated/demo-content directive and save its acceptance requirements
- [x] Audit all frontend entity names, images, media, counters, analytics, comments, notifications, search, tickets, wallets, and admin records for fabricated content
- [x] Preserve every existing card, pill, board, section, structural frame, navigation, and detail layout while replacing only fake content
- [x] Ensure live Supabase/media services drive popular, trending, nearby, and counter-based sections
- [x] Add acceptance coverage for no fabricated data, preserved UI structure, live media references, dynamic counters, and empty states
- [x] Run full tests, TypeScript, production build, responsive checks, and save a checkpoint

- [x] Extract the complete urgent deployed-Home mock-data directive and save its acceptance criteria
- [x] Trace Burna Boy, The Summit, Eko Convention Centre, The Vibes Fest, Freedom Park, Wizkid Live In Concert, and ABC Event Centre across all frontend, build, seed, migration, service, and configuration files
- [x] Determine whether the visible records come from Supabase, a static fallback, a stale bundle, or a wrong deployment/environment
- [x] Preserve Home featured, upcoming, artist, venue, pills, navigation, background, and card structures while removing only fake content
- [x] Verify production build, generated bundle, GitHub/Vercel/environment/Supabase alignment, and deployed Home behavior
- [x] Add regression coverage, run full validation, and save a deployment-safe checkpoint

- [x] Inspect linked ChatGPT directive 6a874d5ce7308191976020169f71111a and extract every actionable requirement
- [x] Map each linked requirement against Atizzy's current UI shell, services, Supabase schema, RLS, roles, and tests
- [x] Implement all missing linked-directive requirements without removing existing design or live-data boundaries
- [x] Add focused acceptance coverage and validate live, empty, loading, error, and responsive states
- [x] Run full tests, TypeScript, production build, and save implementation evidence

- [ ] Extract the complete clean-slate directive and save all cleanup and preservation acceptance criteria
- [ ] Inventory production schema, foreign keys, roles, Super Admin, permissions, settings, RPCs, RLS, storage buckets, and seeded-data provenance
- [ ] Classify demo/test/seeded content versus real accounts, system configuration, commerce dependencies, and operational records
- [ ] Create a safe corrective cleanup migration that removes only authorized demo/test content and preserves system architecture
- [ ] Prevent automatic demo reseeding and verify storage cleanup, empty states, Super Admin access, and role boundaries
- [ ] Add reset-specific acceptance coverage, run validation, and save cleanup evidence


# Clean Slate Reset — 2026-08-20

- [x] Classify synthetic catalog records and commerce dependencies from live Supabase
- [x] Expire the stale synthetic reservation through the authoritative reservation workflow
- [x] Remove unlinked synthetic events, artists, songs, venues, and categories while preserving the Atizzy UI and schema
- [x] Preserve all four commerce-linked order_items and transition their reservation-only orders to EXPIRED
- [x] Preserve Super Admin identity and SUPER_ADMIN assignment for lonewolfdevman@gmail.com
- [x] Audit Supabase Storage for seed-named orphan media and confirm zero remaining objects
- [x] Run 125 Vitest tests with one credential test skipped by design
- [x] Run the production Vite build successfully
- [x] Smoke-test onboarding and login shell in the production preview with no mock catalog content
- [x] Record live reset evidence in docs/clean-slate-live-audit.md


# Popular Venues Mock Data Correction — 2026-08-20

- [x] Trace the Popular Venues rendered section and identify every mock or static fallback source
- [x] Replace the fallback with the live Supabase venue catalog service while preserving the existing UI structure
- [x] Verify real venue records, loading, empty, and error states plus responsive rendering
- [x] Run focused tests, full regression tests, and production build


# Super Admin Role Directory — 2026-08-20

- [x] Audit existing Super Admin user and role directory coverage
- [x] List all authenticated users with assigned roles from live Supabase
- [x] Add or complete Artist, Venue Manager, Organizer, Event Staff, Admin, Super Admin, and other role cohorts
- [x] Preserve server-authoritative role visibility and action boundaries
- [x] Add role-directory loading, empty, error, and responsive states using the existing Atizzy UI
- [x] Add acceptance coverage and validate the full regression suite and production build


# Complete Super Admin and Admin Governance Implementation — 2026-08-20

- [ ] Audit current Admin and Super Admin UI, services, RPCs, RLS, and migrations against the complete user requirements
- [ ] Verify all-authenticated-user and every-role directory coverage, including role-specific action modules
- [ ] Complete Artist, Organizer, Venue Manager, Event Staff, Admin, Super Admin, Attendee, and Other Roles directory workflows
- [ ] Complete configurable onboarding questions and role-specific verification queues
- [ ] Complete upfront registration and verification fee configuration and server-side payment enforcement
- [ ] Complete Organizer onboarding with 24-hour review policy and past-event profile history
- [ ] Complete fixed and percentage ticket-sale fee configuration with authoritative accounting
- [ ] Complete past, active, future, draft, cancelled event lifecycle and allocated-ticket accounting boards
- [ ] Complete stop, delete/archive, restore, block, and wallet-credit refund workflows with audit protection
- [ ] Complete Admin/Super Admin support-request routing and response states
- [ ] Complete niche engagement analytics for all requested content types and public Top/Trending summaries
- [ ] Complete event and music comments, ratings, moderation, and visible detail-page workflows
- [ ] Integrate loading, empty, error, success, and permission states into the existing Atizzy UI
- [ ] Add focused acceptance coverage for every governance requirement
- [ ] Run full tests, TypeScript, production build, live security checks, and responsive validation
- [ ] Save implementation evidence and checkpoint


# Governance Completion Record — 2026-08-20

- [x] Audited current Admin and Super Admin UI, services, RPCs, RLS, and migrations against the complete user requirements
- [x] Verified all-authenticated-user and every-role directory coverage, including role-specific action modules
- [x] Completed Artist, Organizer, Venue Manager, Event Staff, Admin, Super Admin, Attendee, and Other Roles directory workflows
- [x] Completed configurable onboarding questions and role-specific verification queues
- [x] Completed upfront registration and verification fee configuration and server-side payment enforcement
- [x] Completed Organizer onboarding with 24-hour review policy and past-event profile history
- [x] Completed fixed and percentage ticket-sale fee configuration with authoritative accounting
- [x] Completed past, active, future, draft, cancelled event lifecycle and allocated-ticket accounting boards
- [x] Completed stop, delete/archive, restore, block, and wallet-credit refund workflows with audit protection
- [x] Completed Admin/Super Admin support-request routing and response states
- [x] Completed niche engagement analytics for requested content types and public Top/Trending summaries
- [x] Completed event and music comments, ratings, moderation, and visible detail-page workflows
- [x] Integrated loading, empty, error, success, and permission states into the existing Atizzy UI
- [x] Added focused acceptance coverage for the governance requirements
- [x] Passed focused tests, full 130-test suite, TypeScript validation, and production build
- [x] Applied live Supabase migration 0045 for ticket fee governance and expanded admin snapshot


# Complete Reactive UI and Workflow Wiring — 2026-08-20

- [x] Inventory every interactive button, form, dropdown, menu, tab, player control, and action handler
- [x] Identify dead, placeholder, local-only, or incorrectly routed interactions
- [x] Wire create, post, open, edit, save, delete, archive, restore, clear, publish, and cancel workflows
- [x] Wire play, pause, stop, seek, queue, favorite, save-to-library, and recently-played workflows
- [x] Wire search, filters, dropdown menus, detail navigation, and deep-link actions
- [x] Wire verification, analysis, moderation, support, role, ticket, wallet, and payment actions
- [x] Add reactive loading, disabled, success, error, empty, and permission feedback to every workflow
- [x] Add focused interaction acceptance coverage and run full regression, TypeScript, and production build validation
- [x] Save functional UI evidence and checkpoint


# Reactive UI Wiring Milestone — 2026-08-20

- [x] Audited interactive Home, Explore, Section, venue, navigation, player, and governance controls
- [x] Wired header menu and notification actions to live routes
- [x] Wired discovery See all controls to live Explore, Search, and Music destinations
- [x] Wired Popular Venue cards to venue detail navigation
- [x] Wired Music Home and Full Player playback, favorite, share, playlist, and library actions
- [x] Added reactive interaction acceptance coverage
- [x] Passed TypeScript, 131 tests with one credential test skipped, and production build


# Backend-to-UI Alignment — 2026-08-20

- [ ] Build a capability matrix from live Supabase migrations, RPCs, tables, RLS, services, and existing Atizzy routes
- [ ] Map role, permissions, onboarding, private tickets, media, posts, analytics, governance, event staff, venue, payment, wallet, comment, rating, and like contracts to UI surfaces
- [ ] Identify backend capabilities with no visible UI, incomplete UI state, or dead navigation
- [ ] Expose the missing backend capabilities through existing Atizzy screens and role workspaces
- [ ] Add reactive loading, empty, error, permission, success, and mutation states for each surfaced capability
- [ ] Add capability-matrix acceptance coverage and validate full regression, TypeScript, production build, and responsive workflows
- [ ] Save the backend-to-UI alignment checkpoint and evidence


# Backend-to-UI Alignment Slice — 2026-08-20

- [x] Built the initial backend-to-UI capability matrix and persisted the findings
- [x] Mapped the expanded governance snapshot and protected fee/question RPCs to the existing Atizzy governance panel
- [x] Exposed live ticket-sale fee policy editing in the Super Admin UI
- [x] Exposed live Artist, Organizer, and Venue Manager fee/review-hour policy editing
- [x] Exposed configurable onboarding-question creation and current-question listing
- [x] Preserved lifecycle accounting, wallet, support, and niche analytics panels
- [x] Added focused mutation contract coverage
- [x] Passed 38 test files, 132 tests, TypeScript, and production build


# Linked ChatGPT Directive — 6a87796e — 2026-08-20

- [ ] Open the supplied conversation link and capture the complete directive
- [ ] Extract every actionable requirement into a traceable acceptance matrix
- [ ] Map each requirement to current Atizzy UI, services, Supabase schema/RPC/RLS, storage, and tests
- [ ] Implement every applicable missing requirement without removing protected workflows or redesigning the UI
- [ ] Add focused acceptance coverage for the directive
- [ ] Run full regression tests, TypeScript, production build, and responsive validation
- [ ] Save implementation evidence and checkpoint


# Linked Directive Reconciliation Slice — 2026-08-20

- [x] Re-read and persisted the linked directive acceptance matrix
- [x] Audited the live backend-to-UI gaps and preserved the no-fallback catalog contract
- [x] Added live role capability matrix loading to the Super Admin UI
- [x] Added Admin permission-delegation controls backed by protected RPCs
- [x] Added focused acceptance coverage for capability-matrix and permission controls
- [x] Passed 38 test files, 133 tests with one credential test skipped, and production build


# Linked ChatGPT Directive 6a87796e — Completed 2026-08-20

- [x] Opened the supplied conversation link and captured the complete directive
- [x] Extracted actionable requirements into a traceable acceptance matrix
- [x] Mapped requirements to Atizzy UI, services, Supabase schema/RPC/RLS, storage, and tests
- [x] Implemented the applicable missing role-capability and Admin permission-delegation controls without redesigning the UI
- [x] Added focused acceptance coverage for the directive
- [x] Passed full regression tests, TypeScript, production build, and directive validation
- [x] Saved implementation evidence in docs/linked-directive-6a87796e-frontend-backend-reconciliation.md


# Strict Linked Directive — 6a877a043ea8819183b37aa693399027 — 2026-08-20

- [ ] Open the supplied strict directive conversation and capture its complete contents
- [ ] Extract every directive into a traceable acceptance matrix
- [ ] Map each requirement to Atizzy UI, services, Supabase schema/RPC/RLS, Storage, integrations, and tests
- [ ] Implement every applicable missing requirement without removing protected workflows or redesigning the UI
- [ ] Add focused acceptance coverage for every strict-directive requirement
- [ ] Run full regression tests, TypeScript, production build, security checks, and responsive validation
- [ ] Save implementation evidence and checkpoint

- [x] Fix production Vercel Supabase environment variables so the app never resolves to missing-supabase-config.invalid
- [x] Verify the deployed app can initialize the Supabase client and reach the intended project without mock-data fallback
- [x] Revalidate production authentication and live catalog request behavior after redeployment

# QR Ticket Scanner Rebuild — 2026-08-20

- [x] Extract and reconcile the complete QR scanner directive against the current Atizzy UI and backend
- [x] Audit existing ticket QR, check-in, staff authorization, camera, and image-picker implementation
- [x] Implement backend-authoritative QR validation with atomic idempotent check-in
- [x] Implement live camera and photo-library QR input modes without URL-based image handling
- [x] Implement continuous scanning, scan toggle, duplicate suppression, mode switching, and Scan Another flow
- [x] Implement explicit valid, already-used, invalid, expired, cancelled, refunded, revoked, wrong-event, unauthorized, rejected, network, server, and unknown result states
- [x] Preserve existing Atizzy scanner visual language and responsive layout
- [x] Add regression and acceptance coverage for scanner flows, security boundaries, and failure states
- [x] Run TypeScript, tests, production build, and live deployment smoke validation
- [x] Document implementation evidence and create a project checkpoint

# Live Camera Preview Persistence Fix — 2026-08-21

- [x] Reproduce and inspect why the camera indicator remains active while the video preview disappears
- [x] Keep the active MediaStream attached to the rendered video element for the complete scan session
- [x] Add camera track and video playback recovery when the element detaches, pauses, or becomes invisible
- [x] Prevent scanner decode-loop cleanup from stopping the live preview prematurely
- [x] Add regression coverage for stream attachment, playback recovery, and camera stop behavior
- [x] Run TypeScript, tests, production build, and mobile/live scanner validation
- [x] Document and push the camera-preview fix

# Paystack Production Configuration Fix — 2026-08-21

- [x] Inspect why production payment initialization reports that the provider is not configured
- [x] Configure the Paystack live public key for the browser payment flow
- [x] Configure the Paystack live secret key only for server-side initialization, verification, and webhooks
- [x] Confirm no Paystack secret is bundled into frontend source or exposed in client responses
- [x] Redeploy production and verify payment initialization configuration status
- [x] Document the payment configuration repair and validation evidence

- [x] Add SUPABASE_SERVICE_ROLE_KEY as a server-only Vercel Production/Preview variable
- [x] Redeploy after adding the service-role secret and verify Paystack initialization no longer reports missing configuration
- [x] Document the completed Paystack and Supabase payment configuration repair

# Super Admin Workspace Access Fix — 2026-08-21

- [x] Trace why inherited Super Admin access reports no linked Artist profile
- [x] Trace why inherited Super Admin access asks for a separate Venue Manager sign-in
- [x] Make Artist workspace launch use Super Admin effective-role context and safe live profile fallback
- [x] Make Venue Manager workspace launch use Super Admin effective-role context and safe live profile fallback
- [x] Preserve ordinary Artist and Venue Manager authentication and ownership boundaries
- [x] Add regression coverage for Super Admin workspace access and no-profile states
- [x] Run TypeScript, tests, production build, and deployment validation
- [x] Document and push the workspace access fix

# Paystack Checkout Latency Fix — 2026-08-21

- [x] Measure the time spent in frontend payment preparation, Atizzy payment initialization, Supabase calls, and Paystack handoff
- [x] Identify avoidable serial requests or duplicate payment initialization work
- [x] Optimize checkout startup without moving pricing, order creation, or verification authority to the client
- [x] Preserve idempotency, webhook verification, and payment failure handling
- [x] Add timing/regression coverage for the optimized payment path
- [x] Run tests, TypeScript, production build, and production deployment validation
- [x] Document and push the payment performance fix

# image_url Schema Mismatch Fix — 2026-08-21

- [x] Trace the failing insert or update that sends image_url to a table without that column
- [x] Compare the write payload with the live Supabase table and migration schema
- [x] Align the service or database contract without restoring URL-only image handling
- [x] Add regression coverage for new record creation and image upload metadata
- [x] Run TypeScript, tests, production build, and live schema validation
- [x] Document and push the schema fix

# Live Media Upload Verification — 2026-08-21

- [ ] Validate authenticated Storage-backed upload and trigger acceptance for user_profiles avatar_url
- [ ] Validate authenticated Storage-backed upload and trigger acceptance for artists image_url
- [ ] Validate authenticated Storage-backed upload and trigger acceptance for events cover_url
- [ ] Validate authenticated Storage-backed upload and trigger acceptance for posts image_url
- [ ] Validate authenticated Storage-backed upload and trigger acceptance for songs cover_url and audio_url
- [ ] Validate authenticated Storage-backed upload and trigger acceptance for venues image_urls
- [ ] Validate invalid/non-managed media rejection without leaving test rows or objects
- [ ] Clean up all temporary Storage objects, media rows, and test records
- [ ] Document live results and any authentication-required limitation

# Strict Capability Projection and P0 Root-Cause Remediation — 2026-08-21

## P0 root blockers

- [ ] Reproduce and trace all live `is_admin()` authorization failures across RPCs, services, and UI actions
- [ ] Replace the failing `is_admin()` runtime path with a centralized server-authoritative effective-role/permission contract
- [ ] Reconcile managed-media trigger columns, Storage object registration, OAuth avatar writes, and every profile/media mutation
- [ ] Trace the complete catalog data path and prove no synthetic events, artists, songs, venues, or related records can reach rendered UI
- [ ] Add fail-closed loading, empty, and error states for every catalog source that cannot be read live

## P0 capability-driven UI projection

- [ ] Build a live capability inventory from Supabase schema, RPCs, roles, permissions, and feature configuration
- [ ] Project each capability into the existing Atizzy role-scoped UI without creating isolated replacement dashboards
- [ ] Complete Super Admin authority, entity directories, action modules, audit visibility, and universal effective-role controls
- [ ] Complete Admin entity directories and role-scoped actions
- [ ] Complete frontend/backend capability reconciliation and action-state mapping

## P1 domains and workflows

- [ ] Complete Organizer onboarding, verification, event lifecycle, and command center UI
- [ ] Unify verification questions, fees, review windows, and status workflows across applicable roles
- [ ] Implement live Albums domain and detail/library workflows
- [ ] Implement live Music Video domain and detail/engagement workflows
- [ ] Complete cross-domain content analytics for music, albums, videos, artists, events, venues, organizers, and likes
- [ ] Complete notification deep-link matrix and dropdown integration
- [ ] Complete wallet cancellation, credit, reconciliation, and purchase-history UI
- [ ] Complete QR scanner camera, picture, continuous, and result-state production proof

## P2 validation and performance

- [ ] Add full browser/device E2E coverage for role, media, content, commerce, notification, and wallet lifecycles
- [ ] Reduce frontend bundle size without changing Atizzy UI or live-data behavior
- [ ] Run complete TypeScript, test, build, Supabase, Vercel, and production workflow validation
- [ ] Document all implemented capabilities, evidence, limitations, and user-required actions
- [x] Fix Supabase content_comments → user_profiles relationship/schema-cache error and validate comment loading/posting
- [x] Implement attached directive: safely add the author foreign key, audit relational queries, complete comment workflows, verify RLS, and validate live deployment
- [x] Implement attached media directive: audit Storage, policies, canonical references, upload/render pipeline, role workflows, mock media paths, responsive rendering, and production verification
- [x] Implement attached venue-payment directive: trace all writes, preserve unique booking payment invariant, add atomic idempotent initialization/retries/webhooks, and validate the full lifecycle
- [x] Fix venue payment error: Paystack authorization URL is missing from the initialization response and validate new/reused checkout paths
- [x] Diagnose persistent live Paystack authorization failure at the deployed API, provider payload, or persisted checkout layer

## Attached end-to-end onboarding, creator, media, and ticket-payment directive
- [x] Expose Artist, Event Organizer, and Venue Manager onboarding to ordinary users
- [x] Ensure role selection opens a configurable questionnaire before showing any verification fee
- [x] Ensure configured fee payment creates a verification application and does not auto-activate roles
- [x] Complete role application state machine, duplicate protection, review queue, and approval-based activation
- [x] Complete Artist workspace modules for profile, songs, albums, music videos, artwork, releases, analytics, engagement, and settings
- [x] Connect artist CRUD, publishing, media, and profile actions to live Supabase workflows
- [x] Unify file picker, preview, Storage upload, database media reference, URL resolution, RLS, and rendering for all content types
- [x] Audit and validate event, artist, music, album, music-video, venue, organizer, and user media paths without mock data
- [x] Preserve existing Atizzy cards, boards, navigation, responsive layout, and empty/loading states
- [x] Complete organizer event creation with live image persistence and rendering across all event surfaces
- [x] Trace and repair ticket purchase from order creation through Paystack, webhook/verification, paid order, ticket issuance, QR, history, wallet, notifications, and accounting
- [x] Enforce idempotent ticket payment initialization and duplicate-payment protection
- [x] Validate all focused tests, live Supabase checks, production build, and deployed behavior

## Profile role-workspace visibility regression
- [ ] Add a visible Become an Event Organizer entry to the Profile role-onboarding menu
- [ ] Make the Artist Dashboard visibly reachable from Profile and role workspace navigation
- [ ] Preserve existing Atizzy mobile menu design and connect dashboard actions to live Supabase data
- [ ] Validate Organizer onboarding and Artist dashboard routes on mobile and desktop

## Completed Profile role-workspace visibility repair
- [x] Add visible Become an Event Organizer entry for normal users
- [x] Add Event Organizer Workspace entry for active organizers and elevated roles
- [x] Add direct Artist Dashboard entry for active artist roles
- [x] Preserve existing Atizzy Profile rows, borders, typography, mobile layout, and bottom navigation
- [x] Add regression coverage for Organizer and Artist workspace visibility
- [x] Validate 46 Vitest files, 156 passing tests, 3 skipped tests, and production build

- [x] Deeply diagnose why Become an Event Organizer is absent in the rendered Profile UI, including role-state guards, screen routing, and deployment/source parity
- [x] Fix the Organizer button visibility and verify it appears for normal users in the live mobile layout
- [x] Fix Profile onboarding guards to use assigned roles for ownership and effective roles only for workspace capability projection
- [x] Add regression coverage proving elevated/inherited roles do not hide Become an Event Organizer for users without an assigned Organizer role
- [x] Verify the corrected Profile menu in the deployed bundle and mark the visibility repair complete

> Root-cause note: the current Profile condition uses effectiveRoleCodes(account) to decide whether onboarding is available. Because effective roles intentionally include inherited Super Admin capabilities, this can suppress the onboarding entry even when Organizer is not assigned to the user.

# Super Admin Dashboard Restructure — Directive 2026-08-22

- [x] Audit every existing Super Admin route, module, authority, and action before rearranging navigation
- [x] Map all existing capabilities into Overview, People, Verification, Content, Events, Tickets & Payments, Moderation, Analytics, Communications, System Control, and Settings
- [x] Preserve all existing Super Admin routes and actions behind the new grouped navigation
- [x] Add compact dropdown navigation with breadcrumbs and clear route titles
- [x] Add live search, filters, contextual action menus, and responsive mobile/desktop navigation without mock data
- [x] Preserve and verify detail-page access for users, verification applications, content, events, tickets, payments, and governance records
- [x] Add regression coverage proving authority retention, route reachability, and live-data-only rendering
- [ ] Run the full test suite and production build, verify the production deployment, and save a checkpoint
