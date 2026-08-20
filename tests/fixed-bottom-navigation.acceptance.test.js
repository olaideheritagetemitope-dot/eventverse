import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");

describe("fixed transparent bottom navigation", () => {
  it("keeps the existing five destinations and active route semantics", () => {
    expect(app).toContain('{ id: "home", label: "Home", icon: Home }');
    expect(app).toContain('{ id: "explore", label: "Explore", icon: Compass }');
    expect(app).toContain('{ id: "music", label: "Music", icon: Music2 }');
    expect(app).toContain('{ id: "tickets", label: "Tickets", icon: Ticket }');
    expect(app).toContain('{ id: "profile", label: "Profile", icon: User }');
    expect(app).toContain('go(it.id)');
    expect(app).toContain('aria-current={active ? "page" : undefined}');
  });

  it("uses a fixed, translucent, safe-area-aware dock above content", () => {
    expect(app).toContain('<nav className="ev-bottom-nav" aria-label="Primary navigation">');
    expect(styles).toContain(".ev-bottom-nav { position: fixed;");
    expect(styles).toContain("bottom: 0;");
    expect(styles).toContain("z-index: 30;");
    expect(styles).toContain("background: rgba(11,10,8,.78)");
    expect(styles).toContain("backdrop-filter: blur(18px)");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain(".ev-app-frame:has(.ev-bottom-nav) .overflow-y-auto");
  });

  it("provides accessible touch targets and prevents narrow-screen overflow", () => {
    expect(styles).toContain("min-width: 44px");
    expect(styles).toContain("min-height: 44px");
    expect(styles).toContain("@media (max-width: 360px)");
    expect(app).toContain('aria-label={`Go to ${it.label}`}');
    expect(app).toContain('type="button"');
  });

  it("keeps the branded pattern below the navigation layer", () => {
    expect(styles).toContain(".ev-atizzy-pattern");
    expect(styles).toContain(".ev-bottom-nav { position: fixed");
    expect(styles).toContain("z-index: 30");
  });
});
