create or replace function public.toggle_artist_follow(p_artist_id uuid, p_follow boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  artist_row public.artists;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into artist_row from public.artists where id = p_artist_id;
  if artist_row.id is null then raise exception 'Artist not found'; end if;

  if p_follow then
    insert into public.artist_followers(user_id, artist_id)
    values (auth.uid(), p_artist_id)
    on conflict (user_id, artist_id) do nothing;
    update public.artists set follower_count = follower_count + 1
    where id = p_artist_id and not exists (
      select 1 from public.user_notifications n
      where n.user_id = auth.uid()
        and n.type = 'ARTIST'
        and n.metadata->>'artist_id' = p_artist_id::text
        and n.metadata->>'action' = 'FOLLOW'
    );
    insert into public.user_notifications(user_id, type, title, message, metadata)
    values (
      auth.uid(), 'ARTIST', 'Following ' || artist_row.name,
      'You will receive updates from this Artist.',
      jsonb_build_object('action','FOLLOW','artist_id',p_artist_id,'deep_link',jsonb_build_object('screen','artist','data',jsonb_build_object('id',p_artist_id)))
    );
  else
    delete from public.artist_followers where user_id = auth.uid() and artist_id = p_artist_id;
    update public.artists set follower_count = greatest(follower_count - 1, 0) where id = p_artist_id;
  end if;

  select jsonb_build_object('following', p_follow, 'artist_id', p_artist_id) into result;
  return result;
end; $$;

revoke all on function public.toggle_artist_follow(uuid,boolean) from public;
grant execute on function public.toggle_artist_follow(uuid,boolean) to authenticated;
