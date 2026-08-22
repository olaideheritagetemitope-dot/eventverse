# Live Role Assignment Uniqueness Audit — 2026-08-22

The authoritative live `public.user_roles` table already has the exact composite unique key required for one user-plus-role relationship: `user_roles_pkey` is a unique index on `(user_id, role_id)`. The live `super_admin_set_role` RPC itself uses explicit existence checks and composite-key updates/inserts for `user_roles`, so the reported ON CONFLICT error is not caused by the `user_roles` branch.

The decisive mismatch is in the profile-linking branches executed by manual assignment. The RPC contains `insert into public.artists(user_id, name, bio, verified) ... on conflict (user_id) do update`, but the live `artists` table has only its primary-key unique index on `id`; no unique constraint/index exists on `artists.user_id`. The live `venue_manager_applications` table does have `venue_manager_applications_user_id_key`, so its `on conflict (user_id)` target is valid. A focused duplicate check on `artists.user_id` is required before adding the missing unique index and applying the RPC-safe migration.

The separate `role_permissions` table uses `(role_id, permission_id)` as its primary key and should not be conflated with user-role assignment; any permission mutation using `(role_id, permission_code)` would require its own independent audit.
