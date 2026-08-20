-- Atizzy dynamic business-policy control plane
-- Security remains code/RLS enforced; this table only controls whitelisted operational policy values.
create table if not exists public.policy_settings (
  key text primary key,
  value jsonb not null,
  value_type text not null check (value_type in ('boolean','number','string','enum')),
  description text not null,
  allowed_values jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.policy_settings enable row level security;

drop policy if exists "super admins view policy settings" on public.policy_settings;
create policy "super admins view policy settings" on public.policy_settings
  for select using (public.has_any_app_role(array['SUPER_ADMIN'::public.app_role]));

insert into public.policy_settings(key, value, value_type, description, allowed_values)
values
  ('artist_registration_enabled', 'true'::jsonb, 'boolean', 'Whether new Artist registration payments may be started.', 'null'::jsonb),
  ('artist_verification_required', 'true'::jsonb, 'boolean', 'Whether Artist verification remains required for the golden verified state.', 'null'::jsonb),
  ('artist_verification_approval_role', '"SUPER_ADMIN"'::jsonb, 'enum', 'The role allowed to approve Artist verification decisions.', '["SUPER_ADMIN"]'::jsonb),
  ('event_publish_requires_ticket_config', 'true'::jsonb, 'boolean', 'Whether an Organizer event must have ticket configuration before publishing.', 'null'::jsonb),
  ('venue_publish_requires_owner', 'true'::jsonb, 'boolean', 'Whether venue content publishing remains restricted to the owning Venue Manager.', 'null'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_policy_value(p_key text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select value from public.policy_settings where key = p_key;
$$;

create or replace function public.list_policy_settings()
returns setof public.policy_settings
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_any_app_role(array['SUPER_ADMIN'::public.app_role]) then
    raise exception 'Super Admin access is required';
  end if;
  return query select * from public.policy_settings order by key;
end;
$$;

create or replace function public.update_policy_setting(p_key text, p_value jsonb)
returns public.policy_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.policy_settings;
  v_updated public.policy_settings;
  v_type text;
  v_allowed jsonb;
begin
  if auth.uid() is null or not public.has_any_app_role(array['SUPER_ADMIN'::public.app_role]) then
    raise exception 'Super Admin access is required';
  end if;
  if p_key is null or p_value is null then raise exception 'Policy key and value are required'; end if;
  select * into v_previous from public.policy_settings where key = p_key for update;
  if v_previous.key is null then raise exception 'Unsupported policy setting'; end if;
  v_type := v_previous.value_type;
  v_allowed := v_previous.allowed_values;
  if v_type = 'boolean' and jsonb_typeof(p_value) <> 'boolean' then raise exception 'Policy value must be boolean'; end if;
  if v_type = 'number' and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric < 0) then raise exception 'Policy value must be a non-negative number'; end if;
  if v_type in ('string','enum') and jsonb_typeof(p_value) <> 'string' then raise exception 'Policy value must be text'; end if;
  if v_type = 'enum' and not (v_allowed @> jsonb_build_array(p_value #>> '{}')) then raise exception 'Policy value is not allowed'; end if;
  update public.policy_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key returning * into v_updated;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'policy_setting.updated', 'policy_setting', null,
    jsonb_build_object('key', p_key, 'previous_value', v_previous.value, 'new_value', p_value, 'value_type', v_type));
  return v_updated;
end;
$$;

revoke all on function public.get_policy_value(text) from public;
grant execute on function public.get_policy_value(text) to authenticated;
revoke all on function public.list_policy_settings() from public;
grant execute on function public.list_policy_settings() to authenticated;
revoke all on function public.update_policy_setting(text, jsonb) from public;
grant execute on function public.update_policy_setting(text, jsonb) to authenticated;

create or replace function public.initialize_artist_fee_payment(p_transaction_type text, p_idempotency_key text)
returns public.artist_fee_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_setting public.platform_settings;
  v_artist public.artists;
  v_existing public.artist_fee_transactions;
  v_transaction public.artist_fee_transactions;
  v_enabled boolean;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_transaction_type not in ('REGISTRATION','VERIFICATION') then raise exception 'Invalid artist transaction type'; end if;
  if coalesce(trim(p_idempotency_key), '') = '' then raise exception 'Idempotency key is required'; end if;
  select * into v_existing from public.artist_fee_transactions where idempotency_key = p_idempotency_key limit 1;
  if v_existing.id is not null then return v_existing; end if;
  v_enabled := coalesce((public.get_policy_value(case when p_transaction_type = 'REGISTRATION' then 'artist_registration_enabled' else 'artist_verification_required' end) #>> '{}')::boolean, true);
  if not v_enabled then raise exception 'This Artist workflow is currently disabled by platform policy'; end if;
  select * into v_setting from public.platform_settings where key = case when p_transaction_type = 'REGISTRATION' then 'artist_registration_fee' else 'artist_verification_fee' end for share;
  if v_setting.key is null then raise exception 'Artist fee is not configured'; end if;
  if p_transaction_type = 'REGISTRATION' then
    if exists (select 1 from public.artists where user_id = v_user) then raise exception 'Artist profile already exists'; end if;
    if exists (select 1 from public.artist_registrations where user_id = v_user and status in ('PENDING_PAYMENT','ACTIVATING','ACTIVE')) then raise exception 'Artist registration already exists'; end if;
  else
    select * into v_artist from public.artists where user_id = v_user limit 1;
    if v_artist.id is null then raise exception 'Artist profile is required before verification'; end if;
    if v_artist.verified then raise exception 'Artist is already verified'; end if;
    if exists (select 1 from public.artist_verifications where artist_id = v_artist.id and status in ('PENDING_PAYMENT','ACTIVATING','VERIFIED')) then raise exception 'Artist verification already exists'; end if;
  end if;
  insert into public.artist_fee_transactions(user_id, artist_id, transaction_type, amount, currency, idempotency_key, status)
  values (v_user, case when p_transaction_type = 'VERIFICATION' then v_artist.id else null end, p_transaction_type, v_setting.amount, v_setting.currency, p_idempotency_key, 'PROVIDER_PENDING')
  returning * into v_transaction;
  if p_transaction_type = 'REGISTRATION' then
    insert into public.artist_registrations(user_id, transaction_id, status, submitted_at)
    values (v_user, v_transaction.id, 'PENDING_PAYMENT', now())
    on conflict (user_id) do update set transaction_id = excluded.transaction_id, status = 'PENDING_PAYMENT', failure_reason = null, updated_at = now();
  else
    insert into public.artist_verifications(artist_id, user_id, transaction_id, status, requested_at)
    values (v_artist.id, v_user, v_transaction.id, 'PENDING_PAYMENT', now())
    on conflict (artist_id) do update set transaction_id = excluded.transaction_id, status = 'PENDING_PAYMENT', failure_reason = null, updated_at = now();
  end if;
  return v_transaction;
end;
$$;
revoke all on function public.initialize_artist_fee_payment(text,text) from public;
grant execute on function public.initialize_artist_fee_payment(text,text) to authenticated;
