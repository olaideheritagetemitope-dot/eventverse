import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0113_playlist_system_complete.sql"), "utf8");
const coverMigration = fs.readFileSync(path.join(root, "supabase/0114_playlist_cover_and_mutation_contract.sql"), "utf8");
const publicEditingMigration = fs.readFileSync(path.join(root, "supabase/0115_playlist_public_editing.sql"), "utf8");
const visibilityDeleteMigration = fs.readFileSync(path.join(root, "supabase/0116_playlist_visibility_delete_policy_fix.sql"), "utf8");

describe("playlist system", () => {
  it("mounts the live library and reachable detail route in the existing app shell", () => {
    expect(app).toContain("<PlaylistLibrary nav={nav} account={account} player={player} catalog={catalog} />");
    expect(app).toContain("playlistDetail: <PlaylistDetail");
    expect(app).toContain("AddToPlaylistButton");
    expect(app).toContain("Play All");
    expect(app).toContain("Shuffle");
    expect(app).toContain("Discover Public Playlists");
    expect(app).toContain("Create → add songs → reorder → play → edit visibility → discover public playlists.");
    expect(app).toContain('onClick={() => save(visibility)}');
    expect(app).toContain("Upload cover photo");
    expect(app).toContain('accept="image/jpeg,image/png,image/webp,image/gif"');
    expect(app).toContain("Publish playlist");
    expect(app).toContain("Save privately");
    expect(app).toContain("Allow public edits");
    expect(app).toContain("publicEditEnabled");
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
    expect(service).toContain('lyrics_text');
    expect(service).toContain('sourceSong.lyrics_text');
    expect(service).not.toContain('songs.lyrics');
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

  it("applies owner-controlled public editing with non-owner mutation boundaries", () => {
    expect(publicEditingMigration).toContain("public_edit_enabled boolean not null default false");
    expect(publicEditingMigration).toContain('create policy "public editors update public playlists"');
    expect(publicEditingMigration).toContain('create policy "public editors add playlist items"');
    expect(publicEditingMigration).toContain('create policy "public editors update playlist items"');
    expect(publicEditingMigration).toContain('create policy "public editors remove playlist items"');
    expect(service).toContain("const publicEditor = !owner && current.visibility === \"PUBLIC\" && current.public_edit_enabled === true;");
    expect(service).toContain("if (owner && changes.public_edit_enabled !== undefined)");
    expect(service).toContain("if (owner && changes.visibility !== undefined)");
    expect(app).toContain("const canEdit = owner || Boolean(playlist?.visibility === \"PUBLIC\" && playlist?.public_edit_enabled === true);");
  });

  it("hardens public publishing and owner deletion without masking failed writes", () => {
    expect(service).toContain("export async function publishPlaylist(userId, playlistId");
    expect(service).toContain('const payload = { visibility: "PUBLIC", public_edit_enabled: public_edit_enabled === true };');
    expect(service).toContain('String(data.visibility || "").toUpperCase() !== "PUBLIC"');
    expect(app).toContain('await publishPlaylist(account.user.id, playlist.id, { name, description, public_edit_enabled: publicEditEnabled })');
    expect(service).toContain("const nextVisibility = changes.visibility === undefined ? current.visibility : String(changes.visibility).toUpperCase();");
    expect(service).toContain("if (changes.public_edit_enabled === true && nextVisibility !== \"PUBLIC\")");
    expect(service).toContain('delete().eq("id", playlistId).eq("user_id", userId).select("id").maybeSingle()');
    expect(service).toContain("Playlist was not deleted. Confirm you are the owner and try again.");
    expect(visibilityDeleteMigration).toContain('create policy \"owners delete own playlists\"');
    expect(visibilityDeleteMigration).toContain("auth.uid() = public.playlists.user_id");
    expect(visibilityDeleteMigration).toContain("playlist_items_playlist_id_fkey");
    expect(visibilityDeleteMigration).toContain("public.playlists.user_id = (");
    expect(visibilityDeleteMigration).not.toContain("user_id = user_id");
  });

  it("uses the managed media pipeline and canonical visibility mutation for covers", () => {
    expect(service).toContain('"PLAYLIST_COVER"');
    expect(app).toContain('uploadMediaFile(account.user.id, file, "PLAYLIST_COVER", "PLAYLIST", playlist.id)');
    expect(service).toContain('supabase.from("playlists").update(payload).eq("id", playlistId).select(PLAYLIST_COLUMNS).maybeSingle()');
    expect(coverMigration).toContain("'PLAYLIST_COVER'");
    expect(coverMigration).toContain("media_assets_playlist_cover_idx");
    expect(coverMigration).toContain("playlist cover");
  });

  it("maps playlist songs into the existing audio player contract", () => {
    expect(app).toContain("function playlistSongForPlayer(item)");
    expect(app).toContain("audioUrl: song.audioUrl || song.audio_url");
    expect(app).toContain("player.play(queue[0], queue)");
  });
});
