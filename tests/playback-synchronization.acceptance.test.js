import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("live playback synchronization", () => {
  it("uses the real audio element as the source of current time and duration", () => {
    expect(app).toContain('["loadedmetadata", "loadeddata", "durationchange", "timeupdate"');
    expect(app).toContain('audio.addEventListener(eventName, sync)');
    expect(app).toContain('audio.addEventListener("playing", playStarted)');
    expect(app).toContain('audio.addEventListener("pause", playbackStopped)');
    expect(app).toContain('onProgress?.({');
    expect(app).toContain('const duration = Number.isFinite(audio.duration)');
    expect(app).toContain('const rawCurrentTime = Number.isFinite(audio.currentTime)');
    expect(app).toContain('onProgress?.({ currentTime, duration });');
  });

  it("keeps position continuously live while playing and freezes it when paused", () => {
    expect(app).toContain('frameRef = useRef(null)');
    expect(app).toContain('requestAnimationFrame(tick)');
    expect(app).toContain('if (!audio.paused && !audio.ended)');
    expect(app).toContain('audio.pause();\n      syncProgress(audio);\n      stopProgressLoop();');
    expect(app).toContain('syncProgress(audio, { forceEnd: true })');
  });

  it("uses only loaded media metadata for the displayed duration", () => {
    expect(app).toContain('const totalDuration = Number(player.duration || 0);');
    expect(app).not.toContain('player.duration || Number(song?.duration_seconds || 0)');
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

