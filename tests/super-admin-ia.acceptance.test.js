import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const registry = fs.readFileSync(path.join(root, "src/components/SuperAdminModuleRegistry.jsx"), "utf8");
const audit = fs.readFileSync(path.join(root, "docs/super-admin-ia-audit.md"), "utf8");
const eventVerse = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("Super Admin grouped information architecture", () => {
  it("exposes every directive category and nested operational area", () => {
    for (const label of ["Overview", "People", "Verification", "Content", "Events", "Tickets & Payments", "Moderation", "Analytics", "Communications", "System Control", "Settings"]) {
      expect(registry).toContain(`label: "${label}"`);
    }
    for (const id of ["users", "applications", "events", "payments", "wallets", "analytics", "support", "roleCapabilities", "audit", "system"]) {
      expect(registry).toContain(`id: "${id}"`);
    }
  });

  it("keeps the new shell live-data-only and action-capable", () => {
    for (const token of ["snapshot?.users", "snapshot?.applications", "snapshot?.wallets", "events.map", "searchResults", "onSuspend", "onReview", "onEventStatus", "ActionMenu", "Super Admin", "No live records"]) {
      expect(registry).toContain(token);
    }
    expect(eventVerse).toContain("<SuperAdminModuleRegistry");
    expect(eventVerse).toContain("adminControlCenter: <GovernanceDashboard");
    expect(eventVerse).toContain("governanceDashboard: <GovernanceDashboard");
    expect(eventVerse).toContain("reviewRoleApplication");
    expect(eventVerse).toContain("adminSetEventStatus");
  });

  it("renders authoritative global metrics instead of page-local totals", () => {
    for (const token of ["snapshot?.user_counts", "snapshot?.application_counts", "snapshot?.event_lifecycle", "snapshot?.wallet_totals", "userCounts.total", "applicationCounts.pending", "eventLifecycle.past", "walletTotals.balance"]) {
      expect(registry).toContain(token);
    }
    expect(registry).not.toContain('value={users.length}');
    expect(registry).not.toContain('value={pending.length}');
    expect(registry).not.toContain('value={events.length}');
  });

  it("documents compatibility preservation and existing route coverage", () => {
    for (const token of ["all current routes", "compatibility route", "server-authoritative", "No counts, users, events, payments, tickets, analytics, or content may be fabricated"]) {
      expect(audit).toContain(token);
    }
  });
});
