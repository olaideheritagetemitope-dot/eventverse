import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const discovery = fs.readFileSync(path.join(root, "src/services/discovery.js"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/services/catalog.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("music-video cover hydration", () => {
  it("normalizes all discovery video collections through the canonical transformer", () => {
    expect(discovery).toContain("toMusicVideo");
    expect(discovery).toContain("const normalizeMusicVideos");
    expect(discovery).toContain("mostWatchedMusicVideos: normalizeMusicVideos(value.mostWatchedMusicVideos)");
    expect(discovery).toContain("latestMusicVideos: normalizeMusicVideos(value.latestMusicVideos)");
    expect(discovery).toContain("allMusicVideos: normalizeMusicVideos(value.allMusicVideos)");
    expect(discovery).toContain("const normalizeMusicVideos = (rows) => asArray(rows).map((row) => toMusicVideo(row));");
    expect(discovery).not.toContain("Object.prototype.hasOwnProperty.call(row, \"thumbnailUrl\") || Object.prototype.hasOwnProperty.call(row, \"videoUrl\")");
  });

  it("resolves live thumbnail_url values into the thumbnailUrl card contract", () => {
    expect(catalog).toContain("thumbnailUrl: mediaUrl(video.thumbnail_url || video.thumbnailUrl || video.cover_url)");
    expect(app).toContain("thumbnailUrl");
    expect(app).toContain("backgroundImage");
  });
});
