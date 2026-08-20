import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/0020_event_operations_responsibilities.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const checkIn = fs.readFileSync(path.join(root, "src/components/CheckInScreen.jsx"), "utf8");

describe("Event Operations responsibility contracts", () => {
  it("keeps Security/Gate and other responsibilities assignment-scoped", () => {
    expect(migration).toContain("SECURITY_GATE");
    expect(migration).toContain("CHECK_IN");
    expect(migration).toContain("REGISTRATION");
    expect(migration).toContain("EVENT_OPERATIONS");
    expect(migration).toContain("event_staff_can_check_in");
    expect(migration).toContain("a.status = 'ACCEPTED'");
    expect(migration).toContain("a.responsibility in ('CHECK_IN','REGISTRATION','SECURITY_GATE')");
    expect(migration).not.toContain("create role security");
  });

  it("supports explicit accept/reject entry decisions with invalid and used-ticket outcomes", () => {
    expect(migration).toContain("event_staff_entry_decision");
    expect(migration).toContain("INVALID_TOKEN");
    expect(migration).toContain("ALREADY_USED");
    expect(migration).toContain("STAFF_REJECTED");
    expect(migration).toContain("attendance_recorded");
    expect(service).toContain('supabase.rpc("event_staff_entry_decision"');
  });

  it("passes responsibility and event context into the existing scanner UI", () => {
    expect(app).toContain('nav.push("checkIn", { responsibility: item.responsibility, eventTitle: item.event_title })');
    expect(app).toContain('checkIn: <CheckInScreen nav={nav} data={current.data} />');
    expect(checkIn).toContain('eventStaffEntryDecision(token, "ACCEPT")');
    expect(checkIn).toContain('eventStaffEntryDecision(qrToken.trim(), "REJECT")');
    expect(checkIn).toContain("Reject entry");
    expect(checkIn).toContain("already used");
  });
});
