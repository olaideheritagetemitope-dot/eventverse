# Shared ChatGPT directive

Source: https://chatgpt.com/s/t_6a86a1d175fc8191a2c89b035986847d

## Master directive

EVENTVERSE / ATIZZY: REMOVE MOCK DATA. DO NOT REMOVE UI. CONNECT THE EXISTING UI TO THE REAL BACKEND. COMPLETE THE MISSING DATABASE, SECURITY, PAYMENT, ATTENDEE, CHECK-IN, ANALYTICS, DISCOVERY, AND DEPLOYMENT WORKFLOWS. VERIFY EVERYTHING BEFORE CLAIMING COMPLETION.

## Non-negotiable rules

- Remove mock data without deleting or redesigning the existing UI.
- Implemented is not verified.
- Prove the chain: Frontend -> Supabase -> authorization/RLS -> payment -> webhook -> database -> ticket -> attendee -> check-in -> analytics -> production deployment.
- Verify the actual deployed Supabase database rather than assuming an RPC exists because the frontend calls it.
- Ensure RLS is enabled and policies match the ownership model.
- Complete a verification pass across GitHub, Supabase, and Vercel before moving to another major role.

## Workstreams

Database, security/RLS, payment, attendee, check-in, analytics, discovery, and deployment workflows must be audited and completed while preserving the current UI.
