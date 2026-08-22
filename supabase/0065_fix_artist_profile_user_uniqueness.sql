-- 0065: Align Artist profile UPSERT with the real live schema.
-- The Super Admin role RPC provisions Artist profiles with ON CONFLICT (user_id).
-- The live artists table had no unique key on user_id, so PostgreSQL rejected that
-- valid UPSERT target even though user_id is the one-profile-per-account relation.

create unique index if not exists artists_user_id_key
  on public.artists (user_id);

comment on index public.artists_user_id_key is
  'One Artist profile per authenticated user; required by Super Admin role provisioning UPSERT';

notify pgrst, 'reload schema';
