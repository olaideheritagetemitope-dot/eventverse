begin;

-- Root-cause fix for PostgREST relationship discovery:
-- content_comments.author_id must reference the public profile row used by the UI.
-- Fail before changing schema if existing comments would become orphaned.
do $$
declare
  orphan_count bigint;
  constraint_exists boolean;
begin
  select count(*)
    into orphan_count
    from public.content_comments c
   where not exists (
     select 1
       from public.user_profiles p
      where p.id = c.author_id
   );

  if orphan_count > 0 then
    raise exception 'Cannot add content_comments_author_id_fkey: % orphaned author_id values exist', orphan_count;
  end if;

  select exists (
    select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where con.conname = 'content_comments_author_id_fkey'
       and nsp.nspname = 'public'
       and rel.relname = 'content_comments'
  ) into constraint_exists;

  if not constraint_exists then
    alter table public.content_comments
      add constraint content_comments_author_id_fkey
      foreign key (author_id)
      references public.user_profiles(id)
      on delete cascade;
  end if;
end $$;

-- Ask PostgREST to reload relationship metadata after the DDL change.
notify pgrst, 'reload schema';

commit;
