begin;

create table if not exists public.role_onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  role_code text not null check (role_code in ('ARTIST','ORGANIZER','VENUE_MANAGER')),
  prompt text not null,
  question_type text not null check (question_type in ('SHORT_TEXT','LONG_TEXT','MULTIPLE_CHOICE','BOOLEAN','NUMBER','DATE','FILE','URL')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null check (role_code in ('ARTIST','ORGANIZER','VENUE_MANAGER')),
  status text not null default 'DRAFT' check (status in ('DRAFT','PENDING_PAYMENT','PENDING_REVIEW','APPROVED','REJECTED','SUSPENDED','BLOCKED')),
  answers jsonb not null default '{}'::jsonb,
  fee_amount numeric(12,2) not null default 0,
  fee_currency text not null default 'NGN',
  fee_status text not null default 'NOT_REQUIRED' check (fee_status in ('NOT_REQUIRED','PENDING','PAID','FAILED','REFUNDED')),
  submitted_at timestamptz,
  review_due_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists role_applications_one_open_idx on public.role_applications(user_id, role_code) where status in ('DRAFT','PENDING_PAYMENT','PENDING_REVIEW');

create table if not exists public.role_fee_policies (
  role_code text primary key check (role_code in ('ARTIST','ORGANIZER','VENUE_MANAGER')),
  enabled boolean not null default true,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'NGN',
  organizer_review_hours integer not null default 24 check (organizer_review_hours between 1 and 720),
  auto_approve_after_hours boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.role_fee_policies(role_code) values ('ARTIST'),('ORGANIZER'),('VENUE_MANAGER') on conflict (role_code) do nothing;

create table if not exists public.wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  currency text not null default 'NGN',
  updated_at timestamptz not null default now()
);
create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  direction text not null check (direction in ('CREDIT','DEBIT')),
  reason text not null,
  reference_type text,
  reference_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('EVENT','SONG','ALBUM','ARTIST','VENUE','ORGANIZER','MUSIC_VIDEO')),
  target_id uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'VISIBLE' check (status in ('VISIBLE','HIDDEN','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_comments_target_idx on public.content_comments(target_type, target_id, created_at desc);

create table if not exists public.content_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('EVENT','SONG','ALBUM','ARTIST','VENUE','ORGANIZER','MUSIC_VIDEO')),
  target_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, target_type, target_id)
);

create table if not exists public.content_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('EVENT','SONG','ALBUM','ARTIST','VENUE','ORGANIZER','MUSIC_VIDEO')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id, target_type, target_id)
);

alter table public.role_onboarding_questions enable row level security;
alter table public.role_applications enable row level security;
alter table public.role_fee_policies enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.content_comments enable row level security;
alter table public.content_ratings enable row level security;
alter table public.content_likes enable row level security;

create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.code='SUPER_ADMIN'); $$;

create or replace function public.get_onboarding_config(p_role_code text default null)
returns setof public.role_onboarding_questions language sql stable security definer set search_path=public as $$
  select q.* from public.role_onboarding_questions q where q.active and (p_role_code is null or q.role_code=p_role_code) order by q.role_code,q.sort_order,q.created_at;
$$;
create or replace function public.save_onboarding_question(p_id uuid, p_role_code text, p_prompt text, p_question_type text, p_options jsonb, p_required boolean, p_sort_order integer)
returns public.role_onboarding_questions language plpgsql security definer set search_path=public as $$
declare v_row public.role_onboarding_questions;
begin if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
 if p_id is null then insert into public.role_onboarding_questions(role_code,prompt,question_type,options,required,sort_order,created_by) values(p_role_code,trim(p_prompt),p_question_type,coalesce(p_options,'[]'::jsonb),coalesce(p_required,true),coalesce(p_sort_order,0),auth.uid()) returning * into v_row;
 else update public.role_onboarding_questions set role_code=p_role_code,prompt=trim(p_prompt),question_type=p_question_type,options=coalesce(p_options,'[]'::jsonb),required=coalesce(p_required,true),sort_order=coalesce(p_sort_order,0),updated_at=now() where id=p_id returning * into v_row; end if;
 return v_row; end; $$;

create or replace function public.submit_role_application(p_role_code text, p_answers jsonb)
returns public.role_applications language plpgsql security definer set search_path=public as $$
declare v_row public.role_applications; v_policy public.role_fee_policies;
begin if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_policy from public.role_fee_policies where role_code=p_role_code;
 if v_policy.role_code is null or not v_policy.enabled then raise exception 'Role onboarding is unavailable'; end if;
 insert into public.role_applications(user_id,role_code,status,answers,fee_amount,fee_currency,fee_status,submitted_at,review_due_at)
 values(auth.uid(),p_role_code,case when v_policy.amount>0 then 'PENDING_PAYMENT' else 'PENDING_REVIEW' end,coalesce(p_answers,'{}'::jsonb),v_policy.amount,v_policy.currency,case when v_policy.amount>0 then 'PENDING' else 'NOT_REQUIRED' end,now(),case when p_role_code='ORGANIZER' then now()+make_interval(hours=>v_policy.organizer_review_hours) else null end)
 on conflict (user_id,role_code) where status in ('DRAFT','PENDING_PAYMENT','PENDING_REVIEW') do update set answers=excluded.answers,updated_at=now() returning * into v_row;
 return v_row; end; $$;

