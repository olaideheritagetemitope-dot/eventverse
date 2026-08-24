-- Backward-compatible venue creation overload for clients deployed before 0117.
-- It delegates to the canonical coordinate-aware function and intentionally
-- requires the caller to supply no fake coordinates: legacy callers receive a
-- clear location-required error until the TomTom picker is available.

create or replace function public.create_owned_venue(
  p_address text,
  p_amenities jsonb,
  p_cancellation_policy text,
  p_capacity integer,
  p_city text,
  p_contact_phone text,
  p_description text,
  p_image_urls jsonb,
  p_name text,
  p_pricing jsonb,
  p_rules text,
  p_venue_type text
) returns public.venues
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'A confirmed TomTom map location is required before creating a venue';
end;
$$;

revoke all on function public.create_owned_venue(text,jsonb,text,integer,text,text,text,jsonb,text,jsonb,text,text) from public;
grant execute on function public.create_owned_venue(text,jsonb,text,integer,text,text,text,jsonb,text,jsonb,text,text) to authenticated;
