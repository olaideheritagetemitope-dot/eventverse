import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0034_delegated_admin_capabilities.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("Atizzy role capability system", () => {
  it("stores delegated Admin grants and preserves universal Super Admin authority", () => {
    expect(migration).toContain("create table if not exists public.admin_permission_grants");
    expect(migration).toContain("create or replace function public.has_admin_permission");
    expect(migration).toContain("public.has_app_role('SUPER_ADMIN'::public.app_role)");
    expect(migration).toContain("create or replace function public.set_admin_permission");
    expect(migration).toContain("Super Admin access required");
  });

  it("exposes live role capability and delegated permission contracts", () => {
    expect(migration).toContain("create or replace function public.role_capability_matrix");
    const catalogMigration = fs.readFileSync(path.join(root, "supabase/0035_admin_capability_catalog.sql"), "utf8");
    expect(catalogMigration).toContain("delegated_grant_required");
    expect(catalogMigration).toContain("r.code = 'ADMIN'::public.app_role");
    expect(migration).toContain("create or replace function public.list_admin_permission_grants");
    expect(service).toContain('supabase.rpc("role_capability_matrix")');
    expect(service).toContain('supabase.rpc("list_admin_permission_grants"');
    expect(service).toContain('supabase.rpc("set_admin_permission"');
  });

  it("shows a protected capability matrix and Super Admin delegation controls in the UI", () => {
    expect(app).toContain("function RoleCapabilities");
    expect(app).toContain('nav.push("roleCapabilities")');
    expect(app).toContain("Delegate Admin permissions");
    expect(app).toContain("View full matrix");
    expect(app).toContain('roleCapabilities: <RoleCapabilities');
  });

  it("replaces broad Admin RPC authorization with capability-specific checks", () => {
    expect(migration).toContain("public.has_admin_permission('users.manage')");
    expect(migration).toContain("public.has_admin_permission('events.moderate')");
    expect(migration).toContain("public.has_admin_permission('payments.view')");
    expect(migration).toContain("public.has_admin_permission('audit.view')");
    expect(migration).not.toContain("not public.has_role('ADMIN'::public.app_role)");
  });
});
