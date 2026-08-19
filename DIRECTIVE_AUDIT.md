# Atizzy Directive Audit

## Source of truth

The supplied ChatGPT directive requires the Supabase database to be the production source of truth. Frontend mock data may remain only as development seed data in Supabase; production UI must not fall back to local constants. Every screen must expose loading, empty, error, success, and unauthorized states as applicable, and a workflow is incomplete until a newly created database record can travel through the intended path and render in the UI.

## Current findings

The current Atizzy UI remains a large `src/EventVerse.jsx` monolith, but the production data paths have been refactored to shared Supabase catalog and user services. Home discovery, search, event detail, favorites, artists, music, playlists, playback history, profile state, reservations, orders, payment attempts, role dashboards, and ticket retrieval now use live records or explicit loading/empty/error states. A small amount of presentation copy and media fallback policy remains under review, and the UI must not fabricate payment success or ticket issuance.

The live foundation now includes Supabase authentication, user profiles, published event/artist/song reads, ticket types, reservation RPCs, reservation-backed orders, payment-attempt initialization, Paystack initialization and signature-verified webhook handlers, authenticated ticket retrieval, RBAC boundaries, role dashboards, favorites, followers, songs, playlists, playback history, booking requests, audit logs, and verified payment/ticket/check-in RPC contracts.

## Implementation sequence

First, create a service layer and remove local production-data fallbacks while preserving the approved visual language. Next, wire live catalog, search, event detail, profile, media, favorites, and music behavior. Then complete verified payment, ticket issuance, secure QR, and staff check-in, followed by role-aware operational panels. Finally, validate the required responsive widths, security boundaries, empty/error/unauthorized states, production build, and end-to-end database workflows.

## External blockers

Paystack live credentials are now stored securely and credential validation passes. The remaining release gates are deploying the Vercel API handlers with the configured environment, configuring the Paystack webhook URL, validating a real sandbox/live transaction, and completing the operator-facing secure QR scanner/check-in surface. Ticket issuance remains server-authoritative and is never simulated before a verified provider result. Media and audio continue to require valid production URLs.
