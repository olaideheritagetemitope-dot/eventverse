import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("Organizer workflow acceptance contracts", () => {
  it("contains the server-authoritative onboarding and event lifecycle contracts", () => {
    const service = read("src/services/user.js");
    const migration = read("supabase/0012_organizer_workflow.sql");
    const app = read("src/EventVerse.jsx");
    expect(service).toContain("applyAsOrganizer");
    expect(service).toContain("createOrganizerEvent");
    expect(service).toContain("addOrganizerTicketType");
    expect(service).toContain("publishOrganizerEvent");
    expect(service).toContain("loadOrganizerEventDashboard");
    expect(migration).toContain("organizer_applications");
    expect(migration).toContain("apply_as_organizer");
    expect(migration).toContain("publish_organizer_event");
    expect(migration).toContain("cancel_organizer_event");
    expect(migration).toContain("get_organizer_event_dashboard");
    expect(app).toContain("Become an Organizer");
    expect(app).toContain("Create an event");
    expect(app).toContain("Publish after validation");
    expect(app).toContain("Associate Artist");
  });
});
