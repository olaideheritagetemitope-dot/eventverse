-- Atizzy active publishing workflow: user-owned posts with live publication state.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  image_url text,
  music_id uuid references public.songs(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_author_status_idx on public.posts(author_id, status, updated_at desc);
create index if not exists posts_published_idx on public.posts(status, published_at desc);

alter table public.posts enable row level security;
drop policy if exists "posts public published read" on public.posts;
create policy "posts public published read" on public.posts for select using (status = 'PUBLISHED' or author_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
drop policy if exists "posts owner insert" on public.posts;
create policy "posts owner insert" on public.posts for insert with check (author_id = auth.uid());
drop policy if exists "posts owner update" on public.posts;
create policy "posts owner update" on public.posts for update using (author_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[])) with check (author_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
drop policy if exists "posts owner delete" on public.posts;
create policy "posts owner delete" on public.posts for delete using (author_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));

create or replace function public.create_post(p_caption text default '', p_image_url text default null, p_music_id uuid default null, p_event_id uuid default null, p_status text default 'DRAFT')
returns public.posts
language plpgsql security definer set search_path = public
as $$
declare result public.posts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(length(trim(p_caption)), 0) = 0 and p_image_url is null then raise exception 'Post caption or image is required'; end if;
  if p_status not in ('DRAFT','PUBLISHED') then raise exception 'Invalid post status'; end if;
  insert into public.posts(author_id, caption, image_url, music_id, event_id, status, published_at)
  values (auth.uid(), coalesce(trim(p_caption), ''), p_image_url, p_music_id, p_event_id, p_status, case when p_status = 'PUBLISHED' then now() else null end)
  returning * into result;
  return result;
end;
$$;

create or replace function public.update_post(p_post_id uuid, p_caption text, p_image_url text default null, p_music_id uuid default null, p_event_id uuid default null)
returns public.posts
language plpgsql security definer set search_path = public
as $$
declare result public.posts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.posts set caption = coalesce(trim(p_caption), ''), image_url = p_image_url, music_id = p_music_id, event_id = p_event_id, updated_at = now()
  where id = p_post_id and (author_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
  if not found then raise exception 'Post access denied'; end if;
  select * into result from public.posts where id = p_post_id;
  return result;
end;
$$;

create or replace function public.set_post_status(p_post_id uuid, p_status text)
returns public.posts
language plpgsql security definer set search_path = public
as $$
declare result public.posts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('DRAFT','PUBLISHED','ARCHIVED') then raise exception 'Invalid post status'; end if;
  update public.posts set status = p_status, published_at = case when p_status = 'PUBLISHED' then coalesce(published_at, now()) else published_at end, updated_at = now()
  where id = p_post_id and (author_id = auth.uid() or public.has_any_app_role(array['ADMIN','SUPER_ADMIN']::app_role[]));
  if not found then raise exception 'Post access denied'; end if;
  select * into result from public.posts where id = p_post_id;
  return result;
end;
$$;

grant execute on function public.create_post(text,text,uuid,uuid,text) to authenticated;
grant execute on function public.update_post(uuid,text,text,uuid,uuid) to authenticated;
grant execute on function public.set_post_status(uuid,text) to authenticated;
