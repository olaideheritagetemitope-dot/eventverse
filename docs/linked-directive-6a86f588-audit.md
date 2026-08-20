# Atizzy Dynamic Role and Policy Directive — Audit Evidence

Source directive: https://chatgpt.com/s/t_6a86f588d87c81918b9784e1e3440607

## Directive requirements

The platform must separate code capabilities, database configuration, permissions, RLS, and Super Admin operational policy. Dynamic policies must be audited, validated, safe by default, unable to bypass security, protected by RLS and server authorization, and usable without source-code changes for normal business-policy changes. Existing workflows and UI must remain responsive across mobile and desktop. Production build and deployment must succeed.

## Live evidence collected on 2026-08-20

Migration `0030_dynamic_policy_control_plane` is applied to project `blalvoelllndmbppbkcy`. Live `public.policy_settings` contains:

- `artist_registration_enabled = true` (boolean)
- `artist_verification_required = true` (boolean)
- `artist_verification_approval_role = SUPER_ADMIN` (enum constrained to `SUPER_ADMIN`)
- `event_publish_requires_ticket_config = true` (boolean)
- `venue_publish_requires_owner = true` (boolean)

Live public functions confirmed:

- `get_policy_value(text)`
- `list_policy_settings()`
- `update_policy_setting(text, jsonb)`

The functions are security-definer functions with explicit authenticated grants; policy reads/writes check the effective `SUPER_ADMIN` capability, validate value types and enum allow-lists, and write `audit_logs` entries. Artist fee initialization reads the registration/verification enablement policy server-side before creating fee transactions.

## Remaining implementation focus

Add explicit artist verification information/business-rule settings where needed, ensure the UI presents the policy controls inside Admin Operations, and add acceptance evidence for safe defaults, validation, audit logging, RLS authorization, role boundaries, preserved workflows, and responsive production build.
