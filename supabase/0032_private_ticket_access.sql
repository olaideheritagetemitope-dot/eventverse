-- Atizzy private ticket access system
-- Private credentials are accepted only by security-definer RPCs and are never stored in plaintext.

create table if not exists public.private_ticket_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (user_id, ticket_type_id)
);

create table if not exists public.private_ticket_access_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_id uuid not null references public.events(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

alter table public.private_ticket_access_grants enable row level security;
alter table public.private_ticket_access_attempts enable row level security;

drop policy if exists "users view own private access grants" on public.private_ticket_access_grants;
create policy "users view own private access grants" on public.private_ticket_access_grants
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins view private access attempts" on public.private_ticket_access_attempts;
create policy "admins view private access attempts" on public.private_ticket_access_attempts
  for select using (public.is_admin());

alter table public.ticket_types
  add column if not exists visibility text not null default 'PUBLIC',
  add column if not exists access_method text,
  add column if not exists access_credential_hash text,
  add column if not exists access_credential_hint text,
  add column if not exists maximum_redemptions integer,
  add column if not exists redemptions integer not null default 0,
  add column if not exists maximum_purchases_per_user integer;

alter table public.ticket_types drop constraint if exists ticket_types_visibility_check;
alter table public.ticket_types add constraint ticket_types_visibility_check
  check (visibility in ('PUBLIC','PRIVATE'));
alter table public.ticket_types drop constraint if exists ticket_types_access_method_check;
alter table public.ticket_types add constraint ticket_types_access_method_check
  check (access_method is null or access_method in ('CODE','WORD','CODE_WORD'));
alter table public.ticket_types drop constraint if exists ticket_types_private_access_fields_check;
alter table public.ticket_types add constraint ticket_types_private_access_fields_check
  check (
    (visibility = 'PUBLIC' and access_method is null and access_credential_hash is null)
    or
    (visibility = 'PRIVATE' and access_method is not null and access_credential_hash is not null)
  );
alter table public.ticket_types drop constraint if exists ticket_types_redemption_limit_check;
alter table public.ticket_types add constraint ticket_types_redemption_limit_check
  check (maximum_redemptions is null or maximum_redemptions > 0);
alter table public.ticket_types drop constraint if exists ticket_types_redemptions_check;
alter table public.ticket_types add constraint ticket_types_redemptions_check
  check (redemptions >= 0 and (maximum_redemptions is null or redemptions <= maximum_redemptions));
alter table public.ticket_types drop constraint if exists ticket_types_purchase_limit_check;
alter table public.ticket_types add constraint ticket_types_purchase_limit_check
  check (maximum_purchases_per_user is null or maximum_purchases_per_user > 0);

drop policy if exists "published ticket types read" on public.ticket_types;
create policy "published public ticket types read" on public.ticket_types
  for select using (
    visibility = 'PUBLIC'
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED')
    )
  );

create index if not exists private_ticket_types_event_hash_idx
  on public.ticket_types(event_id, access_credential_hash)
  where visibility = 'PRIVATE';
create index if not exists private_ticket_attempts_window_idx
  on public.private_ticket_access_attempts(event_id, attempted_at);
create index if not exists private_ticket_grants_user_ticket_idx
  on public.private_ticket_access_grants(user_id, ticket_type_id, expires_at);

create or replace function public.private_ticket_hash(p_access_method text, p_code text default null, p_word text default null)
returns text
language plpgsql
immutable
security invoker
set search_path = public, extensions
as $$
declare
  v_value text;
begin
  if p_access_method = 'CODE' then
    v_value := upper(trim(coalesce(p_code, '')));
  elsif p_access_method = 'WORD' then
    v_value := upper(trim(coalesce(p_word, '')));
  elsif p_access_method = 'CODE_WORD' then
    v_value := upper(trim(coalesce(p_code, ''))) || '|' || upper(trim(coalesce(p_word, '')));
  else
    raise exception using errcode = '22023', message = 'Invalid private ticket access method';
  end if;
  if v_value = '' or v_value = '|' then
    raise exception using errcode = '22023', message = 'Private ticket access credential is required';
  end if;
  return encode(digest(v_value, 'sha256'), 'hex');
end;
$$;

