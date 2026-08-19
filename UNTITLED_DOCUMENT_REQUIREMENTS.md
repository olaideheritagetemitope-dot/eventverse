# Untitleddocument.docx — authoritative requirements

The document requires extending, not replacing, the existing Atizzy/EventVerse UI. The normal artist lifecycle must be user-requested and payment-verified: normal user → Become an Artist → backend fee display → immutable registration transaction → Paystack payment → server/webhook verification → idempotent artist profile and ARTIST role activation → Artist Workspace.

Super Admin controls live `artist_registration_fee` and `artist_verification_fee` in a secure platform settings system. Fees are server-authoritative, persisted, auditable with old/new value, actor, and timestamp, and captured immutably on each transaction. Normal users, artists, and other roles cannot change settings.

Artist registration must prevent duplicate active or pending transactions and expose live user states: Become an Artist, payment pending, activating, retry, or open workspace. Payment redirects never activate roles; verified server events do. Activation must be idempotent.

Artist verification is separate from Artist registration. It has its own fee, immutable transaction, duplicate protection, server verification, and golden badge status. Artist Workspace must show Get Verified, pending, or Verified Artist based on backend state; registration alone must not grant verification.

Critical security fixes: artist bookings must be scoped to the authenticated user’s linked artist profile (`artist_id`), not `requester_id`; artist songs must be scoped to the linked artist profile; every artist operation must enforce authenticated ownership in RLS/RPC, not frontend role checks alone. Music creation/edit/upload/publish/archive should persist through existing Supabase tables/storage where supported. Artist events must use `event_artists` relationships without granting organizer ownership.

Super Admin must see live fee settings, registrations, verifications, and revenue; all UI must preserve existing cards, tabs, routes, navigation, empty states, and responsive behavior. No mock fees, counts, statuses, or payment states. Required checks include RLS ownership, duplicate and delayed/duplicated webhook behavior, fee changes during pending transactions, cancellation/failure/refresh/return-later flows, cross-artist access attempts, protected routes, mobile/tablet/desktop responsiveness, build/type/lint, and the complete registration-to-verification journey.
