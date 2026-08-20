-- Explicitly close anonymous execution on private-ticket RPCs.
-- The functions remain SECURITY DEFINER because they intentionally mediate
-- credential validation and organizer ownership checks server-side.
revoke execute on function public.create_organizer_ticket_type(uuid,text,numeric,integer,timestamptz,timestamptz,integer,text,text,text,text,text,integer,integer) from public, anon;
revoke execute on function public.discover_private_ticket(uuid,text,text) from public, anon;
revoke execute on function public.private_ticket_hash(text,text,text) from public, anon;
grant execute on function public.create_organizer_ticket_type(uuid,text,numeric,integer,timestamptz,timestamptz,integer,text,text,text,text,text,integer,integer) to authenticated;
grant execute on function public.discover_private_ticket(uuid,text,text) to authenticated;
