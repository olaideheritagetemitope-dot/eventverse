import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0026_super_admin_effective_roles.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("Atizzy universal SUPER_ADMIN capability architecture", () => {
  it("computes effective roles from the live app_role enum and keeps assigned roles separate", () => {
    expect(migration).toContain("create or replace function public.effective_app_roles()");
    expect(migration).toContain("select e.enumlabel::public.app_role");
    expect(migration).toContain("r.code = 'SUPER_ADMIN'::public.app_role");
    expect(migration).toContain("create or replace function public.get_current_role_context()");
    expect(service).toContain('supabase.rpc("get_current_role_context")');
    expect(service).toContain("effectiveRoles:");
    expect(service).toContain("primaryRole:");
  });

  it("centralizes workspace authorization without changing primary role on navigation", () => {
    expect(app).toContain("const effectiveRoleCodes = (account)");
    expect(app).toContain("const hasEffectiveRole = (account, role)");
    expect(app).toContain("Your primary account role and backend authorization never change.");
    expect(app).toContain('roles.includes("EVENT_STAFF")');
    expect(app).toContain('nav.push("eventStaff")');
    expect(app).toContain('eventStaff: <EventStaffWorkspace');
    expect(app).toContain('roles.includes("ARTIST")');
    expect(app).toContain('roles.includes("ORGANIZER")');
    expect(app).toContain('roles.includes("VENUE_MANAGER")');
    expect(app).toContain('roles.includes("ADMIN")');
    expect(app).not.toContain('account.primaryRole = "ARTIST"');
    expect(app).not.toContain('account.primaryRole = "ORGANIZER"');
    expect(app).not.toContain('account.primaryRole = "VENUE_MANAGER"');
  });

  it("preserves security-definer authorization and RLS recursion safeguards", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("public.has_app_role(required_role)");
    expect(migration).toContain("public.has_any_app_role(required_roles public.app_role[])");
    expect(migration).not.toContain("alter table public.orders disable row level security");
    expect(migration).not.toContain("drop policy");
  });
});
