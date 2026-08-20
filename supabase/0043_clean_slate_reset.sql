-- Atizzy Clean Slate reset
-- Removes unlinked synthetic catalog records while preserving commerce-linked
-- order history, schema, governance, and the Super Admin identity.
-- Safe to re-run: every mutation is scoped to the known seed identifiers.

begin;

-- Release the one stale ACTIVE reservation through the existing authoritative
-- workflow. This adjusts ticket inventory and marks expired reservations.
do $$
declare
  released integer;
begin
  released := public.release_expired_ticket_reservations();
  raise notice 'Released % expired reservations before clean-slate cleanup', released;
end;
$$;

-- The four seed orders are reservation-only commerce history. Once their
-- reservations are expired, close the order state without deleting order_items.
update public.orders o
set status = 'EXPIRED'::public.order_status,
    updated_at = now()
where o.status = 'RESERVED'::public.order_status
  and o.reservation_id in (
    select r.id
    from public.ticket_reservations r
    where r.status = 'EXPIRED'::public.reservation_status
      and r.event_id in (
        '40000000-0000-0000-0000-000000000002'::uuid,
        '40000000-0000-0000-0000-000000000003'::uuid,
        '40000000-0000-0000-0000-000000000004'::uuid
      )
  );

-- Preserve the three event branches referenced by order_items, but make them
-- unavailable to the public catalog. No paid orders or issued tickets exist.
update public.events
set status = 'CANCELLED'::public.event_status,
    updated_at = now()
where id in (
  '40000000-0000-0000-0000-000000000002'::uuid,
  '40000000-0000-0000-0000-000000000003'::uuid,
  '40000000-0000-0000-0000-000000000004'::uuid
);

-- Delete the three synthetic events with no commerce-linked order_items.
-- Their ticket types and join rows cascade according to the live schema.
delete from public.events
where id in (
  '40000000-0000-0000-0000-000000000001'::uuid,
  '40000000-0000-0000-0000-000000000005'::uuid,
  '40000000-0000-0000-0000-000000000006'::uuid
);

-- Remove synthetic media/catalog records. Songs are deleted first so their
-- artist foreign keys and engagement/history cascades remain deterministic.
delete from public.songs
where id in (
  '60000000-0000-0000-0000-000000000001'::uuid,
  '60000000-0000-0000-0000-000000000002'::uuid,
  '60000000-0000-0000-0000-000000000003'::uuid,
  '60000000-0000-0000-0000-000000000004'::uuid,
  '60000000-0000-0000-0000-000000000005'::uuid
);

delete from public.artists
where id in (
  '30000000-0000-0000-0000-000000000001'::uuid,
  '30000000-0000-0000-0000-000000000002'::uuid,
  '30000000-0000-0000-0000-000000000003'::uuid,
  '30000000-0000-0000-0000-000000000004'::uuid,
  '30000000-0000-0000-0000-000000000005'::uuid,
  '30000000-0000-0000-0000-000000000006'::uuid
);

-- Only venues no longer referenced by the retained commerce branches are
-- deleted. The retained venue rows remain hidden through cancelled events.
delete from public.venues
where id in (
  '20000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000005'::uuid,
  '20000000-0000-0000-0000-000000000006'::uuid
);

-- Seed categories are catalog scaffolding only; remove their join rows via
-- the existing cascade while preserving the category table and constraints.
delete from public.categories
where id in (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000005'::uuid
);

-- Hard assertions prevent a partial or unsafe reset from committing.
do $$
begin
  if exists (select 1 from public.artists where id::text like '30000000-0000-0000-0000-00000000000%') then
    raise exception 'Clean Slate failed: synthetic artists remain';
  end if;
  if exists (select 1 from public.songs where id::text like '60000000-0000-0000-0000-00000000000%') then
    raise exception 'Clean Slate failed: synthetic songs remain';
  end if;
  if exists (select 1 from public.events where id in (
    '40000000-0000-0000-0000-000000000001'::uuid,
    '40000000-0000-0000-0000-000000000005'::uuid,
    '40000000-0000-0000-0000-000000000006'::uuid
  )) then
    raise exception 'Clean Slate failed: unlinked synthetic events remain';
  end if;
  if (select count(*) from public.order_items where ticket_type_id in (
    '50000000-0000-0000-0000-000000000003'::uuid,
    '50000000-0000-0000-0000-000000000004'::uuid,
    '50000000-0000-0000-0000-000000000005'::uuid
  )) <> 4 then
    raise exception 'Clean Slate failed: commerce-linked order_items were not preserved';
  end if;
end;
$$;

commit;
