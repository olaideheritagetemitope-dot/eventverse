# Linked Directive: Atizzy Dynamic Role and Policy Architecture

Source: https://chatgpt.com/s/t_6a86f588d87c81918b9784e1e3440607

## Architectural principle

Atizzy must not treat Super Admin as merely a larger normal user or as an unrestricted SQL/config editor. The system must expose deliberate configuration points so normal business policies can change through the administrative control plane without source-code changes, while the security architecture remains protected.

## Required model

The code defines what the platform can do. The database defines how the platform is currently configured. The permission system defines who can do it. RLS enforces security. The Admin control plane determines operational policy. The Super Admin governs the entire system.

## Required acceptance checklist

- Configuration changes are audited.
- Configuration validation exists.
- Safe defaults exist.
- Security cannot be bypassed through dynamic policies.
- RLS enforces authorization.
- Super Admin does not need source-code changes for normal business-policy changes.
- Normal users cannot elevate themselves.
- Admins cannot exceed delegated authority.
- Existing workflows continue functioning.
- Existing UI remains intact.
- Mobile remains responsive.
- Desktop remains responsive.
- Production build succeeds.
- Production deployment succeeds.

## Configuration examples

Existing workflows should expose safe policy points. For artist verification, the Super Admin should be able to control whether verification is required, its cost, required information, who may approve it, and related business rules, without rewriting the workflow code.

## Security constraint

Dynamic policy configuration must never become a privilege-escalation mechanism or bypass RLS. Configuration writes require validation, safe defaults, server authorization, audit logging, and role boundaries.
