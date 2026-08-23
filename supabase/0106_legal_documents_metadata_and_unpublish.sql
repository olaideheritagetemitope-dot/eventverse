-- Complete the legal CMS lifecycle without replacing historical versions.
alter table public.legal_documents add column if not exists published_by uuid references auth.users(id);

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
  update public.legal_documents set status='PUBLISHED', published_at=now(), published_by=auth.uid(), effective_date=coalesce(effective_date,current_date), updated_at=now(), updated_by=auth.uid()
    where id=p_id returning * into v_doc;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'LEGAL_DOCUMENT_PUBLISHED','legal_documents',v_doc.id,jsonb_build_object('document_type',v_doc.document_type,'version',v_doc.version));
  return v_doc;
end;
$$;
revoke all on function public.admin_publish_legal_document(uuid) from public, anon, authenticated;
grant execute on function public.admin_publish_legal_document(uuid) to authenticated;

create or replace function public.admin_unpublish_legal_document(p_id uuid)
returns public.legal_documents
language plpgsql
security definer
set search_path = public
as $$
declare v_doc public.legal_documents;
begin
  if not public.has_any_app_role(array['SUPER_ADMIN']::public.app_role[]) then raise exception 'Super Admin access required'; end if;
  update public.legal_documents set status='ARCHIVED', updated_at=now(), updated_by=auth.uid()
    where id=p_id and status='PUBLISHED' returning * into v_doc;
  if v_doc.id is null then raise exception 'Only the published document can be unpublished'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'LEGAL_DOCUMENT_UNPUBLISHED','legal_documents',v_doc.id,jsonb_build_object('document_type',v_doc.document_type,'version',v_doc.version));
  return v_doc;
end;
$$;
revoke all on function public.admin_unpublish_legal_document(uuid) from public, anon, authenticated;
grant execute on function public.admin_unpublish_legal_document(uuid) to authenticated;
