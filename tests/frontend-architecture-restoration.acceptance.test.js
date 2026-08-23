import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/eventverse";
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/services/catalog.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");

describe("linked frontend architecture restoration directive", () => {
  it("preserves the original cards, boards, pills, sections, navigation, player, and detail structures", () => {
    for (const structure of ["ev-card", "ev-pill", "ev-section", "ev-bottom-nav", "ev-mini-player", "EventCard", "EventDetail", "MusicDetail", "BottomNav"]) {
      expect(`${app}\n${styles}`).toContain(structure);
    }
    expect(app).toContain("const nav = {");
    expect(app).toContain('home: <AttendeeHome');
    expect(app).toContain('eventDetail: <EventDetail');
    expect(app).toContain('musicDetail: <MusicDetail');
  });

  it("uses live catalog services and explicit state boundaries instead of prototype catalog records", () => {
    expect(app).toContain('import { loadCatalog');
    expect(app).toContain("const liveCatalog = await loadCatalog();");
    expect(app).toContain("normalizeCatalog(merged)");
    expect(app).toContain("loadDiscoverySnapshot(location)");
    expect(app).toContain("resourceState({ loading, error, data: events })");
    expect(catalog).toContain('supabase.from("events")');
    expect(catalog).toContain('supabase.from("artists")');
    expect(catalog).toContain('supabase.from("songs")');
    expect(catalog).toContain('supabase.from("venues")');
    expect(app).not.toMatch(/Renile|MOCK_EVENTS|MOCK_ARTISTS|MOCK_SONGS/);
  });
});
