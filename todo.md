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
