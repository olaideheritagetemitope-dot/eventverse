import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const registry = fs.readFileSync(path.join(root, "src/components/SuperAdminModuleRegistry.jsx"), "utf8");
const eventVerse = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const directive = fs.readFileSync(path.join(root, "docs/attached-super-admin-restoration-directive.md"), "utf8");

describe("Super Admin dashboard restoration directive", () => {
  it("exposes the required governance modules", () => {
    for (const label of ["Overview", "All Users", "Artists", "Organizers", "Venue Managers", "Event Staff", "Admins", "Applications", "Verification", "Events", "Tickets", "Payments", "Wallets & Refunds", "Niche Analytics", "Moderation", "Support", "Audit Logs", "Policies & Fees", "System Health"]) {
      expect(registry).toContain(`label: "${label}"`);
    }
  });

  it("uses live snapshot/event props and protected action callbacks instead of fabricated records", () => {
    expect(registry).toContain("snapshot?.users");
    expect(registry).toContain("snapshot?.applications");
    expect(registry).toContain("snapshot?.wallets");
    expect(registry).toContain("analytics.likes");
    expect(registry).toContain("onSuspend");
    expect(registry).toContain("onReview");
    expect(registry).toContain("onEventStatus");
    expect(eventVerse).toContain("<SuperAdminModuleRegistry");
    expect(eventVerse).toContain("adminSetEventStatus");
    expect(eventVerse).toContain("reviewRoleApplication");
  });

  it("preserves the directive's server-authoritative and structural-preservation requirements", () => {
    expect(directive).toContain("real backend action");
    expect(directive).toContain("preserving the existing Atizzy");
    expect(eventVerse).toContain("Super Admin Control Center");
    expect(eventVerse).toContain("User directory");
    expect(eventVerse).toContain("Event lifecycle controls");
  });
});
