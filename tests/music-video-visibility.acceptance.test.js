import fs from "node:fs";
import { describe, expect, it } from "vitest";

const catalog = fs.readFileSync(new URL("../src/services/catalog.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");

describe("music video visibility contract", () => {
  it("loads published music videos in the live base catalog and artist detail", () => {
    expect(catalog).toContain('musicVideos: () => supabase.from("music_videos")');
    expect(catalog).toContain("song_id");
    expect(catalog).toContain("linkedSong: video.songs ? toSong(video.songs) : null");
    expect(catalog).toContain('.eq("status", "PUBLISHED").not("video_url", "is", null)');
    expect(catalog).toContain('musicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo)');
    expect(catalog).toContain('latestMusicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo)');
    expect(catalog).toContain('allMusicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo)');
  });

  it("resolves a canonical published linked video when a Song has no legacy video URL", () => {
    expect(catalog).toContain("export async function loadMusicVideoForSong(songId)");
    expect(catalog).toContain('.eq("song_id", songId).eq("status", "PUBLISHED")');
    expect(catalog).toContain('.not("video_url", "is", null)');
    expect(app).toContain("loadMusicVideoForSong(song.id)");
    expect(app).toContain("setVideo(directVideoUrl ? { videoUrl: directVideoUrl, thumbnailUrl: directThumbnailUrl, title: song.title, artist: song.artist } : related)");
    expect(app).toContain("const videoUrl = video?.videoUrl || video?.musicVideoUrl || null");
    expect(app).toContain("if ((song.videoUrl || song.musicVideoUrl || song.video_url) && !(song.audioUrl || song.audio_url)) return <MusicVideoDetail");
  });

  it("normalizes raw Supabase video fields before the audio-player guard", () => {
    expect(app).toContain("song?.video_url");
    expect(app).toContain("song?.thumbnail_url");
    expect(app).toContain("(song.videoUrl || song.musicVideoUrl || song.video_url)");
    expect(app).toContain("!(song.audioUrl || song.audio_url)");
    expect(app).toContain("videoUrl: song.videoUrl || song.musicVideoUrl || song.video_url");
  });

  it("renders live videos on Music and Artist Profile surfaces", () => {
    expect(app).toContain('Section title="Music Videos" nav={nav}');
    expect(app).toContain('["Popular", "Songs", "Albums", "Music Videos", "Events", "About"]');
    expect(app).toContain('tab === "Music Videos"');
    expect(app).toContain('video.videoUrl || video.musicVideoUrl');
    expect(app).toContain('Standalone music video');
    expect(app).toContain('Link to song (optional)');
    expect(app).toContain('function MusicVideoDetail');
  });

  it("uses a dedicated route for every Music Video card", () => {
    expect(app).toContain('nav.push("musicVideoDetail", { ...video, musicVideoUrl: video.videoUrl || video.musicVideoUrl })');
    expect(app).toContain('nav.push("musicVideoDetail", { ...video, musicVideoUrl: video.videoUrl || video.musicVideoUrl, artist: video.artist || a.name })');
    expect(app).toContain('musicVideoDetail: <MusicVideoDetail nav={nav} video={current.data} player={player} account={account} />');
  });

  it("does not rely on the overloaded Song detail route for Music Video cards", () => {
    expect(app).not.toContain('nav.push("musicDetail", { ...video, musicVideoUrl: video.videoUrl || video.musicVideoUrl })');
    expect(app).not.toContain('nav.push("musicDetail", { ...video, musicVideoUrl: video.videoUrl || video.musicVideoUrl, artist: video.artist || a.name })');
  });
});
