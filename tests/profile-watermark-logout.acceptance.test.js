import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");

describe("Atizzy watermark and Profile Logout correction", () => {
  it("tunes the existing single watermark layer to be visible but subdued", () => {
    expect(styles).toContain(".ev-atizzy-pattern");
    expect(styles).toContain("url('/assets/atizzy-pattern.png')");
    expect(styles).toContain("opacity: .46");
    expect(styles).toContain("opacity: .38");
    expect(styles).toContain("pointer-events: none");
    expect(styles).not.toContain(".ev-atizzy-pattern::before");
    expect((styles.match(/url\('\/assets\/atizzy-pattern\.png'\)/g) || []).length).toBe(1);
  });

  it("places one accessible Logout action in the Profile header", () => {
    expect(app).toContain('aria-label="Log out of Atizzy"');
    expect(app).toContain("<LogOut size={14} aria-hidden=\"true\" />");
    expect(app).toContain("{busy ? \"Signing out...\" : \"Log out\"}");
    expect(app).toContain("onClick={signOut}");
    expect(app).not.toContain('className="w-full py-3 rounded-2xl text-[13px] font-semibold" style={{ background: C.card, color: busy ? C.muted : "#E98979"');
  });

  it("preserves fixed navigation and server/auth boundaries", () => {
    expect(app).toContain('<BottomNav current="profile" go={nav.tab} />');
    expect(styles).toContain(".ev-bottom-nav { position: fixed;");
    expect(app).toContain("await supabase.auth.signOut(); nav.reset(\"login\");");
    expect(app).toContain("function Profile({ nav, player, account })");
  });
});
