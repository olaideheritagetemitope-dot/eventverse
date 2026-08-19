# Attached EventVerse Directive Requirements

Source document: `/home/ubuntu/upload/Untitleddocument.docx`
Source UI file: `/home/ubuntu/upload/EventVerse.jsx.txt`
Supabase project ref: `blalvoelllndmbppbkcy`

## Product intent

The supplied EventVerse.jsx is the authoritative UI/UX reference. This is a restoration and live-data integration task, not a redesign. Preserve the original design tokens, Fraunces/Inter typography, dark premium surfaces, gold CTA system, green music accents, cards, navigation, forms, drawers, modals, loading/empty/error states, responsive behavior, page hierarchy, and CTA placement. Replace production data sources only; do not remove the UI or simplify it into a module list.

## Required screens and flows

Preserve onboarding, login, signup, verify, home, explore, search, event detail, ticket selection, checkout, payment, processing, success, digital ticket, My Tickets, profile, artist, booking, music, and music player. Use the current production routing architecture and route IDs rather than duplicate or dead-end routes. Preserve attendee experience: Home, Explore, Search, Event Detail, Ticket Selection, Checkout, Payment, My Tickets, Music, Profile.

## Live data rules

No production mock fallbacks such as `liveData || MOCK_DATA`, `events.length ? events : EVENTS`, or fabricated success data. Every data-driven section must render loading, empty, error, or success states. Use the existing Supabase schema and do not create a second database or reset production data.

Use `user_profiles.full_name` for greeting, with a neutral fallback such as `Good evening 👋` when unavailable. Public event data must come from `events` and exclude drafts for attendees. Join `venues`, `event_artists`/`artists`, `categories`, and `ticket_types`. Event detail must load by route event ID and survive refresh, including venue, categories, artists, ticket types, and favorite state.

Use persistent `event_favorites`, `artist_followers`, and `music_favorites` add/remove/read behavior. Search retains All, Events, Artists, Songs, Albums, and Venues tabs, uses debounced live queries, and does not contain a permanent demo query.

Use `songs`, `artists`, `music_favorites`, `play_history`, `playlists`, and `playlist_items`. Audio must use real `audio_url` values when available. Real playback records `user_id`, `song_id`, `played_at`, and `seconds_played`. Playlists must be persisted, not only React state.

## Commerce and payment rules

Preserve ticket card, quantity selector, price, subtotal, and continue CTA. Ticket data comes from `ticket_types` with price, capacity, sold, reserved, maximum per customer, sales start, and sales end. Availability authority is server-side through the existing reservation RPC with `event_id`, ticket-type quantities, and idempotency key. Checkout uses authoritative reservation/order subtotal, service fee, discount, total, and currency.

Payment screens must connect to the real payment backend. Never display payment success before provider verification. Paystack secrets remain server-only. My Tickets and Digital Ticket query authenticated `tickets`, `orders`, `ticket_types`, and `events`; never generate fake tickets in React state. QR must correspond to an issued ticket; check-in remains server-authoritative and must not expose unsafe raw secret tokens.

## Artist and role requirements

Artist profile uses `artists`, `artist_followers`, `songs`, `event_artists`, and `artist_booking_requests`. Booking preserves Event Name, Event Type, Date, Expected Audience, Budget, and Message fields, validates all fields, submits authenticated `requester_id` and real `artist_id`, and displays submission status.

Roles are administratively assigned only: ATTENDEE, ARTIST, ORGANIZER, VENUE_MANAGER, EVENT_STAFF, ADMIN, SUPER_ADMIN. Do not expose frontend privileged-role claiming or fake admin selectors. Protected routes require authentication, role, permission, and resource ownership; backend/RLS is authoritative.

Admin surface includes Dashboard, Users, Roles, Permissions, Events, Artists, Venues, Tickets, Orders, Payments, Bookings, Categories, Reports, and Audit Logs using real data. Organizer surface includes Dashboard, Events, Create/Edit Event, Ticket Types, Orders, Attendees, Analytics. Artist includes Dashboard, Profile, Music, Events, Bookings, Analytics. Venue manager includes Dashboard, Venue Profile, Events, Bookings, Availability respecting owner ownership. Event staff includes Dashboard, Assigned Events, Ticket Scanner, Check-ins, Attendance.

## Engineering and release constraints

Use existing tables: user_profiles, roles, user_roles, permissions, role_permissions, categories, venues, artists, events, event_categories, event_artists, ticket_types, ticket_reservations, reservation_items, orders, order_items, payments, tickets, artist_followers, event_favorites, songs, playlists, playlist_items, music_favorites, play_history, artist_booking_requests, and audit_logs. Preserve current authentication and Supabase project. Validate build, tests, responsive behavior at mobile and desktop sizes, security boundaries, production deployment, and all interaction paths. Remaining user-required actions must be listed explicitly; do not claim end-to-end completion without observing a verified payment-to-ticket flow.
