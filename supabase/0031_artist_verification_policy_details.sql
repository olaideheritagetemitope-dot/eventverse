-- Extend the dynamic policy registry with safe artist verification business rules.
-- These values are operational configuration only; authorization remains enforced by roles and RLS.
insert into public.policy_settings(key, value, value_type, description, allowed_values)
values
  ('artist_verification_required_fields', '["legal_name","identity_document","profile_photo","bio"]'::jsonb, 'string', 'JSON-encoded list of information required before Artist verification can be approved.', 'null'::jsonb),
  ('artist_verification_minimum_age', '18'::jsonb, 'number', 'Minimum age required for Artist verification.', 'null'::jsonb),
  ('artist_verification_requires_profile_photo', 'true'::jsonb, 'boolean', 'Whether an Artist profile photo is required before verification approval.', 'null'::jsonb)
on conflict (key) do nothing;

create or replace function public.can_approve_artist_verification()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
    and public.has_app_role(
      coalesce((public.get_policy_value('artist_verification_approval_role') #>> '{}')::public.app_role, 'SUPER_ADMIN'::public.app_role)
    );
$$;

revoke all on function public.can_approve_artist_verification() from public;
grant execute on function public.can_approve_artist_verification() to authenticated;
