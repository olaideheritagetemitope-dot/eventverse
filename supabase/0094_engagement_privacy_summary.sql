-- Preserve public engagement counts without exposing individual user activity.
-- The caller receives only aggregate values and their own like/rating state.

drop policy if exists likes_read on public.content_likes;
drop policy if exists ratings_read on public.content_ratings;

create or replace function public.get_content_engagement_summary(
  p_target_type text,
  p_target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_like_count integer;
  v_rating_count integer;
  v_average_rating numeric;
  v_liked boolean := false;
  v_user_rating smallint := null;
begin
  if nullif(trim(p_target_type), '') is null or p_target_id is null then
    return jsonb_build_object(
      'likeCount', 0,
      'ratingCount', 0,
      'averageRating', 0,
      'liked', false,
      'userRating', 0
    );
  end if;

  select count(*)::integer into v_like_count
  from public.content_likes
  where target_type = upper(trim(p_target_type))
    and target_id = p_target_id;

  select count(*)::integer, coalesce(avg(rating), 0)
    into v_rating_count, v_average_rating
  from public.content_ratings
  where target_type = upper(trim(p_target_type))
    and target_id = p_target_id;

  if v_user_id is not null then
    select exists(
      select 1 from public.content_likes
      where user_id = v_user_id
        and target_type = upper(trim(p_target_type))
        and target_id = p_target_id
    ) into v_liked;

    select rating into v_user_rating
    from public.content_ratings
    where user_id = v_user_id
      and target_type = upper(trim(p_target_type))
      and target_id = p_target_id
    limit 1;
  end if;

  return jsonb_build_object(
    'likeCount', coalesce(v_like_count, 0),
    'ratingCount', coalesce(v_rating_count, 0),
    'averageRating', coalesce(v_average_rating, 0),
    'liked', coalesce(v_liked, false),
    'userRating', coalesce(v_user_rating, 0)
  );
end;
$$;

revoke all on function public.get_content_engagement_summary(text, uuid) from public;
grant execute on function public.get_content_engagement_summary(text, uuid) to anon, authenticated;

create policy likes_self_read on public.content_likes
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

create policy ratings_self_read on public.content_ratings
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());
