-- Canonical versioned legal documents CMS for Atizzy.
-- Legal content is stored as structured JSONB and is never hard-coded in the client.
create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('PRIVACY_POLICY','TERMS_AND_CONDITIONS')),
  title text not null,
  intro text not null default '',
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  version text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  effective_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index if not exists legal_documents_one_published_per_type
  on public.legal_documents(document_type) where status = 'PUBLISHED';
create index if not exists legal_documents_type_status_created_idx
  on public.legal_documents(document_type, status, created_at desc);

create table if not exists public.legal_document_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('PRIVACY_POLICY','TERMS_AND_CONDITIONS')),
  document_id uuid not null references public.legal_documents(id),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  unique(user_id, document_type, document_id)
);
create index if not exists legal_document_consents_user_type_idx
  on public.legal_document_consents(user_id, document_type, accepted_at desc);

alter table public.legal_documents enable row level security;
alter table public.legal_document_consents enable row level security;

drop policy if exists legal_documents_public_published_read on public.legal_documents;
create policy legal_documents_public_published_read on public.legal_documents
  for select using (status = 'PUBLISHED' or public.has_any_app_role(array['SUPER_ADMIN']::public.app_role[]));

drop policy if exists legal_consents_owner_read on public.legal_document_consents;
create policy legal_consents_owner_read on public.legal_document_consents
  for select using (user_id = auth.uid() or public.has_any_app_role(array['SUPER_ADMIN']::public.app_role[]));

drop policy if exists legal_consents_owner_insert on public.legal_document_consents;
create policy legal_consents_owner_insert on public.legal_document_consents
  for insert with check (user_id = auth.uid());

create or replace function public.list_published_legal_document(p_document_type text)
returns public.legal_documents
language sql
security definer
set search_path = public
as $$
  select d.* from public.legal_documents d
  where d.document_type = p_document_type and d.status = 'PUBLISHED'
  order by d.published_at desc nulls last, d.updated_at desc
  limit 1;
$$;
revoke all on function public.list_published_legal_document(text) from public, anon;
grant execute on function public.list_published_legal_document(text) to anon, authenticated;

create or replace function public.admin_list_legal_documents()
returns setof public.legal_documents
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_app_role(array['SUPER_ADMIN']::public.app_role[]) then raise exception 'Super Admin access required'; end if;
  return query select d.* from public.legal_documents d order by d.document_type, d.created_at desc;
end;
$$;
revoke all on function public.admin_list_legal_documents() from public, anon, authenticated;
grant execute on function public.admin_list_legal_documents() to authenticated;

create or replace function public.admin_save_legal_document(
  p_id uuid,
  p_document_type text,
  p_title text,
  p_intro text,
  p_sections jsonb,
  p_version text,
  p_effective_date date
)
returns public.legal_documents
language plpgsql
security definer
set search_path = public
as $$
declare v_doc public.legal_documents;
begin
  if not public.has_any_app_role(array['SUPER_ADMIN']::public.app_role[]) then raise exception 'Super Admin access required'; end if;
  if p_document_type not in ('PRIVACY_POLICY','TERMS_AND_CONDITIONS') then raise exception 'Invalid legal document type'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Title is required'; end if;
  if jsonb_typeof(coalesce(p_sections, '[]'::jsonb)) <> 'array' then raise exception 'Sections must be a JSON array'; end if;
  if p_id is null then
    insert into public.legal_documents(document_type,title,intro,sections,version,effective_date,created_by,updated_by)
    values(p_document_type,trim(p_title),coalesce(p_intro,''),coalesce(p_sections,'[]'::jsonb),trim(p_version),p_effective_date,auth.uid(),auth.uid())
    returning * into v_doc;
  else
    update public.legal_documents
    set document_type=p_document_type,title=trim(p_title),intro=coalesce(p_intro,''),sections=coalesce(p_sections,'[]'::jsonb),version=trim(p_version),effective_date=p_effective_date,updated_by=auth.uid(),updated_at=now()
    where id=p_id and status='DRAFT'
    returning * into v_doc;
    if v_doc.id is null then raise exception 'Only draft legal documents can be edited'; end if;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'LEGAL_DOCUMENT_SAVED','legal_documents',v_doc.id,jsonb_build_object('document_type',v_doc.document_type,'version',v_doc.version));
  return v_doc;
