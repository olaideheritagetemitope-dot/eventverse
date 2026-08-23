import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const shell = fs.readFileSync(path.resolve(process.cwd(), "src/EventVerse.jsx"), "utf8");
const services = fs.readFileSync(path.resolve(process.cwd(), "src/services/user.js"), "utf8");

describe("artist song post action", () => {
  it("exposes Post song in the mounted new-song composer", () => {
    const musicTab = shell.slice(shell.indexOf('{workspace && tab === "Music"'));
    expect(musicTab).toContain('"Save draft"');
    expect(musicTab).toContain('>Post song</button>');
    expect(musicTab).toContain("saveSong(null, true)");
  });

  it("saves a new song before publishing it and updates the live state", () => {
    const saveHandler = shell.slice(shell.indexOf("const saveSong = async"), shell.indexOf("const saveAlbum = async"));
    expect(saveHandler).toContain("createArtistSong(artist.id, account.user.id, payload)");
    expect(saveHandler).toContain('setArtistSongStatus(saved.id, "PUBLISHED")');
    expect(saveHandler).toContain('status: publishAfterSave ? "PUBLISHED" : saved.status');
    expect(saveHandler).toContain('"Song posted to the live catalog."');
  });

  it("keeps the publish operation on the canonical user service", () => {
    expect(services).toContain("export async function setArtistSongStatus");
    expect(services).toContain("rpc(\"set_artist_song_status\"");
  });
});
