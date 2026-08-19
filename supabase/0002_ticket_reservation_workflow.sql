begin;

-- Commerce tables are client-visible only through tightly scoped policies/RPCs.
alter table public.ticket_reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

create policy "users view own reservations"
on public.ticket_reservations for select
using (auth.uid() = user_id);

create policy "users view own reservation items"
on public.reservation_items for select
using (exists (
  select 1 from public.ticket_reservations r
  where r.id = reservation_id and r.user_id = auth.uid()
));

create policy "users view own order items"
on public.order_items for select
using (exists (
  select 1 from public.orders o
  where o.id = order_id and o.user_id = auth.uid()
));

create policy "users view own payments"
on public.payments for select
using (exists (
  select 1 from public.orders o
  where o.id = order_id and o.user_id = auth.uid()
));

create or replace function public.release_expired_ticket_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer := 0;
  reservation_row record;
begin
  for reservation_row in
    select id
    from public.ticket_reservations
    where status = 'ACTIVE'
      and expires_at <= now()
    for update skip locked
  loop
    update public.ticket_types tt
    set reserved = reserved - ri.quantity
    from public.reservation_items ri
    where ri.reservation_id = reservation_row.id
      and tt.id = ri.ticket_type_id;

    update public.ticket_reservations
    set status = 'EXPIRED'
    where id = reservation_row.id;

    released_count := released_count + 1;
  end loop;

  return released_count;
end;
$$;

create or replace function public.reserve_event_tickets(
  p_event_id uuid,
  p_items jsonb,
  p_idempotency_key text,
  p_hold_minutes integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_event_id is null or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'At least one ticket item is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception using errcode = '22023', message = 'A valid idempotency key is required';
  end if;

  if p_hold_minutes < 1 or p_hold_minutes > 30 then
    raise exception using errcode = '22023', message = 'Hold duration must be between 1 and 30 minutes';
  end if;

  perform public.release_expired_ticket_reservations();

  select id, status into event_row
  from public.events
  where id = p_event_id
  for update;

  if not found or event_row.status not in ('PUBLISHED','SOLD_OUT','LIVE') then
    raise exception using errcode = 'P0002', message = 'Event is not available for ticket reservation';
  end if;

  select r.id, r.expires_at, r.status, o.id as order_id, o.subtotal, o.service_fee, o.total
  into existing_reservation
  from public.ticket_reservations r
  left join public.orders o on o.reservation_id = r.id
  where r.user_id = v_user_id
    and r.idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'reservation_id', existing_reservation.id,
      'order_id', existing_reservation.order_id,
      'status', existing_reservation.status,
      'expires_at', existing_reservation.expires_at,
      'subtotal', existing_reservation.subtotal,
      'service_fee', existing_reservation.service_fee,
      'total', existing_reservation.total,
      'replayed', true
    );
  end if;

  v_expires_at := now() + make_interval(mins => p_hold_minutes);

  for item_row in
    select ticket_type_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as items(ticket_type_id uuid, quantity integer)
    group by ticket_type_id
  loop
    if item_row.ticket_type_id is null or item_row.quantity is null or item_row.quantity <= 0 then
      raise exception using errcode = '22023', message = 'Ticket item quantities must be positive';
    end if;

    perform 1
    from public.ticket_types tt
    where tt.id = item_row.ticket_type_id
      and tt.event_id = p_event_id
      and (tt.sales_start is null or tt.sales_start <= now())
      and (tt.sales_end is null or tt.sales_end >= now())
      and item_row.quantity <= tt.maximum_per_customer
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'Ticket type is unavailable or quantity exceeds the purchase limit';
    end if;

    update public.ticket_types tt
    set reserved = reserved + item_row.quantity
    where tt.id = item_row.ticket_type_id
      and tt.sold + tt.reserved + item_row.quantity <= tt.capacity;

    if not found then
      raise exception using errcode = 'P0001', message = 'Not enough tickets available';
    end if;

    select v_subtotal + (tt.price * item_row.quantity)
    into v_subtotal
    from public.ticket_types tt
    where tt.id = item_row.ticket_type_id;
  end loop;

  v_service_fee := round(v_subtotal * 0.05, 2);
  v_total := v_subtotal + v_service_fee;

  insert into public.ticket_reservations(user_id, event_id, status, expires_at, idempotency_key)
  values (v_user_id, p_event_id, 'ACTIVE', v_expires_at, p_idempotency_key)
  returning id into v_reservation_id;

  insert into public.reservation_items(reservation_id, ticket_type_id, quantity, unit_price)
  select v_reservation_id, ticket_type_id, sum(quantity)::integer, tt.price
  from jsonb_to_recordset(p_items) as items(ticket_type_id uuid, quantity integer)
  join public.ticket_types tt on tt.id = items.ticket_type_id
  group by ticket_type_id, tt.price;

  insert into public.orders(user_id, reservation_id, status, subtotal, service_fee, total)
  values (v_user_id, v_reservation_id, 'RESERVED', v_subtotal, v_service_fee, v_total)
  returning id into v_order_id;

  insert into public.order_items(order_id, ticket_type_id, quantity, unit_price)
  select v_order_id, ticket_type_id, sum(quantity)::integer, tt.price
  from jsonb_to_recordset(p_items) as items(ticket_type_id uuid, quantity integer)
  join public.ticket_types tt on tt.id = items.ticket_type_id
  group by ticket_type_id, tt.price;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'TICKET_RESERVATION_CREATED', 'ticket_reservation', v_reservation_id,
    jsonb_build_object('event_id', p_event_id, 'order_id', v_order_id, 'total', v_total));

  return jsonb_build_object(
    'reservation_id', v_reservation_id,
    'order_id', v_order_id,
    'status', 'ACTIVE',
    'expires_at', v_expires_at,
    'subtotal', v_subtotal,
    'service_fee', v_service_fee,
    'total', v_total,
    'replayed', false
  );
exception
  when unique_violation then
    select r.id, r.expires_at, r.status, o.id as order_id, o.subtotal, o.service_fee, o.total
    into existing_reservation
    from public.ticket_reservations r
    left join public.orders o on o.reservation_id = r.id
    where r.user_id = v_user_id and r.idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'reservation_id', existing_reservation.id,
        'order_id', existing_reservation.order_id,
        'status', existing_reservation.status,
        'expires_at', existing_reservation.expires_at,
        'subtotal', existing_reservation.subtotal,
        'service_fee', existing_reservation.service_fee,
        'total', existing_reservation.total,
        'replayed', true
      );
    end if;
    raise;
end;
$$;

create or replace function public.cancel_ticket_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  reservation_row record;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select id, status into reservation_row
  from public.ticket_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Reservation not found';
  end if;

  if reservation_row.status <> 'ACTIVE' then
    return false;
  end if;

  update public.ticket_types tt
  set reserved = reserved - ri.quantity
  from public.reservation_items ri
  where ri.reservation_id = p_reservation_id
    and tt.id = ri.ticket_type_id;

  update public.ticket_reservations
  set status = 'CANCELLED'
  where id = p_reservation_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values (v_user_id, 'TICKET_RESERVATION_CANCELLED', 'ticket_reservation', p_reservation_id);

  return true;
end;
$$;

revoke all on function public.release_expired_ticket_reservations() from public, anon, authenticated;
revoke all on function public.reserve_event_tickets(uuid, jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.cancel_ticket_reservation(uuid) from public, anon, authenticated;
grant execute on function public.reserve_event_tickets(uuid, jsonb, text, integer) to authenticated;
grant execute on function public.cancel_ticket_reservation(uuid) to authenticated;

commit;
