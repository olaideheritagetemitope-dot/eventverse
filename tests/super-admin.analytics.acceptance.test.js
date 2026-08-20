import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0018_super_admin_analytics.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

const has = (source, value) => expect(source).toContain(value);

describe("Atizzy Super Admin analytics acceptance", () => {
  it("uses a protected server aggregate instead of client-side table summation", () => {
    has(migration, "get_super_admin_analytics");
    has(migration, "SUPER_ADMIN");
    has(migration, "payments_successful");
    has(migration, "venue_payments_successful");
    has(service, 'supabase.rpc("get_super_admin_analytics")');
  });

  it("includes live revenue, ticket, check-in, and published-event metrics", () => {
    has(migration, "ticket_revenue");
    has(migration, "venue_revenue");
    has(migration, "tickets_checked_in");
    has(migration, "events_published");
  });

  it("renders analytics only for Super Admins in the existing role center", () => {
    has(ui, 'roles.includes("SUPER_ADMIN") && analytics');
    has(ui, "Live platform analytics");
    has(ui, "Verified revenue");
    has(ui, "Tickets issued");
    has(ui, "Checked in");
    has(ui, "Published events");
  });
});
