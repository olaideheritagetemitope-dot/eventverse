-- Atizzy Clean Slate follow-up: remove synthetic venues retained only because their
-- cancelled synthetic events preserved historical commerce references.
-- events.venue_id is ON DELETE SET NULL, so deleting these venues preserves event/order history.

begin;

delete from public.venues
where id in (
  '20000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  '20000000-0000-0000-0000-000000000003'::uuid,
  '20000000-0000-0000-0000-000000000004'::uuid,
  '20000000-0000-0000-0000-000000000005'::uuid,
  '20000000-0000-0000-0000-000000000006'::uuid
)
and owner_id is null;

commit;