create or replace function public.admin_role_governance_snapshot()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
 select jsonb_build_object(
 'users',(select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'created_at',u.created_at,'profile',to_jsonb(p),'roles',coalesce((select jsonb_agg(r.code) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=u.id),'[]'::jsonb)) order by u.created_at desc),'[]'::jsonb) from auth.users u left join public.user_profiles p on p.id=u.id limit 500),
 'applications',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) from public.role_applications a limit 500),
 'fees',(select coalesce(jsonb_agg(to_jsonb(f) order by f.role_code),'[]'::jsonb) from public.role_fee_policies f),
 'questions',(select coalesce(jsonb_agg(to_jsonb(q) order by q.role_code,q.sort_order),'[]'::jsonb) from public.role_onboarding_questions q where q.active),
 'wallets',(select coalesce(jsonb_agg(to_jsonb(w) order by w.updated_at desc),'[]'::jsonb) from public.wallet_accounts w limit 500),
 'analytics',jsonb_build_object('comments',(select count(*) from public.content_comments where status='VISIBLE'),'ratings',(select count(*) from public.content_ratings),'likes',(select count(*) from public.content_likes))
 ) into v; return v; end; $$;

create or replace function public.admin_review_role_application(p_application_id uuid,p_status text,p_reason text default null)
returns public.role_applications language plpgsql security definer set search_path=public as $$
declare v public.role_applications;
begin if not public.is_super_admin() then raise exception 'Super Admin access required'; end if; if p_status not in ('APPROVED','REJECTED','SUSPENDED','BLOCKED') then raise exception 'Invalid review status'; end if;
 update public.role_applications set status=p_status,rejection_reason=case when p_status='REJECTED' then p_reason else null end,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_application_id returning * into v;
 if v.id is null then raise exception 'Application not found'; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'role_application.reviewed','role_application',v.id,jsonb_build_object('status',p_status,'reason',p_reason)); return v; end; $$;

create or replace function public.wallet_credit_for_cancelled_order(p_user_id uuid,p_amount numeric,p_reason text,p_reference_id uuid default null)
returns public.wallet_ledger language plpgsql security definer set search_path=public as $$
declare v public.wallet_ledger;
begin if not public.is_super_admin() and p_user_id<>auth.uid() then raise exception 'Wallet credit not authorized'; end if; if p_amount<=0 then raise exception 'Amount must be positive'; end if;
 insert into public.wallet_accounts(user_id,balance) values(p_user_id,p_amount) on conflict(user_id) do update set balance=public.wallet_accounts.balance+p_amount,updated_at=now();
 insert into public.wallet_ledger(user_id,amount,direction,reason,reference_type,reference_id,created_by) values(p_user_id,p_amount,'CREDIT',p_reason,'ORDER',p_reference_id,auth.uid()) returning * into v; return v; end; $$;

create or replace function public.public_content_analytics()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('likes',(select count(*) from public.content_likes),'ratings',(select count(*) from public.content_ratings),'comments',(select count(*) from public.content_comments where status='VISIBLE'));
$$;

revoke all on function public.admin_role_governance_snapshot() from public;
revoke all on function public.admin_review_role_application(uuid,text,text) from public;
revoke all on function public.save_onboarding_question(uuid,text,text,text,jsonb,boolean,integer) from public;
revoke all on function public.wallet_credit_for_cancelled_order(uuid,numeric,text,uuid) from public;
grant execute on function public.get_onboarding_config(text) to authenticated;
grant execute on function public.submit_role_application(text,jsonb) to authenticated;
grant execute on function public.admin_role_governance_snapshot() to authenticated;
grant execute on function public.admin_review_role_application(uuid,text,text) to authenticated;
grant execute on function public.save_onboarding_question(uuid,text,text,text,jsonb,boolean,integer) to authenticated;
grant execute on function public.wallet_credit_for_cancelled_order(uuid,numeric,text,uuid) to authenticated;
grant execute on function public.public_content_analytics() to anon,authenticated;

create policy role_questions_public_read on public.role_onboarding_questions for select to authenticated using (active or public.is_super_admin());
create policy role_applications_self_or_super on public.role_applications for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
create policy role_fee_super_only on public.role_fee_policies for select to authenticated using (public.is_super_admin());
create policy wallet_self_read on public.wallet_accounts for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
create policy wallet_ledger_self_read on public.wallet_ledger for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
create policy comments_read_visible on public.content_comments for select to anon,authenticated using (status='VISIBLE' or author_id=auth.uid() or public.is_super_admin());
create policy comments_self_write on public.content_comments for insert to authenticated with check (author_id=auth.uid());
create policy comments_self_update on public.content_comments for update to authenticated using (author_id=auth.uid() or public.is_super_admin()) with check (author_id=auth.uid() or public.is_super_admin());
create policy ratings_read on public.content_ratings for select to anon,authenticated using (true);
create policy ratings_self_write on public.content_ratings for all to authenticated using (user_id=auth.uid() or public.is_super_admin()) with check (user_id=auth.uid() or public.is_super_admin());
create policy likes_read on public.content_likes for select to anon,authenticated using (true);
create policy likes_self_write on public.content_likes for all to authenticated using (user_id=auth.uid() or public.is_super_admin()) with check (user_id=auth.uid() or public.is_super_admin());

commit;
