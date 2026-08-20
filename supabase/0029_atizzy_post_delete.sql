-- Atizzy owner-scoped hard deletion for post CRUD completeness
create or replace function public.delete_post(p_post_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.posts
    where id = p_post_id
      and (author_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
  if not found then raise exception 'Post access denied'; end if;
  return true;
end;
$$;
grant execute on function public.delete_post(uuid) to authenticated;
