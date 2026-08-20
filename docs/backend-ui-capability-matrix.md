

## 2026-08-20 alignment slice

The Supabase governance backend is ahead of the frontend. The first alignment slice exposed the existing protected role-fee and onboarding-question contracts through `AdvancedGovernancePanels.jsx` without duplicating server logic. Super Admin can now edit ticket-sale policy, edit Artist/Organizer/Venue Manager verification fee and review-hour policies, and add configurable onboarding questions with reactive disabled and empty states. The existing lifecycle, ticket accounting, wallet, support, and niche analytics panels remain visible and source values from the expanded governance snapshot.

Validation: 38 test files passed, 132 tests passed, 1 credential test skipped, and the Vite production build passed. The build retains the existing large-chunk advisory only.
