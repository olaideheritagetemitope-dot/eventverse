import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/eventverse";
const source = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const designSystem = fs.readFileSync(path.join(root, "src/ui/designSystem.js"), "utf8");

describe("Atizzy permanent design system shell", () => {
  it("preserves the original structural visual primitives", () => {
    for (const primitive of ["Phone", "TopBack", "GoldButton", "GhostButton", "Pill", "EventCard", "BottomNav", "MiniPlayer", "Section"]) {
      expect(source).toMatch(new RegExp(`function ${primitive}\\b`));
    }
    expect(source).toContain("Search events, artists, venues...");
    expect(source).toContain("Featured event content will appear here when published.");
  });

  it("uses a shared token and backend-resource contract", () => {
    expect(source).toContain("ATIZZY_TOKENS");
    expect(source).toContain("normalizeCatalog(merged)");
    expect(source).toContain("resourceState({ loading, error, data: events })");
    expect(designSystem).toContain("export const ATIZZY_MODULES");
    expect(designSystem).toContain('status: loading ? "loading"');
    expect(designSystem).toContain("export function normalizeCatalog");
  });
});
