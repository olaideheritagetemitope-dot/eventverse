import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("live playback synchronization", () => {
  it("uses the real audio element as the source of current time and duration", () => {
    expect(app).toContain('audio.addEventListener("timeupdate", sync)');
    expect(app).toContain('audio.addEventListener("loadedmetadata", sync)');
    expect(app).toContain('audio.addEventListener("durationchange", sync)');
    expect(app).toContain('onProgress?.({');
    expect(app).toContain('currentTime: Number.isFinite(audio.currentTime)');
    expect(app).toContain('duration: Number.isFinite(audio.duration)');
  });

  it("binds the existing full-player progress surface to live state and supports seeking", () => {
    expect(app).toContain('role="slider"');
    expect(app).toContain('aria-label="Seek through song"');
    expect(app).toContain('player.seek(ratio * totalDuration)');
    expect(app).toContain('formatPlaybackTime(player.currentTime)');
    expect(app).toContain('style={{ width: `${progressPercent}%`, background: C.gold }}');
    expect(app).not.toContain('style={{ width: "38%", background: C.gold }}');
    expect(app).not.toContain('>1:32</span>');
  });

  it("keeps one root player state and resets position when changing tracks", () => {
    expect(app).toContain('const [playback, setPlayback] = useState({ currentTime: 0, duration: 0 });');
    expect(app).toContain('currentTime: playback.currentTime');
    expect(app).toContain('duration: playback.duration');
    expect(app).toContain('ref={audioControllerRef}');
    expect(app).toContain('onProgress={setPlayback}');
    expect(app).toContain('seek: (seconds) => audioControllerRef.current?.seekTo(seconds)');
  });
});

