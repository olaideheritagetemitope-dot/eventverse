-- Premium ticket-release enforcement and creator controls.
-- Extends the existing private/public ticket system; no roles or data are removed.

create or replace function public.update_ticket_release_policy(
  p_ticket_type_id uuid,
  p_premium_early_access_starts_at timestamptz default null,
  p_public_release_at timestamptz default null,
  p_premium_only boolean default false
)
returns public.ticket_types
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ticket public.ticket_types;
  v_event_owner uuid;
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  select e.organizer_id into v_event_owner from public.ticket_types t join public.events e on e.id=t.event_id where t.id=p_ticket_type_id;
  if not found then raise exception using errcode = 'P0002', message = 'Ticket type not found'; end if;
  if not (public.is_admin() or v_event_owner = auth.uid()) then raise exception using errcode = '42501', message = 'Ticket release policy access denied'; end if;
  if p_premium_early_access_starts_at is not null and p_public_release_at is not null and p_premium_early_access_starts_at > p_public_release_at then
    raise exception using errcode = '22023', message = 'Premium early access cannot start after public release';
  end if;
  update public.ticket_types
  set premium_early_access_starts_at=p_premium_early_access_starts_at,
      public_release_at=p_public_release_at,
      premium_only=coalesce(p_premium_only,false)
  where id=p_ticket_type_id
  returning * into v_ticket;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'ticket.release_policy.updated', 'ticket_type', p_ticket_type_id,
          jsonb_build_object('premium_early_access_starts_at',p_premium_early_access_starts_at,'public_release_at',p_public_release_at,'premium_only',coalesce(p_premium_only,false)));
  return v_ticket;
end;
$$;

