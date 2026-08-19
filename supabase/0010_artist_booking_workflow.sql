-- Artist booking workflow: only the owning artist or an administrator may transition a request.
create or replace function public.artist_update_booking_status(
  p_booking_id uuid,
  p_status public.booking_status
)
returns public.artist_booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.artist_booking_requests;
  v_allowed boolean;
begin
  select * into v_booking
  from public.artist_booking_requests
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking request not found';
  end if;

  if not (
    exists (
      select 1 from public.artists a
      where a.id = v_booking.artist_id and a.user_id = auth.uid()
    )
    or public.has_any_app_role(array['ADMIN'::public.app_role, 'SUPER_ADMIN'::public.app_role])
  ) then
    raise exception 'Not authorized to update this booking';
  end if;

  v_allowed := case
    when v_booking.status in ('SUBMITTED','REVIEWING','NEGOTIATING') and p_status in ('REVIEWING','NEGOTIATING','ACCEPTED','REJECTED','CANCELLED') then true
    when v_booking.status = 'ACCEPTED' and p_status in ('CONFIRMED','CANCELLED') then true
    when v_booking.status = 'CONFIRMED' and p_status in ('COMPLETED','CANCELLED') then true
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid booking status transition from % to %', v_booking.status, p_status;
  end if;

  update public.artist_booking_requests
  set status = p_status, updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'artist.booking_status_updated', 'artist_booking_request', p_booking_id, jsonb_build_object('status', p_status));

  return v_booking;
end;
$$;

grant execute on function public.artist_update_booking_status(uuid, public.booking_status) to authenticated;
