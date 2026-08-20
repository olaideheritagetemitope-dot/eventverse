import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const sourceFiles = [
  "src/EventVerse.jsx",
  "src/services/catalog.js",
  "src/services/user.js",
  "src/components/CheckInScreen.jsx",
  "api/paystack/initialize.js",
  "api/paystack/artist-initialize.js",
  "api/paystack/webhook.js",
  "supabase/0001_eventverse_core.sql",
  "supabase/0002_eventverse_rls.sql",
  "supabase/0006_verified_ticket_issuance_checkin.sql",
  "supabase/0011_artist_registration_verification.sql",
  "supabase/0012_organizer_workflow.sql",
];

describe("Shared Atizzy directive acceptance contracts", () => {
  it("keeps discovery and role UI while sourcing operational data from Supabase", () => {
    const app = read("src/EventVerse.jsx");
    const catalog = read("src/services/catalog.js");
    expect(app).toContain("loadCatalog");
    expect(app).toContain("CheckInScreen");
    expect(catalog).toContain('supabase.from("events")');
    expect(catalog).toContain('supabase.from("artists")');
    expect(catalog).toContain('supabase.from("songs")');
  });

  it("contains the authoritative payment-to-ticket-to-check-in chain", () => {
    const initialize = read("api/paystack/initialize.js");
    const webhook = read("api/paystack/webhook.js");
    const commerceMigration = read("supabase/0006_verified_ticket_issuance_checkin.sql");
    const checkIn = read("src/components/CheckInScreen.jsx");
    expect(initialize).toContain("initialize_order_payment");
    expect(webhook).toContain("verify_payment_and_issue_tickets");
    expect(commerceMigration).toContain("insert into public.tickets");
    expect(commerceMigration).toContain("check_in_ticket");
    expect(checkIn).toContain("checkInTicketWithToken");
  });

  it("contains ownership-safe RLS and role activation contracts", () => {
    const rls = read("supabase/0002_eventverse_rls.sql");
    const artist = read("supabase/0011_artist_registration_verification.sql");
    const organizer = read("supabase/0012_organizer_workflow.sql");
    expect(rls).toContain("enable row level security");
    expect(artist).toContain("activate_artist_fee_transaction");
    expect(artist).toContain("insert into public.user_roles");
    expect(organizer).toContain("apply_as_organizer");
    expect(organizer).toContain("publish_organizer_event");
    expect(organizer).toContain("get_organizer_event_dashboard");
  });

  it("does not ship fabricated catalog fixtures or demo records", () => {
    for (const file of sourceFiles) {
      const content = read(file);
      expect(content).not.toMatch(/mock data|demo data|sample event|fixture record/i);
    }
  });
});
