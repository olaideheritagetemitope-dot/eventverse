import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/eventverse";
const appSource = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const serviceSource = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "supabase/0036_managed_media_write_guard.sql"), "utf8");

describe("Atizzy image upload selection contract", () => {
  it("uses explicit device photo selection rather than URL fields", () => {
    expect(appSource).toContain('type="file"');
    expect(appSource).toContain("Select ${label}");
    expect(appSource).toContain("Change ${label}");
    expect(appSource).toContain("URL.createObjectURL");
    expect(appSource).not.toMatch(/type=["']url["']/i);
  });

  it("validates selected files before upload", () => {
    expect(appSource).toContain("Choose a supported photo or media file.");
    expect(appSource).toContain("50 * 1024 * 1024");
    expect(serviceSource).toContain("Unsupported file type");
    expect(serviceSource).toContain("File is too large");
  });

  it("requires managed Atizzy Storage URLs for image-bearing mutations", () => {
    expect(serviceSource).toContain("External image URLs are not supported.");
    expect(serviceSource).toContain("/storage/v1/object/public/${MEDIA_BUCKET}/");
    expect(migrationSource).toContain("is_atizzy_managed_media_url");
    expect(migrationSource).toContain("trg_validate_user_profile_media");
    expect(migrationSource).toContain("trg_validate_artist_media");
    expect(migrationSource).toContain("trg_validate_song_media");
    expect(migrationSource).toContain("trg_validate_event_media");
    expect(migrationSource).toContain("trg_validate_post_media");
    expect(migrationSource).toContain("trg_validate_venue_media");
  });
});
