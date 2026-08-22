import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("swipeable Now Playing experience", () => {
  it("keeps the existing Now Playing controls inside the first page", () => {
    expect(app).toContain('function FullPlayer({ nav, player, account })');
    expect(app).toContain('player.previous');
    expect(app).toContain('player.next');
    expect(app).toContain('aria-label={player.playing ? "Pause song" : "Play song"}');
    expect(app).toContain('Seek through song');
    expect(app).toContain('formatPlaybackTime(player.currentTime)');
    const firstPageStart = app.indexOf('className="h-full min-w-0 w-1/3 flex-shrink-0 flex flex-col px-6 overflow-y-auto"');
    const lyricsPageStart = app.indexOf('<LyricsPage song={song} player={player} />');
    const firstPage = app.slice(firstPageStart, lyricsPageStart);
    expect(firstPage).toContain('Close now playing');
    expect(firstPage).toContain('Open music library');
    expect(firstPage).toContain('song.coverUrl');
    expect(firstPage).toContain('song.title');
    expect(firstPage).toContain('Like song');
    expect(firstPage).toContain('Seek through song');
    expect(firstPage).toContain('Shuffle');
    expect(firstPage).toContain('Previous song');
    expect(firstPage).toContain('Pause song');
    expect(firstPage).toContain('Next song');
    expect(firstPage).toContain('Repeat');
    expect(firstPage).toContain('Share song');
    expect(firstPage).toContain('Add to Playlist');
    expect(firstPage).toContain('Open playlists');
  });

  it("implements an intentional three-page horizontal pager with indicators", () => {
    expect(app).toContain('["Now Playing", "Lyrics", "Music Video"]');
    expect(app).toContain('Math.abs(dx) < 72');
    expect(app).toContain('current + (dx < 0 ? 1 : -1)');
    expect(app).toContain('translateX(-${page * (100 / 3)}%)');
    expect(app).toContain('aria-label="Now Playing pages"');
  });

  it("uses the same global player for lyrics and video pages", () => {
    expect(app).toContain('<LyricsPage song={song} player={player} />');
    expect(app).toContain('<MusicVideoPage song={song} player={player} />');
    expect(app).toContain('Audio playback stays with the global Atizzy player.');
    expect(app).not.toContain('new Audio(song.musicVideoUrl)');
  });

  it("renders live data and friendly states without invented media", () => {
    expect(app).toContain('const lyrics = song?.lyricsText;');
    expect(app).toContain('const videoUrl = song?.musicVideoUrl;');
    expect(app).toContain("Lyrics aren&apos;t available for this song yet.");
    expect(app).toContain("No music video available yet.");
    expect(app).toContain('onError={() => { setLoading(false); setFailed(true); }}');
    expect(app).toContain('Playing {formatPlaybackTime(player.currentTime)}');
  });
});
