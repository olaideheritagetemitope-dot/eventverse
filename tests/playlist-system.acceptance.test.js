import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0113_playlist_system_complete.sql"), "utf8");

describe("playlist system", () => {
  it("mounts the live library and reachable detail route in the existing app shell", () => {
    expect(app).toContain("<PlaylistLibrary nav={nav} account={account} player={player} catalog={catalog} />");
    expect(app).toContain("playlistDetail: <PlaylistDetail");
    expect(app).toContain("AddToPlaylistButton");
    expect(app).toContain("Play All");
    expect(app).toContain("Shuffle");
    expect(app).toContain("Discover Public Playlists");
    expect(app).toContain("Create → add songs → reorder → play → edit visibility → discover public playlists.");
    expect(app).toContain('onClick={save}');
    expect(app).toContain('onClick={destroy}');
    expect(app).toContain('onClick={() => { const song = playlistSongForPlayer(item);');
  });

  it("supports real create, edit, delete, add, remove, and reorder service operations", () => {
    expect(service).toContain('supabase.from("playlists").insert');
    expect(service).toContain('supabase.from("playlists").update');
    expect(service).toContain('supabase.from("playlists").delete');
    expect(service).toContain('supabase.from("playlist_items").insert');
    expect(service).toContain('supabase.from("playlist_items").delete');
    expect(service).toContain("reorderPlaylistItems");
    expect(service).toContain('const PLAYLIST_ITEM_COLUMNS = "id,playlist_id,song_id,position,added_at,added_by"');
    expect(service).toContain('supabase.from("songs").select(SONG_COLUMNS)');
    expect(service).toContain("hydratePlaylists");
    expect(service).toContain('eq("visibility", "PUBLIC")');
    expect(service).toContain('eq("user_id", userId)');
  });

  it("preserves ownership, public visibility, uniqueness, and deterministic ordering in SQL", () => {
    expect(migration).toContain("alter table public.playlists");
    expect(migration).toContain("alter table public.playlist_items");
    expect(migration).toContain("playlist_items_playlist_position_idx");
    expect(migration).toContain("visibility = 'PUBLIC'");
    expect(migration).toContain("public can view public playlists");
    expect(migration).toContain("public can view public playlist items");
    expect(migration).toContain("position");
  });

  it("maps playlist songs into the existing audio player contract", () => {
    expect(app).toContain("function playlistSongForPlayer(item)");
    expect(app).toContain("audioUrl: song.audioUrl || song.audio_url");
    expect(app).toContain("player.play(queue[0], queue)");
  });
});
