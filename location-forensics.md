# Location architecture forensic findings

## Attached directive
Source: `/home/ubuntu/upload/pasted_content.txt` (EVENTVERSE — LOCATION ARCHITECTURE: VENUES + EVENTS + PROXIMITY).

Required outcomes: real venue coordinates, structured address metadata, server-side proximity, venue/event inheritance, resilient user geolocation, nearby venues/events, exact discovery definitions, RLS preservation, map/provider service abstraction, and production lifecycle verification.

## Live Supabase findings
Project: `blalvoelllndmbppbkcy`.

The live `public.venues` table already has nullable numeric `latitude` and `longitude` columns with range checks (`latitude` -90..90; `longitude` -180..180). It does not currently expose structured fields for state/region, country, formatted address, provider place ID, or location metadata. `public.events` has a `venue_id` foreign key to `public.venues` and currently has a `city` field, but the active create/update event service does not persist coordinates directly.

The live discovery RPC `get_discovery_snapshot(numeric,numeric,numeric)` is SECURITY DEFINER, executable by anon/authenticated, and currently calculates `nearbyEvents` server-side with the Haversine formula using `venues.latitude/longitude`. It returns `publicPlaylists` from `playlists.visibility='PUBLIC'`. Current canonical definitions for trending/upcoming/featured/popular venues are already implemented in migration 0111.

Canonical service contracts: `createOwnedVenue` calls RPC `create_owned_venue`; `updateOwnedVenue` currently calls RPC `update_owned_venue` with name/city/address/capacity/etc. but no coordinates. `createOrganizerEvent` inserts directly into `events` with `venue_id:null`; `updateOrganizerEvent` updates venue_id but no location inheritance. `loadAvailableVenues` reads venues and booking conflicts. Active Venue Manager UI includes text fields for city/address and venue photo, but no map/search/pin or coordinate fields.

Canonical venue creation RPC originated in `supabase/0015_venue_manager_workflow.sql`; its signature currently accepts name, city, address, capacity, description, venue_type, amenities, rules, contact_phone, image_urls, pricing, cancellation_policy. Its validation only requires name/city/positive capacity. `publish_organizer_event` currently validates title/description/city/start/ticket type but not venue coordinate presence or location inheritance.

Next implementation should extend the existing RPCs additively or with exact signature-safe replacements, add structured venue location metadata/indexes, enforce coordinates for physical venue publication, propagate venue coordinates to associated events through the canonical venue relationship, and wire existing UI forms to a provider-agnostic location picker without mock/default coordinates. User geolocation and permission-denied handling must remain non-blocking.
