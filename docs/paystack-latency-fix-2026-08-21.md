# Paystack Checkout Latency Fix — 2026-08-21

## Reported symptom

The Paystack payment handoff was taking too long before opening the provider authorization page.

## Root cause identified

The Payment screen requested the current Supabase session and then independently requested the current Supabase user with `supabase.auth.getUser()`. The second call was redundant because the authenticated session already contains the user email required by the server route. This added an avoidable network round trip before Atizzy could call `/api/paystack/initialize`.

## Fix

The frontend now performs one `supabase.auth.getSession()` lookup and reads `session.user.email`. The backend remains authoritative: it still authenticates the bearer token, initializes the order payment through `initialize_order_payment`, contacts Paystack with the server-only secret, and attaches the provider reference through `attach_payment_provider_reference` using the service-role credential.

No pricing, order status, payment verification, webhook, or refund authority was moved to the client.

## Validation

The focused latency contract passed. The complete suite passed with 40 test files and 138 passing tests, with 2 credential-dependent tests skipped. TypeScript passed and the production Vite build passed. The build retained only the existing large-bundle advisory.

## Expected result

Checkout now reaches the Atizzy payment initialization route sooner by removing one redundant authentication request. The remaining provider and database operations are required for secure server-authoritative payment initialization.
