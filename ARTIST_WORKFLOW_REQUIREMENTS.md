# Artist — Complete End-to-End Workflow

Source: `/home/ubuntu/upload/pasted_content.txt` (user-provided attachment; no external URL).

The artist journey is: authenticate through Supabase Auth, resolve an administratively assigned ARTIST role, enter an EventVerse-style Artist Workspace, manage the artist profile, manage music, view event participation, receive and manage booking requests, track activity, interact with fans, and manage public artist presence.

## Required workflow

1. Authentication uses the existing Login/OAuth -> Supabase Auth -> user_profiles -> user_roles -> ARTIST -> Artist Workspace path. The artist must not self-select a role.
2. Artist first entry must route an authenticated ARTIST to an EventVerse-style workspace, not a plain admin page.
3. Dashboard cards must remain visible with live counts for followers, songs, events, and bookings, including zero-state counts. It must retain sections for upcoming events, recent music, and booking requests.
4. Artist profile must use only existing artists columns: artist name, image, bio, verification/follower data, and other fields only if they exist. Profile edits must persist to artists and immediately appear publicly.
5. Public artist profiles must show image, name, bio, follower count, follow action, music, and events. Attendees can discover, follow, listen, and discover artist events.
6. Followers must use artist_followers and display a real count, never a hard-coded number.
7. Artist music management must use songs and support viewing songs, statistics, persistent add/upload where current storage contracts support it, metadata editing, and schema-compatible remove/unpublish rather than unsafe hard delete.
8. Music statistics must derive from songs.play_count, music_favorites, play_history, and artist_followers where supported.
9. Artist events must derive from events -> event_artists -> artists, with upcoming and past groupings. Artists may view participation but must not automatically edit organizer-owned events.
10. Booking requests use artist_booking_requests and include event name, event type, date, expected audience, budget, message, and backend status. Artist inbox must show request details and allow only authorized/status-valid accept, decline, or respond actions. Status transitions must persist and be visible to requester; no fake local status.
11. Event detail for artists must expose authorized event, venue, date/time, other artists, and description while hiding sensitive organizer/payment data without permission.
12. Attendance must reuse the existing ticket/check-in system if applicable rather than inventing a second system.
13. Logout must use Supabase signOut and return to Login. Artist permissions must be limited to their own profile, music, relationships, bookings, and event participation; artists must not manage other artists, users, all events, tickets, payments, platform roles, or users.
14. Responsive artist UI and runtime verification are required. Implementation order: role authentication/workspace, profile, public profile, followers, music, statistics, events, booking requests, accept/decline, dashboard aggregation, responsive UI, runtime verification.

## Existing schema anchors

- `artists`: id, user_id, name, bio, verified, follower_count, image_url, created_at, updated_at.
- `songs`: id, artist_id, title, duration_seconds, audio_url, cover_url, play_count, created_at.
- `event_artists`: event_id, artist_id.
- `artist_followers`: artist_id, user_id, created_at.
- `artist_booking_requests`: requester_id, artist_id, event_name, event_type, event_date, expected_audience, budget, message, status, timestamps.
- `events`: organizer_id, venue_id, title, description, city, starts_at, ends_at, cover_url, status.
- Existing RBAC migration gives artists ownership policies for their own profile and songs. Booking review policies/RPCs must be checked before adding mutations.
