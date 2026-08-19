
## Auth configuration references

EventVerse Supabase project: https://supabase.com/dashboard/project/blalvoelllndmbppbkcy
Project URL: https://blalvoelllndmbppbkcy.supabase.co
Project region: eu-west-1 (AWS, Ireland); status Healthy.

Official email OTP guidance: https://supabase.com/docs/guides/auth/auth-email-passwordless — Supabase sends a six-digit OTP only when the Magic Link email template uses `{{ .Token }}` instead of `{{ .ConfirmationURL }}`. Verification uses `supabase.auth.verifyOtp({ email, token, type: 'email' })` for email OTP sign-in and `type: 'signup'` for signup verification.

Official Spotify provider guidance: Supabase callback URL is `https://blalvoelllndmbppbkcy.supabase.co/auth/v1/callback`; Spotify Developer Dashboard requires that redirect URI, then Supabase provider settings require Spotify client ID and client secret. Client login uses `supabase.auth.signInWithOAuth({ provider: 'spotify' })`.

Supabase provider dashboard: https://supabase.com/dashboard/project/blalvoelllndmbppbkcy/auth/providers
Supabase email templates dashboard: https://supabase.com/dashboard/project/blalvoelllndmbppbkcy/auth/templates
Supabase URL configuration dashboard: https://supabase.com/dashboard/project/blalvoelllndmbppbkcy/auth/url-configuration

## Provider dashboard findings

Supabase provider dashboard is authenticated at https://supabase.com/dashboard/project/blalvoelllndmbppbkcy/auth/providers. The Supabase Auth tab is loaded, but provider cards are still loading in the current browser view; the page exposes a separate Third-Party Auth tab and Custom Providers section. The project callback URL remains `https://blalvoelllndmbppbkcy.supabase.co/auth/v1/callback` for OAuth provider consoles. Production Site URL is saved as `https://eventverse-eight.vercel.app`; redirect allowlist contains that same origin.

The email template editor showed the default Confirm sign up template with a confirmation link and a notice that custom SMTP is required to edit templates. Therefore, converting the default email to a visible six-digit code requires configuring SMTP or implementing an alternate code-delivery mechanism; do not claim the default template was changed without SMTP configuration.

## Google Cloud setup state

Google Cloud Console is authenticated as `olaideheritagetemitope@gmail.com` in project `cruise001-a81a0` (`cruise001`). OAuth consent/Google Auth Platform is not configured yet. Current page: https://console.cloud.google.com/auth/overview?project=cruise001-a81a0. The Google Auth Platform offers Get started, Branding, Audience, Clients, Data Access, Verification Center, and Settings. Supabase Google provider requires Client ID(s), Client Secret, and uses callback URL `https://blalvoelllndmbppbkcy.supabase.co/auth/v1/callback`.

## Google OAuth setup state — 2026-08-19

Google Cloud project: `cruise001` (`https://console.cloud.google.com/auth/overview/create?project=cruise001-a81a0`). The authenticated account is `olaideheritagetemitope@gmail.com`. The Google Auth Platform branding wizard has app name `EventVerse`, support email `olaideheritagetemitope@gmail.com`, and External audience selected. The final User Data Policy checkbox still needs to be selected; clicking the policy label/link navigates to `https://developers.google.com/terms/api-services-user-data-policy`, so return to the wizard URL before completing the final step.

Google OAuth must use the Supabase provider callback URL `https://blalvoelllndmbppbkcy.supabase.co/auth/v1/callback`, not localhost. Provider credentials are confidential and must not be written to repository files or chat.

## Google Auth Platform setup progress
- Google Cloud project: `cruise001-a81a0` (`cruise001`), authenticated account `olaideheritagetemitope@gmail.com`.
- App name configured: `EventVerse`.
- Audience selected: `External`.
- Support/notification email selected: `olaideheritagetemitope@gmail.com`.
- Current wizard state: Contact Information step; add the notification email, then proceed to Finish/Create.
- Google policy reference: https://developers.google.com/terms/api-services-user-data-policy
- Supabase OAuth callback: `https://blalvoelllndmbppbkcy.supabase.co/auth/v1/callback`.
- EventVerse production redirect origin: `https://eventverse-eight.vercel.app`.

## Verified provider state — 2026-08-19
- Supabase project dashboard: https://supabase.com/dashboard/project/blalvoelllndmbppbkcy/auth/providers
- Supabase OAuth callback: https://blalvoelllndmbppbkcy.supabase.co/auth/v1/callback
- EventVerse production origin: https://eventverse-eight.vercel.app
- Google Auth Platform project: cruise001-a81a0; OAuth app name EventVerse; External audience; support email olaideheritagetemitope@gmail.com.
- Google provider is enabled in Supabase after entering the Google Cloud web-client credentials.
- Facebook and Spotify remain disabled and require credentials from their developer consoles.
- Google client credentials are confidential and are not stored in repository files or chat.
