# Music, Venue, Player, and Engagement Live Audit

Date: 2026-08-22

## Live Supabase source

Project: EventVerse (`blalvoelllndmbppbkcy`), region `eu-west-1`.

## RLS findings

The live `songs` table has owner-write policies keyed through `artists.user_id = auth.uid()` plus Admin/Super Admin access. The live `venues` table has owner-write policy keyed through `owner_id = auth.uid()` plus Admin/Super Admin access. Therefore delete is permitted at RLS for legitimate owners; missing or disconnected UI/service actions are likely contributors, but the exact client mutation still needs tracing.

The live `content_likes` table has authenticated self-write policy: `user_id = auth.uid()` or `is_super_admin()`. The live `content_ratings` table has the equivalent policy. The diagnostic response did not include the check constraint rows because the multi-statement result surfaced the policy result; run a separate constraint query before changing the schema.

Source: live Supabase SQL inspection via project `blalvoelllndmbppbkcy` on 2026-08-22.
