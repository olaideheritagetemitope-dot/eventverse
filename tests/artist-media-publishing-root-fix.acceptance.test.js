import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const source = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0066_artist_media_publishing_root_fix.sql"), "utf8");
const mediaKindMigration = fs.readFileSync(path.join(root, "supabase/0067_media_assets_artist_kinds.sql"), "utf8");
const songMediaMigration = fs.readFileSync(path.join(root, "supabase/0068_artist_song_video_lyrics.sql"), "utf8");

describe("Artist media and publishing root fix", () => {
  it("keeps video MIME types aligned across the live bucket migration and upload service", () => {
    expect(migration).toContain("video/mp4");
    expect(migration).toContain("video/webm");
    for (const kind of ["AVATAR", "ARTIST_AVATAR", "ARTIST_ARTWORK", "AUDIO", "MUSIC_COVER", "ALBUM_COVER", "MUSIC_VIDEO_THUMBNAIL", "MUSIC_VIDEO", "EVENT_POSTER", "VENUE_PHOTO", "POST_IMAGE"]) {
      expect(mediaKindMigration).toContain(`'${kind}'`);
    }
    expect(service).toContain('"video/mp4"');
    expect(service).toContain('"video/webm"');
    expect(service).toContain("public_url");
    expect(service).toContain("media_assets");
  });

  it("exposes live Artist song creation and server-authoritative publishing", () => {
    expect(migration).toContain("add column if not exists status");
    expect(migration).toContain("set_artist_song_status");
    expect(service).toContain("createArtistSong");
    expect(service).toContain('status: \"DRAFT\"');
    expect(service).toContain('p_song_id: songId');
    expect(source).toContain("New song");
    expect(source).toContain("publishSong");
    expect(source).toContain("Song published to the live catalog.");
    expect(source).toContain("Music video (optional)");
    expect(source).toContain("Lyrics (optional)");
    expect(service).toContain("music_video_url");
    expect(service).toContain("lyrics_text");
    expect(songMediaMigration).toContain("add column if not exists music_video_url");
    expect(songMediaMigration).toContain("add column if not exists lyrics_text");
  });
});
