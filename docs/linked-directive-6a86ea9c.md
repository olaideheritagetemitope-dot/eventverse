# Linked ChatGPT Directive: Active Publishing and Live Media Workflows

Source: https://chatgpt.com/s/t_6a86ea9c344481919ac0671cabc8850c

## Objective

Move Atizzy from static pages and data cards into an active publishing/content platform. Users should not paste image, audio, or technical URLs for normal uploads. The UI must provide real file selection controls, previews, storage uploads, database records, publishing, live rendering, notifications/activity, and interactions.

## Mandatory principles

1. Remove hardcoded mock records.
2. Connect components to live Supabase data.
3. Implement real user actions.
4. Implement real file uploads.
5. Implement real Supabase Storage.
6. Implement real authorization.
7. Implement real workflows.
8. Preserve the existing UI while replacing mock records with live backend data.
9. Use the pipeline: browser File selection -> preview -> Supabase Storage upload -> storage reference -> Supabase database record -> published/live UI.
10. Apply the same approach wherever applicable to artist artwork, avatars, event posters, venue photos, post images, and audio uploads.
11. Define the complete role-aware action/workflow system, preserving each role's actual create, edit, publish, delete, play, manage, purchase, and interaction permissions.

## Required UX direction

Replace URL-entry fields for ordinary user uploads with controls such as “Select Photo,” preview state, caption/content fields, optional music/event association, and Publish. Preserve the existing visual hierarchy and component structure.

## Role and security requirements

All actions must be server-authoritative. Storage upload permissions, database inserts/updates/deletes, publishing, and role-specific workflows must be protected by authenticated identity and existing role/RLS boundaries. Ordinary users must not receive Artist, Organizer, Venue, Staff, Admin, or Super Admin capabilities merely because upload controls exist.

## Acceptance themes

Verify no production-facing mock records remain in the targeted workflows; live Supabase queries populate components; file inputs upload to controlled storage paths; resulting records render immediately; failures are surfaced; duplicate or unauthorized operations are rejected; and role-specific content actions remain scoped to the owning user/resource.
