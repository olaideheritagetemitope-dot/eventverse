# Linked Atizzy Directive — extracted 2026-08-20

Source: https://chatgpt.com/s/t_6a86cee9ae608191ae7fa7eaacb076c2

The directive requires the existing UI, routes, backend functionality, authentication, and data behavior to remain unchanged. It prohibits introducing mock data, performance regressions, accessibility regressions, or repeated logo placement.

The requested implementation is a global, reusable, subtle Atizzy-branded decorative background layer. The uploaded artwork is a visual reference only. The application must use the gold ticket outlines, music notes, stars, and related decorative symbols as a signature texture over the existing black background. The full logo image must not be used as a CSS background and the app must not be redesigned into a poster.

Required validation: run lint, typecheck, production build, mobile and desktop checks, overflow checks, and interaction checks. The directive also requests deployment and reporting the commit SHA and deployment status. Deployment is not performed automatically here; repository status and any publish handoff must be reported accurately.

Reference assets:
- `/home/ubuntu/upload/1787152364633.png` — square Atizzy logo artwork.
- `/home/ubuntu/upload/IMG_20260820_104654_884.png` — tall narrow gold/black patterned texture reference.

## Visual verification

The linked directive was confirmed from the shared ChatGPT page. The supplied square image contains the Atizzy gold logo on a black field with gold music notes, ticket outlines, and stars around the edges. The supplied tall image is a narrow black-and-gold repeating motif using ticket outlines, music notes, and stars, with a gold edge.

The current Atizzy Vite preview loads the login screen successfully. The new texture is visible as a very subtle vertical gold-on-black pattern behind the login shell. The preview shows no horizontal overflow in the captured desktop viewport, and the existing login controls and provider buttons remain present and readable.
