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
- [ ] Implement role and permission foundations for all required roles
- [ ] Implement persistent event discovery, search, favorites, sharing, and artist flows
- [ ] Implement organizer event lifecycle and management interfaces
- [ ] Implement server-authoritative ticket inventory, reservations, orders, and checkout
- [ ] Implement verified payment lifecycle, ticket issuance, digital tickets, and check-in
- [ ] Implement artist booking, music library, playlists, playback history, and player persistence
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
- [ ] Run production build and confirm Vercel deployment health
