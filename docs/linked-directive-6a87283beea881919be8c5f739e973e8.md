# Linked Directive 6a87283beea881919be8c5f739e973e8

## Core requirement
The Atizzy Super Admin feature is incomplete unless the backend, frontend, routes, visible UI, live actions, authorization, live data, and loading/error/empty states are all implemented together. Existing backend functionality alone does not count as completion.

## Required visible Super Admin modules
The authenticated Super Admin UI must visibly expose and make operational the following modules:

- Users
- Artists
- Organizers
- Venue Managers
- Event Staff
- Admins
- Applications
- Verification
- Events
- Tickets
- Payments
- Wallets
- Analytics
- Moderation
- Support
- Settings
- Audit Logs

Each module must be reachable from the Super Admin workspace and its controls must lead to functioning live workflows, not placeholders.

## Required final report evidence
The implementation report must identify: existing backend functionality; missing frontend functionality; created pages; created components; created routes; connected database functionality; verified permissions/RLS; onboarding workflows; verification workflows; organizer workflow; ticket workflows; wallet/refund workflow; analytics; comments/ratings; support; moderation; exact route names or screenshots tested; production build result; deployment result; and Git commit SHA.

## Acceptance requirement
Do not only report completion. Open and test the Super Admin UI and confirm that the requested controls are visible and operational. If a feature exists in Supabase but cannot be seen and operated from the UI, it remains unfinished.
