import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const catalog = fs.readFileSync(path.join(root, "src/services/catalog.js"), "utf8");
const discovery = fs.readFileSync(path.join(root, "src/services/discovery.js"), "utf8");
const rankedDiscoverySql = fs.readFileSync(path.join(root, "supabase/0107_discovery_artist_identity_hydration.sql"), "utf8");

describe("published song artist status contract", () => {
  it("maps live RPC artist labels before the pending fallback", () => {
    expect(catalog).toContain("song.artists?.name || song.artist || song.artist_name || song.artistName || song.artist_profile_name || \"Artist pending\"");
    const songTransformer = catalog.slice(catalog.lastIndexOf("export const toSong"));
    expect(songTransformer.indexOf("song.artist || song.artist_name")).toBeLessThan(songTransformer.indexOf("\"Artist pending\""));
    expect(discovery).toContain("const normalizeSongs");
    expect(discovery).toContain("toSong(row)");
    expect(rankedDiscoverySql).toContain("a.name as artist");
    expect(rankedDiscoverySql).toContain("left join public.artists a on a.id=s.artist_id");
    expect(rankedDiscoverySql).toContain("a.name as artist,a.image_url as artist_image");
  });

  it("keeps Artist pending only for rows without an authoritative artist label", () => {
    expect(catalog).toContain("|| \"Artist pending\"");
    expect(catalog).not.toContain("artist: \"Artist pending\"");
  });
});
