-- EVENTVERSE LOCATION ARCHITECTURE
-- One canonical physical-location contract for venues and attached events.

alter table public.venues
  add column if not exists formatted_address text,
  add column if not exists state_region text,
  add column if not exists country text,
  add column if not exists provider_place_id text,
  add column if not exists location_metadata jsonb not null default '{}'::jsonb;

alter table public.events
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists formatted_address text,
  add column if not exists state_region text,
  add column if not exists country text,
  add column if not exists provider_place_id text,
  add column if not exists location_metadata jsonb not null default '{}'::jsonb;

alter table public.venues drop constraint if exists venues_coordinates_pair_check;
alter table public.venues add constraint venues_coordinates_pair_check check (
  (latitude is null and longitude is null)
  or (latitude is not null and longitude is not null and not (latitude = 0 and longitude = 0))
);

alter table public.events drop constraint if exists events_coordinates_range_check;
alter table public.events add constraint events_coordinates_range_check check (
  (latitude is null or latitude between -90 and 90)
  and (longitude is null or longitude between -180 and 180)
  and not (coalesce(latitude, 999) = 0 and coalesce(longitude, 999) = 0)
);

create index if not exists venues_coordinates_idx on public.venues (latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists events_coordinates_idx on public.events (latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists events_venue_starts_idx on public.events (venue_id, starts_at) where venue_id is not null;

create or replace function public.sync_event_location_from_venue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v public.venues;
begin
  if new.venue_id is null then
    return new;
  end if;
  select * into v from public.venues where id = new.venue_id;
  if v.id is null then
    raise exception 'Selected venue does not exist';
  end if;
  if v.latitude is null or v.longitude is null then
    raise exception 'Selected venue must have a valid map location';
  end if;
  new.latitude := v.latitude;
  new.longitude := v.longitude;
  new.formatted_address := coalesce(v.formatted_address, v.address);
  new.state_region := v.state_region;
  new.country := v.country;
  new.provider_place_id := v.provider_place_id;
  new.location_metadata := coalesce(v.location_metadata, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists events_sync_venue_location on public.events;
create trigger events_sync_venue_location
before insert or update of venue_id on public.events
for each row execute function public.sync_event_location_from_venue();

-- Replace the legacy venue RPCs with coordinate-aware versions while retaining their existing argument order.
drop function if exists public.create_owned_venue(text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text);
create or replace function public.create_owned_venue(
  p_name text,p_city text,p_address text,p_capacity integer,p_description text,p_venue_type text,
  p_amenities jsonb,p_rules text,p_contact_phone text,p_image_urls jsonb,p_pricing jsonb,
  p_cancellation_policy text,p_latitude numeric,p_longitude numeric,p_formatted_address text,
  p_state_region text,p_country text,p_provider_place_id text,p_location_metadata jsonb
) returns public.venues
language plpgsql security definer set search_path = public as $$
declare v public.venues;
begin
  if auth.uid() is null or not public.has_any_app_role(array['VENUE_MANAGER'::public.app_role,'ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then raise exception 'Venue Manager role required'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_city),'') is null or coalesce(p_capacity,0) <= 0 then raise exception 'Venue name, city, and positive capacity are required'; end if;
  if p_latitude is null or p_longitude is null or (p_latitude = 0 and p_longitude = 0) or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'A valid physical map location is required'; end if;
  insert into public.venues(owner_id,name,city,address,capacity,description,venue_type,amenities,rules,contact_phone,image_urls,pricing,cancellation_policy,latitude,longitude,formatted_address,state_region,country,provider_place_id,location_metadata)
  values(auth.uid(),trim(p_name),trim(p_city),nullif(trim(p_address),''),p_capacity,nullif(trim(p_description),''),nullif(trim(p_venue_type),''),coalesce(p_amenities,'[]'::jsonb),nullif(trim(p_rules),''),nullif(trim(p_contact_phone),''),coalesce(p_image_urls,'[]'::jsonb),coalesce(p_pricing,'{}'::jsonb),nullif(trim(p_cancellation_policy),''),p_latitude,p_longitude,coalesce(nullif(trim(p_formatted_address),''),nullif(trim(p_address),'')),nullif(trim(p_state_region),''),nullif(trim(p_country),''),nullif(trim(p_provider_place_id),''),coalesce(p_location_metadata,'{}'::jsonb)) returning * into v;
  return v;
end; $$;
revoke all on function public.create_owned_venue(text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text,numeric,numeric,text,text,text,text,jsonb) from public;
grant execute on function public.create_owned_venue(text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text,numeric,numeric,text,text,text,text,jsonb) to authenticated;

-- Existing legacy update RPC is removed so callers cannot silently update a venue without coordinates.
drop function if exists public.update_owned_venue(uuid,text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text);
create or replace function public.update_owned_venue(
  p_venue_id uuid,p_name text,p_city text,p_address text,p_capacity integer,p_description text,p_venue_type text,
  p_amenities jsonb,p_rules text,p_contact_phone text,p_image_urls jsonb,p_pricing jsonb,
  p_cancellation_policy text,p_latitude numeric,p_longitude numeric,p_formatted_address text,
  p_state_region text,p_country text,p_provider_place_id text,p_location_metadata jsonb
) returns public.venues
language plpgsql security definer set search_path = public as $$
declare v public.venues;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.venues where id=p_venue_id and (owner_id=auth.uid() or public.has_any_app_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]))) then raise exception 'Not authorized for this venue'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_city),'') is null or coalesce(p_capacity,0) <= 0 then raise exception 'Venue name, city, and positive capacity are required'; end if;
  if p_latitude is null or p_longitude is null or (p_latitude = 0 and p_longitude = 0) or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'A valid physical map location is required'; end if;
  update public.venues set name=trim(p_name),city=trim(p_city),address=nullif(trim(p_address),''),capacity=p_capacity,description=nullif(trim(p_description),''),venue_type=nullif(trim(p_venue_type),''),amenities=coalesce(p_amenities,'[]'::jsonb),rules=nullif(trim(p_rules),''),contact_phone=nullif(trim(p_contact_phone),''),image_urls=coalesce(p_image_urls,'[]'::jsonb),pricing=coalesce(p_pricing,'{}'::jsonb),cancellation_policy=nullif(trim(p_cancellation_policy),''),latitude=p_latitude,longitude=p_longitude,formatted_address=coalesce(nullif(trim(p_formatted_address),''),nullif(trim(p_address),'')),state_region=nullif(trim(p_state_region),''),country=nullif(trim(p_country),''),provider_place_id=nullif(trim(p_provider_place_id),''),location_metadata=coalesce(p_location_metadata,'{}'::jsonb),updated_at=now() where id=p_venue_id returning * into v;
  update public.events set updated_at=now() where venue_id=p_venue_id;
  return v;
end; $$;
revoke all on function public.update_owned_venue(uuid,text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text,numeric,numeric,text,text,text,text,jsonb) from public;
grant execute on function public.update_owned_venue(uuid,text,text,text,integer,text,text,jsonb,text,text,jsonb,jsonb,text,numeric,numeric,text,text,text,text,jsonb) to authenticated;

comment on column public.venues.latitude is 'Canonical venue latitude; required for physical venue creation/publication.';
comment on column public.venues.longitude is 'Canonical venue longitude; required for physical venue creation/publication.';
comment on column public.events.latitude is 'Inherited from venue when venue_id is set; standalone events may provide their own location.';
comment on column public.events.longitude is 'Inherited from venue when venue_id is set; standalone events may provide their own location.';
