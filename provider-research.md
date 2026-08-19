# Provider research

## Spotify
Source: https://developer.spotify.com/documentation/design
Spotify’s official developer design guidance says the Spotify icon may be used when space is limited, and the green logo/icon should be used only on black or white backgrounds; use a monochrome version on other backgrounds. The Spotify icon should be a real brand mark, not a text dot or improvised symbol.

Source: https://supabase.com/docs/guides/auth/social-login/auth-spotify
Supabase requires a separate Spotify OAuth application with its own Client ID and Client Secret. The Spotify app must register the Supabase callback URL in the Spotify Developer Dashboard, then Spotify must be enabled in Supabase with those credentials.

## Facebook
Source: https://meta.com/brand/resources/facebook/logo/
Meta’s current guidance was updated December 2024 and says the Facebook logo is an “f” within a blue circle. It specifically says to use the current downloadable logo pack rather than an image found through a generic web search. The primary expression is Facebook Blue with a white “f”; the logo should not be recolored or replaced with a plain text f.

Source: https://supabase.com/docs/guides/auth/social-login/auth-facebook
Supabase requires a separate Facebook application with its own App ID and App Secret, the Supabase callback URL registered in Facebook Login settings, and email permission configured. Facebook must then be enabled in Supabase with those independent credentials.

## EventVerse callback
The EventVerse Supabase project callback pattern is https://blalvoelllndmbppbkcy.supabase.co/auth/v1/callback. Google is already configured. Facebook and Spotify cannot be enabled using Google credentials.

## Icon implementation note

The official Spotify developer guidance allows the compact Spotify icon where the full logo will not fit. EventVerse now uses a 20px Spotify-green circular icon with three white sound-wave arcs. Meta's current Facebook guidance specifies the complete white "f" inside a Facebook-blue circle and prohibits using only a plain text f; EventVerse now uses that complete mark while keeping Facebook disabled until independent credentials are supplied.

Additional official sources reviewed:

- https://newsroom.spotify.com/media-kit/logo-and-brand-assets/
- https://www.meta.com/brand/resources/facebook/logo/
