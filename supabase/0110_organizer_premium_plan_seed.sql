-- Organizer Premium is a separately configurable product from role verification.
-- It is seeded inactive so Super Admin must explicitly set its price and publish it.
insert into public.premium_plans(code,name,description,amount,currency,interval,interval_count,features,is_active)
select
  'ORGANIZER_PREMIUM',
  'Organizer Premium',
  'Premium organizer discovery placement and organizer features',
  0,
  'NGN',
  'MONTH',
  1,
  jsonb_build_object(
    'featured_events', true,
    'organizer_premium', true
  ),
  false
where not exists (
  select 1 from public.premium_plans where code='ORGANIZER_PREMIUM'
);

comment on column public.premium_plans.code is
  'Canonical plan identifier. ORGANIZER_PREMIUM is separate from role verification policies.';

-- Keep the existing governance RPC as the sole Super Admin configuration surface.
-- The existing create/update plan RPCs already audit changes and support amount,
-- currency, interval, features, and activation state.