create or replace function public.create_organizer_ticket_type(
  p_event_id uuid,
  p_name text,
  p_price numeric,
  p_capacity integer,
  p_sales_start timestamptz default null,
  p_sales_end timestamptz default null,
  p_maximum_per_customer integer default 4,
  p_visibility text default 'PUBLIC',
  p_access_method text default null,
  p_code text default null,
  p_word text default null,
  p_access_credential_hint text default null,
  p_maximum_redemptions integer default null,
  p_maximum_purchases_per_user integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ticket public.ticket_types;
  v_hash text := null;
  v_visibility text := upper(trim(coalesce(p_visibility, 'PUBLIC')));
  v_method text := nullif(upper(trim(coalesce(p_access_method, ''))), '');
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if not (public.is_admin() or exists(select 1 from public.events e where e.id = p_event_id and e.organizer_id = auth.uid())) then
    raise exception 'Event is not owned by the current Organizer';
  end if;
  if nullif(trim(p_name), '') is null or p_price is null or p_price < 0 or p_capacity is null or p_capacity < 1 then
    raise exception using errcode = '22023', message = 'Enter a valid ticket name, price, and capacity';
  end if;
  if v_visibility not in ('PUBLIC','PRIVATE') then raise exception using errcode = '22023', message = 'Invalid ticket visibility'; end if;
  if v_visibility = 'PRIVATE' then
    if v_method not in ('CODE','WORD','CODE_WORD') then raise exception using errcode = '22023', message = 'Private tickets require a valid access method'; end if;
    v_hash := public.private_ticket_hash(v_method, p_code, p_word);
  else
    v_method := null;
  end if;
  insert into public.ticket_types(name, event_id, price, capacity, sales_start, sales_end, maximum_per_customer, visibility, access_method, access_credential_hash, access_credential_hint, maximum_redemptions, maximum_purchases_per_user)
  values (trim(p_name), p_event_id, p_price, p_capacity, p_sales_start, p_sales_end, greatest(1, coalesce(p_maximum_per_customer, 4)), v_visibility, v_method, v_hash, nullif(trim(p_access_credential_hint), ''), p_maximum_redemptions, p_maximum_purchases_per_user)
  returning * into v_ticket;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'private_ticket.created', 'ticket_type', v_ticket.id, jsonb_build_object('event_id', p_event_id, 'visibility', v_visibility, 'access_method', v_method));
  return jsonb_build_object('id', v_ticket.id, 'event_id', v_ticket.event_id, 'name', v_ticket.name, 'price', v_ticket.price, 'capacity', v_ticket.capacity, 'sold', v_ticket.sold, 'reserved', v_ticket.reserved, 'sales_start', v_ticket.sales_start, 'sales_end', v_ticket.sales_end, 'maximum_per_customer', v_ticket.maximum_per_customer, 'visibility', v_ticket.visibility, 'access_method', v_ticket.access_method, 'access_credential_hint', v_ticket.access_credential_hint, 'maximum_redemptions', v_ticket.maximum_redemptions, 'redemptions', v_ticket.redemptions, 'maximum_purchases_per_user', v_ticket.maximum_purchases_per_user);
end;
$$;

