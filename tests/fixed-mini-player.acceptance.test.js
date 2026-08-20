import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");

describe("fixed mini player directive", () => {
  it("renders only for an active song and uses the live player state", () => {
    expect(app).toContain("if (!song) return null;");
    expect(app).toContain("song={player.song}");
    expect(app).toContain("playing={player.playing}");
    expect(app).toContain("onToggle={player.toggle}");
  });

  it("keeps full-player, playback, and menu controls accessible", () => {
    expect(app).toContain('aria-label={`Open player for ${song.title || "current song"}`}');
    expect(app).toContain('aria-label={playing ? "Pause current song" : "Play current song"}');
    expect(app).toContain('aria-label="Open player options"');
    expect(app).toContain("MoreVertical");
    expect(app).toContain('onOpen={() => nav.push("musicPlayer")}');
  });

  it("places the player above the fixed navigation and clears scroll content", () => {
    expect(styles).toMatch(/\.ev-mini-player\s*\{[^}]*position:\s*fixed/);
    expect(styles).toMatch(/\.ev-mini-player\s*\{[^}]*bottom:\s*calc\(78px/);
    expect(styles).toMatch(/\.ev-bottom-nav\s*\{[^}]*position:\s*fixed/);
    expect(styles).toContain(".ev-app-frame:has(.ev-mini-player) .overflow-y-auto");
    expect(styles).toContain("padding-bottom: calc(11.5rem");
  });

  it("keeps the fixed surfaces responsive and pointer-safe", () => {
    expect(styles).toContain("pointer-events: none");
    expect(styles).toContain("pointer-events: auto");
    expect(styles).toContain("@media (min-width: 681px)");
    expect(styles).toContain("@media (max-width: 360px)");
    expect(styles).toContain("env(safe-area-inset-bottom)");
  });
});
