import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0042_admin_governance_event_snapshot.sql"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("authoritative Super Admin governance event directory", () => {
  it("loads governance events through the protected RPC", () => {
    expect(service).toContain('supabase.rpc("admin_governance_event_snapshot")');
    expect(service).not.toContain('from("events")\n    .select("id,title,status,starts_at,ends_at,city,organizer_id,updated_at")');
  });

  it("enforces Super Admin access and least-privilege execute grants server-side", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("public.is_super_admin()");
    expect(migration).toContain("revoke all on function public.admin_governance_event_snapshot() from public;");
    expect(migration).toContain("grant execute on function public.admin_governance_event_snapshot() to authenticated;");
  });

  it("keeps the existing governance dashboard and event controls present", () => {
    expect(app).toContain("GovernanceDashboard");
    expect(app).toContain("adminSetEventStatus");
    expect(app).toContain("loadGovernanceEvents");
  });
});
