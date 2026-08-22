import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../src/services/user.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/0055_artist_albums_music_videos.sql", import.meta.url), "utf8");

describe("artist creator content capability projection", () => {
  it("keeps live album and music-video tabs inside the existing Artist Workspace", () => {
    expect(source).toContain('"Albums"');
    expect(source).toContain('"Music Videos"');
    expect(source).toContain("loadArtistCreatorContent");
    expect(source).toContain("createArtistAlbum");
    expect(source).toContain("createArtistMusicVideo");
    expect(source).toContain("publishAlbum");
    expect(source).toContain("publishMusicVideo");
  });

  it("routes the visible Artist music delete action through the authoritative permanent-delete handler", () => {
    const workspaceStart = source.indexOf("function ArtistWorkspace");
    const workspaceEnd = source.indexOf("function ArtistAdminSettings");
    const workspace = source.slice(workspaceStart, workspaceEnd);
    expect(workspace).toContain("const archiveSong = async (song)");
    expect(workspace).toContain("onClick={() => archiveSong(song)}");
    expect(workspace).not.toContain("onClick={() => archive(song)}");
    expect(workspace).toContain("deleteArtistSong(song.id)");
  });

  it("uses managed media uploads and explicit live empty states", () => {
    expect(source).toContain('"ALBUM_COVER"');
    expect(source).toContain('"MUSIC_VIDEO_THUMBNAIL"');
    expect(source).toContain('"MUSIC_VIDEO"');
    expect(source).toContain("No albums yet");
    expect(source).toContain("No music videos yet");
    expect(service).toContain('video/mp4');
    expect(service).toContain('video/webm');
  });

  it("defines artist-owned RLS-backed album and music-video tables", () => {
    expect(migration).toContain("create table if not exists public.albums");
    expect(migration).toContain("create table if not exists public.music_videos");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("set_artist_album_status");
    expect(migration).toContain("set_artist_music_video_status");
  });
});

/* No mock catalog records are introduced by this acceptance contract. */
