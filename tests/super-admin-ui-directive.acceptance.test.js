import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/eventverse";
const source = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("linked Super Admin UI directive", () => {
  it("exposes every required control-plane module", () => {
    for (const label of [
      "Users", "Artists", "Organizers", "Venue Managers", "Event Staff", "Admins",
      "Applications", "Verification", "Events", "Tickets", "Payments", "Wallets",
      "Analytics", "Moderation", "Support", "Settings", "Audit Logs",
    ]) {
      expect(source).toContain(`["${label}"`);
    }
    expect(source).toContain("Control modules");
    expect(source).toContain("Open live workflow");
  });

  it("routes module actions through existing screens and preserves Super Admin authorization", () => {
    expect(source).toContain("hasEffectiveRole(account, \"SUPER_ADMIN\")");
    expect(source).toContain("nav.push(screen, { adminModule: label })");
    expect(source).toContain("Every action remains server-authorized and audit logged.");
  });
});
