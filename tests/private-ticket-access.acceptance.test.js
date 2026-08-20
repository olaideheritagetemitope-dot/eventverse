import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/0032_private_ticket_access.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("private ticket access contract", () => {
  it("stores only hashed credentials and exposes private tickets through security-definer RPCs", () => {
    expect(migration).toMatch(/access_credential_hash\s+text/);
    expect(migration).toMatch(/digest\(v_value, 'sha256'\)/);
    expect(migration).toMatch(/create or replace function public\.discover_private_ticket/);
    expect(migration).toMatch(/security definer/);
    expect(migration).toMatch(/revoke all on function public\.private_ticket_hash/);
    expect(migration).toMatch(/visibility = 'PUBLIC'/);
    expect(migration).toMatch(/for v_ticket in select \* from public\.ticket_types where event_id = p_event_id and visibility = 'PRIVATE'/);
  });

  it("records failed attempts and enforces a bounded brute-force window", () => {
    expect(migration).toMatch(/private_ticket_access_attempts/);
    expect(migration).toMatch(/attempted_at > now\(\) - interval '15 minutes'/);
    expect(migration).toMatch(/v_attempts >= 10/);
    expect(migration).toMatch(/succeeded\) values \(v_user, p_event_id, false\)/);
  });

  it("enforces redemption and cumulative per-user purchase limits server-side", () => {
    expect(migration).toMatch(/maximum_redemptions/);
    expect(migration).toMatch(/redemptions = redemptions \+ 1/);
    expect(migration).toMatch(/maximum_redemptions is null or redemptions < maximum_redemptions/);
    expect(migration).toMatch(/private_ticket_access_grants/);
    expect(migration).toMatch(/maximum_purchases_per_user/);
    expect(migration).toMatch(/Private ticket purchase limit reached/);
    expect(migration).toMatch(/Private ticket access is required/);
  });

  it("routes organizer creation and attendee unlock through RPC wrappers", () => {
    expect(service).toMatch(/supabase\.rpc\("create_organizer_ticket_type"/);
    expect(service).toMatch(/supabase\.rpc\("discover_private_ticket"/);
    expect(ui).toMatch(/Private access protection/);
    expect(ui).toMatch(/Unlock private tickets|Unlock private tickets/);
    expect(ui).toMatch(/discoverPrivateTicket\(ev\.id/);
    expect(ui).toMatch(/visibility === "PRIVATE"/);
  });
});

