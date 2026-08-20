# Atizzy Capability Audit — 2026-08-20

## Scope

This audit rechecked the user-listed capabilities against the actual Atizzy frontend, authenticated service layer, Supabase migrations/RLS, and Vitest acceptance suite.

## Implemented and evidenced

| Capability | Evidence |
|---|---|
| Select photo instead of entering URL | Shared `MediaUploadField` is used for profile, artist image, song cover, audio, venue photo, event poster, and Posts photo. |
| Real Supabase Storage upload | `uploadMediaFile` validates MIME/size, uploads to `atizzy-media`, and registers `media_assets`. |
| Image preview/replacement/removal | Shared upload field now renders image previews and replacement/removal controls; Posts has dedicated preview/removal; Profile removal persists an empty avatar URL. |
| Real post creation | `create_post` RPC and visible Create draft action. |
| Real post editing | `update_post` RPC and visible Edit / Save draft changes action. |
| Real post deletion/archive | `delete_post` RPC and visible Delete action; `set_post_status` provides Archive and restore/publish transitions. |
| Real publishing state | Posts expose DRAFT, PUBLISHED, and ARCHIVED states backed by `set_post_status`. |
| Artist audio upload | Audio file selector uploads through Storage and persists `audio_url` through artist-owned song mutation. |
| Real music playback workflow | Existing player, play history, and route-continuity implementation preserved and covered by existing player tests. |
| Like/unlike | Existing live favorite mutation and state loader preserved and covered by discovery/engagement tests. |
| Follow/unfollow | Existing `toggle_artist_follow` service/RPC path preserved and covered by follow-notification tests. |
| Save/library actions | Existing music favorites, playlists, and play history persistence preserved and covered by engagement and profile-collection tests. |
| Real event creation/edit/publish | Existing Organizer server-authoritative creation, update, ticket configuration, and publish/cancel RPCs preserved; event poster is Storage-backed. |
| Venue content management | Existing Venue Manager create/update ownership-scoped paths preserved; venue photos use Storage-backed upload control. |
| Profile photo upload | Profile editor uploads an avatar through Storage, previews it, replaces it, removes it, and persists the profile mutation. |
| Role-by-role action system | Existing Artist, Organizer, Venue Manager, Event Staff, Admin, and Super Admin role gates/RLS/RPC boundaries preserved; new post actions use authenticated ownership plus Admin/Super Admin override. |
| Full CRUD/action audit | Added focused media/publishing assertions covering visible selectors, previews, removal, post CRUD, publication transitions, Storage registration, engagement persistence, and ownership boundaries. |

## Live migrations applied

- `0027_atizzy_media_storage.sql`
- `0028_atizzy_posts_workflow.sql`
- `0029_atizzy_post_delete.sql`

## Validation

- 24 test files passed.
- 84 tests passed.
- Production Vite build passed.
- `git diff --check` passed.
- Live Supabase migration calls returned success.

## Notes

The production build reports a non-blocking bundle-size warning for the monolithic frontend chunk. No mocked mutation path was introduced for the listed capabilities; existing protected workflows remain server-authoritative.
