# Artist profile media visibility root cause

## Verified findings

1. The repaired Atizzy source is `/home/ubuntu/eventverse` and its Git remote is `olaideheritagetemitope-dot/eventverse.git`.
2. The managed WebDev project at `/home/ubuntu/evently-mobile` is a separate Expo project named `evently-mobile`; its `.project-config.json` points to a Cloudflare artifact Git remote and does not contain the Atizzy Vite source.
3. The Vercel project `eventverse` is a Vite project with production domains `eventverse-eight.vercel.app`, `eventverse-olaideheritagetemitope-dots-projects.vercel.app`, and `eventverse-git-main-olaideheritagetemitope-dots-projects.vercel.app`. Its latest production deployment is READY, but the project metadata reports `live: false` and the visible deployment was created before the current working-tree profile-media changes were committed.
4. The local Atizzy working tree contains the actual ArtistDetail render fix: it resolves `avatarUrl`, `img`, `image_url`, `avatar_url`, and `profile_image_url`; it resolves `backgroundUrl`, `coverUrl`, `background_url`, `background_image_url`, and `cover_url`; and it renders both the background `<img>` and circular avatar `<img>`.
5. `src/services/catalog.js` selects `image_url` and `background_url` from `artists` and maps them to `avatarUrl` and `backgroundUrl`.
6. The active ArtistWorkspace refresh populates `profileForm.image_url` and `profileForm.background_url` from the live artist row. The missing user-visible background publishing control is therefore a served-bundle/project-linkage problem if the screenshot is from the older deployment, not evidence that the current source lacks the feature.
7. The main root cause is that the previous profile-media changes were present in the local working tree but were not included in the committed `35dee71` source that the Vercel deployment was built from. The user-facing frontend therefore continued to show the old frame-only implementation and no reachable background publishing surface.

## Required repair

Commit and push the current Atizzy source containing the profile-media render/settings changes to the linked GitHub repository, then verify the Vercel deployment uses the new commit. Do not create a second profile-media implementation. After deployment, run an authenticated test of Artist Workspace → Profile → avatar/background upload and public ArtistDetail rendering.
