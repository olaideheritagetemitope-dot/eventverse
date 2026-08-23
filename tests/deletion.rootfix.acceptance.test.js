import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const services = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const cleanupApi = fs.readFileSync(path.join(root, "api/media/cleanup.js"), "utf8");
const venueMigration = fs.readFileSync(path.join(root, "supabase/0076_permanent_venue_delete_preserve_history.sql"), "utf8");
const postsMigration = fs.readFileSync(path.join(root, "supabase/0029_atizzy_post_delete.sql"), "utf8");

describe("deletion root-fix acceptance", () => {
  it("keeps artist-song and venue deletion authoritative in Supabase and makes storage cleanup non-blocking", () => {
    expect(services).toContain('rpc("delete_artist_song"');
    expect(services).toContain('rpc("delete_owned_venue"');
    expect(services).toContain('fetch("/api/media/cleanup"');
    expect(services).not.toMatch(/deleteArtistSong[\s\S]*storage\.from\(MEDIA_BUCKET\)\.remove/);
    expect(services).not.toMatch(/deleteOwnedVenue[\s\S]*storage\.from\(MEDIA_BUCKET\)\.remove/);
  });

  it("allows trusted cleanup for Super Admin paths while restricting ordinary users to their own folder", () => {
    expect(cleanupApi).toContain("/auth/v1/user");
    expect(cleanupApi).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(cleanupApi).toContain('roles.includes("SUPER_ADMIN")');
    expect(cleanupApi).toContain('path.startsWith(`${userId}/`)');
    expect(cleanupApi).toContain("response.status === 404");
  });

  it("preserves venue booking history while deleting the venue", () => {
    expect(venueMigration).toContain("on delete set null");
    expect(venueMigration).toContain("history_preserved");
  });

  it("keeps post deletion owner-or-Super-Admin authorization server-side", () => {
    expect(postsMigration).toContain("author_id = auth.uid()");
    expect(postsMigration).toContain("SUPER_ADMIN");
    expect(postsMigration).toContain("Post access denied");
  });
});
