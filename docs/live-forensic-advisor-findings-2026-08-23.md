# Live forensic advisor findings — 2026-08-23

Source: Supabase project `EventVerse` (`blalvoelllndmbppbkcy`), queried through the configured Supabase integration on 2026-08-23.

## Security findings

The live security advisor reports `anon_security_definer_function_executable` for `public.admin_list_users_page(p_search text, p_role_code text, p_status text, p_limit integer, p_offset integer)`. This is a confirmed high-priority exposure because the paginated Super Admin directory RPC is callable as `anon` while running as `SECURITY DEFINER`; its intended caller is Super Admin/authenticated authority, not unauthenticated public users.

The advisor also reports the same anonymous execution warning for `get_cold_start_discovery_catalogue`, `get_content_engagement_summary`, `get_discovery_snapshot`, and `get_role_onboarding_public_config`. These may be intentional public endpoints only where the product contract explicitly requires anonymous discovery or onboarding configuration. They still require function-body review to prove that no private rows, user identifiers, unpublished records, or admin configuration are exposed.

The advisor reports broad `authenticated_security_definer_function_executable` warnings across operational RPCs, including role/payment/admin functions, post updates, ticket release policy, user preferences, QR validation, venue payment verification, wallet credit, and other workflows. These are not automatically vulnerabilities: each function must enforce its own actor/role/ownership checks. However, the warning confirms that grants alone are not sufficient evidence of safety; the full body and negative authorization paths require review.

The Supabase advisor also recommends enabling leaked-password protection through Supabase Auth.

Remediation reference for the anonymous SECURITY DEFINER warning: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
Remediation reference for authenticated SECURITY DEFINER warnings: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
Password protection reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Performance findings

The live performance advisor reports numerous `unindexed_foreign_keys` findings. Confirmed examples include `admin_permission_grants.granted_by`, `admin_permission_grants.permission_code`, `artist_booking_requests.artist_id`, `artist_booking_requests.requester_id`, `artist_fee_transactions.artist_id`, `artist_followers.user_id`, `artist_registrations.transaction_id`, `artist_verifications.transaction_id`, `artist_verifications.user_id`, `audit_logs.actor_id`, `content_comments.author_id`, `event_artists.artist_id`, `event_categories.category_id`, and `event_favorites.user_id`. The complete raw advisor response is retained at `/home/ubuntu/.mcp/tool-results/2026-08-23_11-51-18.962963414_supabase_get_advisors_1bc5ae6c.json`.

These are performance risks rather than confirmed correctness bugs. Prioritize indexes for high-volume or frequently joined foreign keys after checking existing indexes and query plans; do not add blind indexes to every relation.

## Audit status

No source, database, configuration, or deployment changes were made during this fresh forensic pass. These findings are evidence for the final bug inventory and remediation plan.
