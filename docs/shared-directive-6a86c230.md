# Shared Directive 6a86c230648c8191a9a272aaf8d905eb

Source: https://chatgpt.com/s/t_6a86c230648c8191a9a272aaf8d905eb

## Product scope

The directive requires a complete live-data Atizzy experience covering artist discovery and profiles, music discovery and playback, events, venues, global search, profiles, notifications, tickets, preferences, settings, support, responsive navigation, deep links, and end-to-end workflows.

## Feature groups

### Artist and music

Artist detail, popular artists, artist profiles, artist music, follow/unfollow, followed artists, artist events, music detail/player, music library, liked music, saved tracks, recently played, albums/playlists where supported, and artist-to-music-to-event relationships.

### Events and venues

Event detail, upcoming/trending/popular/nearby events, event search and filtering, venue detail, popular venues, venue events and information, location-based discovery, and event-to-ticket purchase.

### Search

Global search across artists, music, events, and venues, with search history, recent searches, clearing history, and categorized results.

### Profile and notifications

Profile, edit profile, preferences, followed artists, liked music, event activity, account settings, notification board, read/unread state, mark as read, mark all as read, event reminders, ticket notifications, artist notifications, and system notifications.

### Tickets and library

Upcoming and past tickets, ticket detail, QR ticket, ticket status, event information, check-in status, purchase history, personal library, music preferences, event preferences, location preferences, notification preferences, discovery preferences, password/security settings, active sessions, authentication methods, sign out of sessions, and account deletion where supported.

### Help and navigation

Help center, FAQs, contact support, report a problem, ticket/payment support, account support, profile dropdown, notification dropdown, search overlay/page, mobile navigation, desktop navigation, deep links, back navigation, and empty/loading/error states.

## End-to-end relationship examples

- Popular Artists → Supabase artists → Artist Detail → Artist Music → Artist Events → Follow Artist → Notification.
- Trending Event → Event Detail → Select Ticket → Payment → Ticket Created → Upcoming Tickets → QR Code → Event Check-in.
- Search → Query → Artists/Music/Events/Venues → Search History.

## Governing implementation rule

Keep every existing card, section, route, and visual structure. Replace hard-coded or mock content with live data and make every interaction functional. Preserve responsive behavior and provide complete empty, loading, error, and end-to-end verification states.
