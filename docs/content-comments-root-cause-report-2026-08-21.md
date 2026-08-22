# Content Comments Root-Cause Report

## Root cause

The live database had a `content_comments_author_id_fkey` constraint, but it incorrectly targeted `auth.users` rather than the `public.user_profiles` relation expected by the Atizzy comment UI. PostgREST therefore could not resolve the requested `content_comments → user_profiles` relationship in its schema cache.

## Database correction

Migration `0050_retarget_content_comments_author_fk.sql` was applied through the Supabase migration interface. It first checks for orphaned comment authors, safely removes the mis-targeted constraint when necessary, adds `content_comments_author_id_fkey` referencing `public.user_profiles(id)`, and sends `NOTIFY pgrst, 'reload schema'`.

| Check | Result |
|---|---|
| Foreign key created/retargeted | Yes |
| Constraint | `content_comments_author_id_fkey` |
| Source | `public.content_comments.author_id` |
| Target | `public.user_profiles.id` |
| Orphaned author IDs | 0 |
| RLS disabled | No |
| Schema metadata | Live catalog confirms the target relation |

## Frontend correction

`loadContentEngagement` now uses the declared PostgREST relationship directly:

```js
content_comments.select(
  "id,body,author_id,created_at,user_profiles(id,full_name,avatar_url)"
)
```

The previous explicit profile-enrichment workaround was removed. Comment authors remain entirely Supabase-backed; no names, avatars, or comments are fabricated.

## Workflow coverage

The existing implementation continues to support live comment insertion through `content_comments`, visible-comment loading, author profile projection, persisted reload behavior, and existing role-scoped moderation paths. The existing Atizzy cards, panels, empty states, and engagement UI were preserved.

## Validation

- Focused engagement acceptance suite passed.
- Full Vitest suite passed: 43 files, 147 tests passing, 2 skipped.
- Production Vite build passed.
- Live PostgreSQL catalog verification returned the expected `public.user_profiles` target.
- The existing large frontend bundle advisory remains unchanged.

## Remaining verification boundary

A real browser session with an authenticated user, an anonymous reader, another user, and a Super Admin is still required to exercise every RLS branch and the full create/edit/delete/moderation lifecycle against production data. No synthetic test comments were inserted during this fix.
