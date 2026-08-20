import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/0024_event_staff_shifts.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("event staff shift and attendance contract", () => {
  it("constrains shift ordering and exposes an organizer-only mutation RPC", () => {
    expect(migration).toContain("event_staff_shift_order_check");
    expect(migration).toContain("Only the event owner can schedule staff shifts");
    expect(service).toContain("update_event_staff_shift");
  });

  it("persists organizer instructions and shift fields through the assignment flow", () => {
    expect(app).toContain("staffInstructions");
    expect(app).toContain("staffShiftStartsAt");
    expect(app).toContain("updateEventStaffShift(assignment.id");
    expect(app).toContain("Shift:");
  });

  it("keeps organizer attendance counters sourced from the dashboard RPC", () => {
    expect(service).toContain("get_organizer_event_dashboard");
    expect(app).toContain("dashboard?.attendees");
    expect(app).toContain("dashboard?.check_ins");
  });
});