end;
$$;
revoke all on function public.admin_save_legal_document(uuid,text,text,text,jsonb,text,date) from public, anon, authenticated;
grant execute on function public.admin_save_legal_document(uuid,text,text,text,jsonb,text,date) to authenticated;

create or replace function public.admin_publish_legal_document(p_id uuid)
returns public.legal_documents
language plpgsql
security definer
set search_path = public
as $$
declare v_doc public.legal_documents;
begin
  if not public.has_any_app_role(array['SUPER_ADMIN']::public.app_role[]) then raise exception 'Super Admin access required'; end if;
  select * into v_doc from public.legal_documents where id=p_id for update;
  if v_doc.id is null then raise exception 'Legal document not found'; end if;
  update public.legal_documents set status='ARCHIVED', updated_at=now(), updated_by=auth.uid()
  where document_type=v_doc.document_type and status='PUBLISHED' and id<>p_id;
  update public.legal_documents set status='PUBLISHED', published_at=now(), effective_date=coalesce(effective_date,current_date), updated_at=now(), updated_by=auth.uid()
  where id=p_id returning * into v_doc;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'LEGAL_DOCUMENT_PUBLISHED','legal_documents',v_doc.id,jsonb_build_object('document_type',v_doc.document_type,'version',v_doc.version));
  return v_doc;
end;
$$;
revoke all on function public.admin_publish_legal_document(uuid) from public, anon, authenticated;
grant execute on function public.admin_publish_legal_document(uuid) to authenticated;

create or replace function public.admin_restore_legal_document(p_id uuid)
returns public.legal_documents
language plpgsql
security definer
set search_path = public
as $$
declare v_source public.legal_documents; v_doc public.legal_documents;
begin
  if not public.has_any_app_role(array['SUPER_ADMIN']::public.app_role[]) then raise exception 'Super Admin access required'; end if;
  select * into v_source from public.legal_documents where id=p_id;
  if v_source.id is null then raise exception 'Legal document not found'; end if;
  insert into public.legal_documents(document_type,title,intro,sections,version,status,effective_date,created_by,updated_by)
  values(v_source.document_type,v_source.title,v_source.intro,v_source.sections,v_source.version || '-restored-' || to_char(now(),'YYYYMMDDHH24MISS'),'DRAFT',v_source.effective_date,auth.uid(),auth.uid())
  returning * into v_doc;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'LEGAL_DOCUMENT_RESTORED','legal_documents',v_doc.id,jsonb_build_object('source_id',p_id,'source_version',v_source.version));
  return v_doc;
end;
$$;
revoke all on function public.admin_restore_legal_document(uuid) from public, anon, authenticated;
grant execute on function public.admin_restore_legal_document(uuid) to authenticated;

create or replace function public.accept_published_legal_document(p_document_type text)
returns public.legal_document_consents
language plpgsql
security definer
set search_path = public
as $$
declare v_doc public.legal_documents; v_consent public.legal_document_consents;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_doc from public.legal_documents where document_type=p_document_type and status='PUBLISHED' order by published_at desc nulls last limit 1;
  if v_doc.id is null then raise exception 'No published legal document available'; end if;
  insert into public.legal_document_consents(user_id,document_type,document_id,document_version)
  values(auth.uid(),v_doc.document_type,v_doc.id,v_doc.version)
  on conflict(user_id,document_type,document_id) do update set accepted_at=now(),document_version=excluded.document_version
  returning * into v_consent;
  return v_consent;
end;
$$;
revoke all on function public.accept_published_legal_document(text) from public, anon;
grant execute on function public.accept_published_legal_document(text) to authenticated;
