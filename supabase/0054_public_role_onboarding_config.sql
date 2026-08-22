begin;

create or replace function public.get_role_onboarding_public_config(p_role_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'role_code', p_role_code,
    'fee', (
      select jsonb_build_object(
        'role_code', f.role_code,
        'amount', f.amount,
        'currency', f.currency,
        'enabled', f.enabled,
        'review_hours', f.organizer_review_hours
      )
      from public.role_fee_policies f
      where f.role_code = p_role_code
      limit 1
    ),
    'questions', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.sort_order, q.created_at)
      from public.role_onboarding_questions q
      where q.role_code = p_role_code and q.active
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_role_onboarding_public_config(text) from public;
grant execute on function public.get_role_onboarding_public_config(text) to authenticated;

commit;

select pg_notify('pgrst', 'reload schema');

-- Migration 0054: expose only the public onboarding configuration needed by applicants.
