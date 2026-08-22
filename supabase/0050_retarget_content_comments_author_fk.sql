begin;

-- The original constraint name may already exist while incorrectly targeting auth.users.
-- Validate all existing comments before retargeting to public.user_profiles.
do $$
declare
  orphan_count bigint;
  target_table_name text;
  target_schema_name text;
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
    raise exception 'Cannot retarget content_comments_author_id_fkey: % orphaned author_id values exist', orphan_count;
  end if;

  select refnsp.nspname, refrel.relname
    into target_schema_name, target_table_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class refrel on refrel.oid = con.confrelid
    join pg_namespace refnsp on refnsp.oid = refrel.relnamespace
   where con.conname = 'content_comments_author_id_fkey'
     and nsp.nspname = 'public'
     and rel.relname = 'content_comments'
     and con.contype = 'f'
   limit 1;

  if target_schema_name is not null
     and (target_schema_name <> 'public' or target_table_name <> 'user_profiles') then
    alter table public.content_comments drop constraint content_comments_author_id_fkey;
    target_schema_name := null;
  end if;

  if target_schema_name is null then
    alter table public.content_comments
      add constraint content_comments_author_id_fkey
      foreign key (author_id)
      references public.user_profiles(id)
      on delete cascade;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