create or replace function public.reserve_event_tickets(p_event_id uuid, p_items jsonb, p_idempotency_key text, p_hold_minutes integer default 10)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid := auth.uid(); v_reservation_id uuid; v_order_id uuid; v_expires_at timestamptz;
  v_subtotal numeric(12,2) := 0; v_service_fee numeric(12,2) := 0; v_total numeric(12,2) := 0;
  item_row record; existing_reservation record; event_row record; v_existing_purchases integer;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  if p_event_id is null or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception using errcode = '22023', message = 'At least one ticket item is required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then raise exception using errcode = '22023', message = 'A valid idempotency key is required'; end if;
  if p_hold_minutes < 1 or p_hold_minutes > 30 then raise exception using errcode = '22023', message = 'Hold duration must be between 1 and 30 minutes'; end if;
  perform public.release_expired_ticket_reservations();
  select id,status into event_row from public.events where id=p_event_id for update;
  if not found or event_row.status not in ('PUBLISHED','SOLD_OUT','LIVE') then raise exception using errcode = 'P0002', message = 'Event is not available for ticket reservation'; end if;
  select r.id,r.expires_at,r.status,o.id as order_id,o.subtotal,o.service_fee,o.total into existing_reservation from public.ticket_reservations r left join public.orders o on o.reservation_id=r.id where r.user_id=v_user_id and r.idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('reservation_id',existing_reservation.id,'order_id',existing_reservation.order_id,'status',existing_reservation.status,'expires_at',existing_reservation.expires_at,'subtotal',existing_reservation.subtotal,'service_fee',existing_reservation.service_fee,'total',existing_reservation.total,'replayed',true); end if;
  v_expires_at := now() + make_interval(mins => p_hold_minutes);
  for item_row in select ticket_type_id,sum(quantity)::integer as quantity from jsonb_to_recordset(p_items) as items(ticket_type_id uuid,quantity integer) group by ticket_type_id loop
    if item_row.ticket_type_id is null or item_row.quantity is null or item_row.quantity <= 0 then raise exception using errcode = '22023', message = 'Ticket item quantities must be positive'; end if;
    select * into event_row from public.ticket_types where id=item_row.ticket_type_id and event_id=p_event_id and (sales_start is null or sales_start <= now()) and (sales_end is null or sales_end >= now()) and item_row.quantity <= maximum_per_customer for update;
    if not found then raise exception using errcode = 'P0002', message = 'Ticket type is unavailable or quantity exceeds the purchase limit'; end if;
    if not public.can_access_ticket_type(event_row.id,v_user_id) then raise exception using errcode = '42501', message = 'This ticket is not available for your plan or release window'; end if;
    if event_row.visibility='PRIVATE' then
      if not exists(select 1 from public.private_ticket_access_grants g where g.user_id=v_user_id and g.ticket_type_id=event_row.id and g.expires_at>now()) then raise exception using errcode = '42501', message = 'Private ticket access is required'; end if;
      select count(*) into v_existing_purchases from public.tickets t join public.orders o on o.id=t.order_id where t.owner_id=v_user_id and t.ticket_type_id=event_row.id and t.status <> 'CANCELLED';
      if event_row.maximum_purchases_per_user is not null and v_existing_purchases + item_row.quantity > event_row.maximum_purchases_per_user then raise exception using errcode = 'P0001', message = 'Private ticket purchase limit reached'; end if;
    end if;
    update public.ticket_types set reserved=reserved+item_row.quantity where id=item_row.ticket_type_id and sold+reserved+item_row.quantity <= capacity;
    if not found then raise exception using errcode = 'P0001', message = 'Not enough tickets available'; end if;
    select v_subtotal + (price * item_row.quantity) into v_subtotal from public.ticket_types where id=item_row.ticket_type_id;
  end loop;
  v_service_fee := round(v_subtotal*0.05,2); v_total := v_subtotal+v_service_fee;
  insert into public.ticket_reservations(user_id,event_id,status,expires_at,idempotency_key) values(v_user_id,p_event_id,'ACTIVE',v_expires_at,p_idempotency_key) returning id into v_reservation_id;
  insert into public.reservation_items(reservation_id,ticket_type_id,quantity,unit_price) select v_reservation_id,ticket_type_id,sum(quantity)::integer,tt.price from jsonb_to_recordset(p_items) as items(ticket_type_id uuid,quantity integer) join public.ticket_types tt on tt.id=items.ticket_type_id group by ticket_type_id,tt.price;
  insert into public.orders(user_id,reservation_id,status,subtotal,service_fee,total) values(v_user_id,v_reservation_id,'RESERVED',v_subtotal,v_service_fee,v_total) returning id into v_order_id;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price) select v_order_id,ticket_type_id,sum(quantity)::integer,tt.price from jsonb_to_recordset(p_items) as items(ticket_type_id uuid,quantity integer) join public.ticket_types tt on tt.id=items.ticket_type_id group by ticket_type_id,tt.price;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_user_id,'TICKET_RESERVATION_CREATED','ticket_reservation',v_reservation_id,jsonb_build_object('event_id',p_event_id,'order_id',v_order_id,'total',v_total));
  return jsonb_build_object('reservation_id',v_reservation_id,'order_id',v_order_id,'status','ACTIVE','expires_at',v_expires_at,'subtotal',v_subtotal,'service_fee',v_service_fee,'total',v_total,'replayed',false);
exception when unique_violation then
  select r.id,r.expires_at,r.status,o.id as order_id,o.subtotal,o.service_fee,o.total into existing_reservation from public.ticket_reservations r left join public.orders o on o.reservation_id=r.id where r.user_id=v_user_id and r.idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('reservation_id',existing_reservation.id,'order_id',existing_reservation.order_id,'status',existing_reservation.status,'expires_at',existing_reservation.expires_at,'subtotal',existing_reservation.subtotal,'service_fee',existing_reservation.service_fee,'total',existing_reservation.total,'replayed',true); end if;
  raise;
end; $$;

grant execute on function public.update_ticket_release_policy(uuid,timestamptz,timestamptz,boolean) to authenticated;
revoke all on function public.reserve_event_tickets(uuid,jsonb,text,integer) from public;
grant execute on function public.reserve_event_tickets(uuid,jsonb,text,integer) to authenticated;
notify pgrst,'reload schema';
