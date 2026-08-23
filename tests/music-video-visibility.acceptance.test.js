import fs from "node:fs";
import { describe, expect, it } from "vitest";

const catalog = fs.readFileSync(new URL("../src/services/catalog.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");

describe("music video visibility contract", () => {
  it("loads published music videos in the live base catalog and artist detail", () => {
    expect(catalog).toContain('musicVideos: () => supabase.from("music_videos")');
    expect(catalog).toContain('.eq("status", "PUBLISHED").not("video_url", "is", null)');
    expect(catalog).toContain('musicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo)');
    expect(catalog).toContain('latestMusicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo)');
    expect(catalog).toContain('allMusicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo)');
  });

  it("renders live videos on Music and Artist Profile surfaces", () => {
    expect(app).toContain('Section title="Music Videos" nav={nav}');
    expect(app).toContain('["Popular", "Songs", "Albums", "Music Videos", "Events", "About"]');
    expect(app).toContain('tab === "Music Videos"');
    expect(app).toContain('video.videoUrl || video.musicVideoUrl');
  });
});