create or replace function public.discover_private_ticket(
  p_event_id uuid,
  p_code text default null,
  p_word text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_hash text;
  v_ticket public.ticket_types;
  v_attempts integer;
  v_event_status public.event_status;
  v_existing_grant boolean := false;
begin
  if v_user is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  select status into v_event_status from public.events where id = p_event_id;
  if v_event_status is null or v_event_status not in ('PUBLISHED','SOLD_OUT','LIVE','COMPLETED') then raise exception using errcode = 'P0002', message = 'Event is not available'; end if;
  select count(*) into v_attempts from public.private_ticket_access_attempts where event_id = p_event_id and user_id = v_user and attempted_at > now() - interval '15 minutes';
  if v_attempts >= 10 then raise exception using errcode = 'P0001', message = 'Too many private ticket attempts. Try again later.'; end if;
  if p_code is null and p_word is null then raise exception using errcode = '22023', message = 'Enter the private ticket credential'; end if;
  for v_ticket in select * from public.ticket_types where event_id = p_event_id and visibility = 'PRIVATE' and (sales_start is null or sales_start <= now()) and (sales_end is null or sales_end >= now()) loop
    begin
      v_hash := public.private_ticket_hash(v_ticket.access_method, p_code, p_word);
    exception when others then
      v_hash := null;
    end;
    if v_hash is not null and v_hash = v_ticket.access_credential_hash then
      select exists(select 1 from public.private_ticket_access_grants g where g.user_id = v_user and g.ticket_type_id = v_ticket.id and g.expires_at > now()) into v_existing_grant;
      if v_existing_grant then
        insert into public.private_ticket_access_attempts(user_id, event_id, succeeded) values (v_user, p_event_id, true);
        return jsonb_build_object('id', v_ticket.id, 'event_id', v_ticket.event_id, 'name', v_ticket.name, 'price', v_ticket.price, 'capacity', v_ticket.capacity, 'sold', v_ticket.sold, 'reserved', v_ticket.reserved, 'sales_start', v_ticket.sales_start, 'sales_end', v_ticket.sales_end, 'maximum_per_customer', v_ticket.maximum_per_customer, 'visibility', v_ticket.visibility, 'access_method', v_ticket.access_method, 'access_credential_hint', v_ticket.access_credential_hint, 'maximum_redemptions', v_ticket.maximum_redemptions, 'redemptions', v_ticket.redemptions, 'maximum_purchases_per_user', v_ticket.maximum_purchases_per_user);
      end if;
      update public.ticket_types set redemptions = redemptions + 1 where id = v_ticket.id and (maximum_redemptions is null or redemptions < maximum_redemptions) returning * into v_ticket;
      if not found then continue; end if;
      insert into public.private_ticket_access_grants(user_id, ticket_type_id, expires_at) values (v_user, v_ticket.id, least(coalesce(v_ticket.sales_end, now() + interval '24 hours'), now() + interval '24 hours')) on conflict (user_id, ticket_type_id) do update set granted_at = now(), expires_at = excluded.expires_at;
      insert into public.private_ticket_access_attempts(user_id, event_id, succeeded) values (v_user, p_event_id, true);
      insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (v_user, 'private_ticket.access_granted', 'ticket_type', v_ticket.id, jsonb_build_object('event_id', p_event_id));
      return jsonb_build_object('id', v_ticket.id, 'event_id', v_ticket.event_id, 'name', v_ticket.name, 'price', v_ticket.price, 'capacity', v_ticket.capacity, 'sold', v_ticket.sold, 'reserved', v_ticket.reserved, 'sales_start', v_ticket.sales_start, 'sales_end', v_ticket.sales_end, 'maximum_per_customer', v_ticket.maximum_per_customer, 'visibility', v_ticket.visibility, 'access_method', v_ticket.access_method, 'access_credential_hint', v_ticket.access_credential_hint, 'maximum_redemptions', v_ticket.maximum_redemptions, 'redemptions', v_ticket.redemptions, 'maximum_purchases_per_user', v_ticket.maximum_purchases_per_user);
    end if;
  end loop;
  insert into public.private_ticket_access_attempts(user_id, event_id, succeeded) values (v_user, p_event_id, false);
  raise exception using errcode = 'P0002', message = 'No private ticket matched that credential';
end;
$$;

-- Replace direct organizer inserts with the server-authoritative RPC contract.
revoke all on function public.private_ticket_hash(text,text,text) from public;
revoke all on function public.create_organizer_ticket_type(uuid,text,numeric,integer,timestamptz,timestamptz,integer,text,text,text,text,text,integer,integer) from public;
grant execute on function public.create_organizer_ticket_type(uuid,text,numeric,integer,timestamptz,timestamptz,integer,text,text,text,text,text,integer,integer) to authenticated;
revoke all on function public.discover_private_ticket(uuid,text,text) from public;
grant execute on function public.discover_private_ticket(uuid,text,text) to authenticated;

-- Reservations for private tickets require a valid, unexpired server-issued access grant and enforce cumulative per-user purchase caps.
create or replace function public.reserve_event_tickets(p_event_id uuid, p_items jsonb, p_idempotency_key text, p_hold_minutes integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation_id uuid;
  v_order_id uuid;
  v_expires_at timestamptz;
  v_subtotal numeric(12,2) := 0;
  v_service_fee numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  item_row record;
  existing_reservation record;
  event_row record;
  v_existing_purchases integer;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if p_event_id is null or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception using errcode = '22023', message = 'At least one ticket item is required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then raise exception using errcode = '22023', message = 'A valid idempotency key is required'; end if;
  if p_hold_minutes < 1 or p_hold_minutes > 30 then raise exception using errcode = '22023', message = 'Hold duration must be between 1 and 30 minutes'; end if;
  perform public.release_expired_ticket_reservations();
  select id, status into event_row from public.events where id = p_event_id for update;
  if not found or event_row.status not in ('PUBLISHED','SOLD_OUT','LIVE') then raise exception using errcode = 'P0002', message = 'Event is not available for ticket reservation'; end if;
  select r.id, r.expires_at, r.status, o.id as order_id, o.subtotal, o.service_fee, o.total into existing_reservation from public.ticket_reservations r left join public.orders o on o.reservation_id = r.id where r.user_id = v_user_id and r.idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('reservation_id', existing_reservation.id, 'order_id', existing_reservation.order_id, 'status', existing_reservation.status, 'expires_at', existing_reservation.expires_at, 'subtotal', existing_reservation.subtotal, 'service_fee', existing_reservation.service_fee, 'total', existing_reservation.total, 'replayed', true); end if;
  v_expires_at := now() + make_interval(mins => p_hold_minutes);
  for item_row in select ticket_type_id, sum(quantity)::integer as quantity from jsonb_to_recordset(p_items) as items(ticket_type_id uuid, quantity integer) group by ticket_type_id loop
    if item_row.ticket_type_id is null or item_row.quantity is null or item_row.quantity <= 0 then raise exception using errcode = '22023', message = 'Ticket item quantities must be positive'; end if;
    select * into event_row from public.ticket_types where id = item_row.ticket_type_id and event_id = p_event_id and (sales_start is null or sales_start <= now()) and (sales_end is null or sales_end >= now()) and item_row.quantity <= maximum_per_customer for update;
    if not found then raise exception using errcode = 'P0002', message = 'Ticket type is unavailable or quantity exceeds the purchase limit'; end if;
    if event_row.visibility = 'PRIVATE' then
      if not exists(select 1 from public.private_ticket_access_grants g where g.user_id = v_user_id and g.ticket_type_id = event_row.id and g.expires_at > now()) then raise exception using errcode = '42501', message = 'Private ticket access is required'; end if;
      select count(*) into v_existing_purchases from public.tickets t join public.orders o on o.id = t.order_id where t.owner_id = v_user_id and t.ticket_type_id = event_row.id and t.status <> 'CANCELLED';
      if event_row.maximum_purchases_per_user is not null and v_existing_purchases + item_row.quantity > event_row.maximum_purchases_per_user then raise exception using errcode = 'P0001', message = 'Private ticket purchase limit reached'; end if;
    end if;
    update public.ticket_types set reserved = reserved + item_row.quantity where id = item_row.ticket_type_id and sold + reserved + item_row.quantity <= capacity;
    if not found then raise exception using errcode = 'P0001', message = 'Not enough tickets available'; end if;
    select v_subtotal + (price * item_row.quantity) into v_subtotal from public.ticket_types where id = item_row.ticket_type_id;
  end loop;
  v_service_fee := round(v_subtotal * 0.05, 2);
  v_total := v_subtotal + v_service_fee;
  insert into public.ticket_reservations(user_id, event_id, status, expires_at, idempotency_key) values (v_user_id, p_event_id, 'ACTIVE', v_expires_at, p_idempotency_key) returning id into v_reservation_id;
  insert into public.reservation_items(reservation_id, ticket_type_id, quantity, unit_price) select v_reservation_id, ticket_type_id, sum(quantity)::integer, tt.price from jsonb_to_recordset(p_items) as items(ticket_type_id uuid, quantity integer) join public.ticket_types tt on tt.id = items.ticket_type_id group by ticket_type_id, tt.price;
  insert into public.orders(user_id, reservation_id, status, subtotal, service_fee, total) values (v_user_id, v_reservation_id, 'RESERVED', v_subtotal, v_service_fee, v_total) returning id into v_order_id;
  insert into public.order_items(order_id, ticket_type_id, quantity, unit_price) select v_order_id, ticket_type_id, sum(quantity)::integer, tt.price from jsonb_to_recordset(p_items) as items(ticket_type_id uuid, quantity integer) join public.ticket_types tt on tt.id = items.ticket_type_id group by ticket_type_id, tt.price;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (v_user_id, 'TICKET_RESERVATION_CREATED', 'ticket_reservation', v_reservation_id, jsonb_build_object('event_id', p_event_id, 'order_id', v_order_id, 'total', v_total));
  return jsonb_build_object('reservation_id', v_reservation_id, 'order_id', v_order_id, 'status', 'ACTIVE', 'expires_at', v_expires_at, 'subtotal', v_subtotal, 'service_fee', v_service_fee, 'total', v_total, 'replayed', false);
exception when unique_violation then
  select r.id, r.expires_at, r.status, o.id as order_id, o.subtotal, o.service_fee, o.total into existing_reservation from public.ticket_reservations r left join public.orders o on o.reservation_id = r.id where r.user_id = v_user_id and r.idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('reservation_id', existing_reservation.id, 'order_id', existing_reservation.order_id, 'status', existing_reservation.status, 'expires_at', existing_reservation.expires_at, 'subtotal', existing_reservation.subtotal, 'service_fee', existing_reservation.service_fee, 'total', existing_reservation.total, 'replayed', true); end if;
  raise;
end;
$$;

revoke all on function public.reserve_event_tickets(uuid,jsonb,text,integer) from public;
grant execute on function public.reserve_event_tickets(uuid,jsonb,text,integer) to authenticated;
