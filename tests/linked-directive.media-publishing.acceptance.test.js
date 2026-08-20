import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0027_atizzy_media_storage.sql"), "utf8");
const postsMigration = fs.readFileSync(path.join(root, "supabase/0028_atizzy_posts_workflow.sql"), "utf8");

describe("linked publishing and live media directive", () => {
  it("uses real file-selection controls for every targeted media workflow", () => {
    expect(app).toContain("MediaUploadField label=\"Artist image\"");
    expect(app).toContain("MediaUploadField label=\"Song cover\"");
    expect(app).toContain("MediaUploadField label=\"Audio file\"");
    expect(app).toContain("MediaUploadField label=\"Venue photo\"");
    expect(app).toContain("MediaUploadField label=\"Event poster / cover image\"");
    expect(app).toContain("MediaUploadField label=\"Profile photo\"");
  });

  it("routes uploads through authenticated storage and records media assets", () => {
    expect(service).toContain('supabase.storage.from(MEDIA_BUCKET).upload');
    expect(service).toContain('supabase.from("media_assets").insert');
    expect(service).toContain("owner_id: userId");
    expect(service).toContain("crypto.randomUUID()");
  });

  it("enforces controlled media types, size limits, ownership, and public read only", () => {
    expect(migration).toContain("create table if not exists public.media_assets");
    expect(migration).toContain("owner_id uuid not null references auth.users(id)");
    expect(migration).toContain("file_size_limit");
    expect(migration).toContain("atizzy media authenticated upload own folder");
    expect(migration).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(migration).toContain("atizzy media public read");
    expect(migration).not.toContain("to anon for insert");
  });

  it("persists uploaded artist audio through the owner-scoped song mutation", () => {
    expect(app).toContain('uploadMediaFile(account.user.id, songAudioFile, "AUDIO", "songs"');
    expect(service).toContain('audio_url: managedMediaUrl(updates?.audio_url, "audio file")');
    expect(service).toContain('.eq("artist_id", artistId)');
  });

  it("renders visible post selection, preview, replacement, removal, and CRUD state actions", () => {
    expect(app).toContain("Create, edit, publish, or archive live content.");
    expect(app).toContain('label={imagePreview ? "Replace photo" : "Select photo"}');
    expect(app).toContain('alt="Post preview"');
    expect(app).toContain('aria-label="Remove post image"');
    expect(app).toContain('status === "PUBLISHED"');
    expect(app).toContain('status === "ARCHIVED"');
    expect(app).toContain('>Edit</button>');
    expect(app).toContain('>Publish</button>');
    expect(app).toContain('>Archive</button>');
    expect(app).toContain('>Delete</button>');
  });

  it("uses server-authoritative post CRUD and publication state transitions", () => {
    expect(service).toContain("supabase.rpc(\"create_post\"");
    expect(service).toContain("supabase.rpc(\"update_post\"");
    expect(service).toContain("supabase.rpc(\"set_post_status\"");
    expect(service).toContain("supabase.rpc(\"delete_post\"");
    expect(postsMigration).toContain("create table if not exists public.posts");
    expect(postsMigration).toContain("status text not null default 'DRAFT'");
    expect(postsMigration).toContain("status in ('DRAFT','PUBLISHED','ARCHIVED')");
    expect(postsMigration).toContain("author_id = auth.uid()");
    expect(postsMigration).toContain("language plpgsql security definer");
  });

  it("keeps engagement actions connected to live persistence", () => {
    expect(app).toContain("toggleArtistFollow");
    expect(app).toContain("toggleMusicFavorite");
    expect(app).toContain("recordPlay");
    expect(service).toContain("toggle_artist_follow");
    expect(service).toContain('supabase.from("music_favorites")');
    expect(service).toContain('supabase.from("play_history")');
  });
});
