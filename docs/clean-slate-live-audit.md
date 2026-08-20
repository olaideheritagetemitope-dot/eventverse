
## Live schema inventory checkpoint

Source: Supabase live project `blalvoelllndmbppbkcy`, public schema inventory retrieved 2026-08-20.

The live schema is present with RLS enabled on inspected engagement tables. `content_comments`, `content_ratings`, and `content_likes` currently report zero rows. The inspected engagement tables reference `auth.users` for user/author ownership and use target-type constraints for events, songs, albums, artists, venues, organizers, and music videos. Any cleanup must preserve the schema, RLS, foreign keys, functions, roles, system settings, and Super Admin identity while targeting only authorized application/demo records.

## Live schema and row-count audit

Source: live Supabase project `blalvoelllndmbppbkcy`, queried 2026-08-20.

Public tables include role and governance architecture (`roles`, `permissions`, `role_permissions`, `user_roles`, `admin_permission_grants`, `platform_settings`, `policy_settings`, `role_fee_policies`, `role_onboarding_questions`, `audit_logs`), content (`artists`, `events`, `venues`, `songs`, `posts`, `media_assets`), commerce (`ticket_types`, `tickets`, `orders`, `order_items`, `payments`, `reservation_items`, `ticket_reservations`, `wallet_accounts`, `wallet_ledger`), engagement (`content_likes`, `content_ratings`, `content_comments`, and follow/favorite/history tables), operations (staff assignments, notifications, tasks, moderation, support), and onboarding/application tables.

Observed counts: artists 6; events 7; venues 6; songs 5; user_profiles 11; user_roles 1; roles 7; ticket_types 7; tickets 0; orders 4; order_items 4; payments 0; wallet_accounts 0; wallet_ledger 0; content_comments 0; content_likes 0; content_ratings 0; posts 0; media_assets 0; audit_logs 14; permissions 25; role_permissions 56; platform_settings 2; policy_settings 8; role_fee_policies 3; role_onboarding_questions 0.

Important preservation rule: the live database contains nonzero orders/order_items and an existing user_roles row, so a blind truncate or broad cascade would risk destroying commerce history, identity-role architecture, and the Super Admin account. Cleanup must first classify exact provenance and preserve system/configuration tables.

Schema fields confirmed for key data: `user_profiles(id, full_name, phone, avatar_url, onboarding_complete, created_at, updated_at)`; `user_roles(user_id, role_id, created_at)`; `events(id, organizer_id, venue_id, title, description, city, address, starts_at, ends_at, status, cover_image_url, created_at, updated_at)`; `artists(id, owner_id, stage_name, bio, image_url, verification_status, created_at, updated_at)`; `venues(id, owner_id, name, city, address, capacity, created_at, updated_at, description, venue_type, image_urls, pricing, cancellation_policy)`; `songs(id, artist_id, title, duration_seconds, audio_url, cover_url, play_count, created_at)`; `ticket_types(id, event_id, name, price, capacity, sold, reserved, visibility, access_method, created_at)`.

## Schema recovery after provenance query

The live Supabase schema query confirmed that `artists` uses `owner_id` rather than the previously attempted alternate ownership field; `venues` uses `owner_id`; `songs` includes `artist_id`, `audio_url`, `cover_url`, and `play_count`; `ticket_types` includes `event_id`, `sold`, `reserved`, `access_method`, redemption and purchase-limit fields; `user_profiles` uses `id`, `full_name`, `avatar_url`, and `onboarding_complete`; and `user_roles` uses `user_id`, `role_id`, and `created_at`. The initial combined provenance query failed because it requested a nonexistent artists ownership column; no live data mutation was performed.

## Confirmed provenance and commerce dependencies

The exact synthetic catalog identifiers are present live: 6 events, 6 artists, 6 venues, 5 songs, and 7 ticket types. All six seeded event-artist and event-category links are present. Four `order_items` reference seeded ticket types: ticket type `50000000-0000-0000-0000-000000000003` appears with quantities 1 and 3, `...0004` appears with quantity 1, and `...0005` appears with quantity 1. There are no live `tickets` for the seeded ticket types. The four orders are all currently `RESERVED`, with totals of NGN 7,875.00, NGN 4,200.00, NGN 23,625.00, and NGN 6,300.00; no payments were present in the audited counts.

Relevant foreign keys are restrictive for commerce: `order_items.ticket_type_id -> ticket_types.id` is RESTRICT, `reservation_items.ticket_type_id -> ticket_types.id` is RESTRICT, `payments.order_id -> orders.id` is RESTRICT, and `tickets.ticket_type_id -> ticket_types.id` is RESTRICT. Catalog relationships otherwise largely cascade from events/artists/songs. Therefore the safe policy is not to delete the four commerce-linked ticket types or their parent events until the reserved orders are explicitly expired/refunded through the existing server-authoritative commerce workflow; instead the clean-slate migration must quarantine/close those synthetic commerce branches while deleting all unlinked synthetic catalog records.

## Post-reset verification checkpoint

The live transaction committed successfully. Seed artists and songs now report zero rows. Three synthetic event branches remain intentionally quarantined because they preserve the four commerce-linked order_items: the three events are cancelled, their three ticket types remain as referential history, and all four linked orders are EXPIRED. The Super Admin identity `lonewolfdevman@gmail.com` still has exactly one live `SUPER_ADMIN` role row. A storage-object search for seed UUID names returned zero objects, so no seed-named orphan media required deletion.


## Popular Venues correction — 2026-08-20

The live `public.venues` query showed the remaining synthetic rows `Eko Convention Centre`, `Freedom Park`, and `Terra Kulture` with the original seeded UUIDs. Their parent `events.venue_id` foreign key is `ON DELETE SET NULL`, so migration `supabase/0044_remove_retained_synthetic_venues.sql` safely removed all six original synthetic venue UUIDs without deleting preserved event or commerce history. Post-migration audit: `venue_count = 0`, `synthetic_venue_count = 0`, `event_count = 4`, `order_item_count = 4`, and `expired_order_count = 4`.

The existing frontend contract remains intact: Explore's `Popular Venues` section reads only `catalog?.venues`, the catalog service applies `filterLiveCatalogRows("venues", venueResult.data)`, and the existing `EmptyVenueCard` structure remains in place. A regression assertion was added to `tests/no-mock-data.acceptance.test.js`. Validation passed: 38 test files and 127 tests, followed by a successful Vite production build.
