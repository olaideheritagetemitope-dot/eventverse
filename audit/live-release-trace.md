# Live release trace — 2026-08-23

## Vercel production context

- Project: `eventverse`
- Domains: `eventverse-eight.vercel.app`, `eventverse-olaideheritagetemitope-dots-projects.vercel.app`, `eventverse-git-main-olaideheritagetemitope-dots-projects.vercel.app`
- Framework: Vite
- Latest production deployment: `eventverse-c11opex4i-olaideheritagetemitope-dots-projects.vercel.app`
- Latest deployment state: `READY`
- Project ID: `prj_hbb0naHcTcYteBpEGBDII53rYvQC`
- Production domain is served by the Vercel project named `eventverse`.

## Supabase production context

- Project: `EventVerse`
- Project ref: `blalvoelllndmbppbkcy`
- Database host: `db.blalvoelllndmbppbkcy.supabase.co`
- Region: `eu-west-1`
- Status at inspection: `ACTIVE_HEALTHY`

## Schema evidence

- `public.user_profiles` contains `id`, `full_name`, `avatar_url`, and timestamps.
- `public.user_roles` uses the composite primary key `(user_id, role_id)` and joins `role_id` to `public.roles.id`.
- The active frontend artist contract selects `artists.image_url` and `artists.background_url`.
- The active frontend global search uses four parallel Supabase queries and throws if any one result has an error, which can blank all categories even when other categories are valid.
- The active frontend artist directory/search filters artists with `verified = true`.

## Browser evidence

- Opening `https://eventverse-eight.vercel.app/` served the Atizzy login screen, confirming the production alias is reachable but authenticated user-only profile/search reproduction requires a valid session.
