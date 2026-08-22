begin;

alter table public.venue_booking_payments
  add column if not exists authorization_url text,
  add column if not exists access_code text;

commit;

notify pgrst, 'reload schema';
