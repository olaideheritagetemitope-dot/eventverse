begin;

-- Venue deletion must not destroy booking or payment history. Existing bookings are
-- retained and detached from the deleted venue; events already use ON DELETE SET NULL.
alter table public.venue_bookings
  alter column venue_id drop not null;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.venue_bookings'::regclass
      and con.confrelid = 'public.venues'::regclass
      and con.contype = 'f'
  loop
    execute format('alter table public.venue_bookings drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.venue_bookings
  add constraint venue_bookings_venue_id_fkey
  foreign key (venue_id)
  references public.venues(id)
  on delete set null;

create or replace function public.delete_owned_venue(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue public.venues;
  v_paths text[] := '{}'::text[];
  v_role_allowed boolean := false;
  v_booking_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('ADMIN','SUPER_ADMIN')
      and coalesce(ur.status::text, 'ACTIVE') not in ('SUSPENDED','REVOKED','INACTIVE')
  ) into v_role_allowed;

  select v.*
  into v_venue
  from public.venues v
  where v.id = p_venue_id
    and (v.owner_id = auth.uid() or v_role_allowed)
  for update;

  if not found then
    raise exception 'Venue access denied or venue does not exist';
  end if;

  select count(*)
  into v_booking_count
  from public.venue_bookings vb
  where vb.venue_id = p_venue_id;

  select coalesce(array_agg(ma.object_path) filter (where ma.object_path is not null), '{}'::text[])
  into v_paths
  from public.media_assets ma
  where ma.entity_id = p_venue_id
    and lower(coalesce(ma.entity_type, '')) in ('venue', 'venues', 'venue_image', 'venue_photo')
    and ma.media_kind in ('VENUE_PHOTO','VENUE_IMAGE','VENUE');

  delete from public.media_assets
  where entity_id = p_venue_id
    and lower(coalesce(entity_type, '')) in ('venue', 'venues', 'venue_image', 'venue_photo')
    and media_kind in ('VENUE_PHOTO','VENUE_IMAGE','VENUE');

  -- The FK changes venue_bookings.venue_id to NULL atomically while preserving
  -- booking/payment rows for audit and reconciliation.
  delete from public.venues where id = p_venue_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'DELETE',
    'VENUE',
    p_venue_id,
    jsonb_build_object(
      'name', v_venue.name,
      'media_paths', to_jsonb(v_paths),
      'detached_booking_count', v_booking_count,
      'history_preserved', true
    )
  );

  return jsonb_build_object(
    'id', p_venue_id,
    'media_paths', to_jsonb(v_paths),
    'detached_booking_count', v_booking_count,
    'history_preserved', true
  );
end;
$$;

revoke all on function public.delete_owned_venue(uuid) from public;
grant execute on function public.delete_owned_venue(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
