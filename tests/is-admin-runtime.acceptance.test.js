import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0048_restore_role_helper_grants.sql"), "utf8");
const effectiveRoles = fs.readFileSync(path.join(root, "supabase/0026_super_admin_effective_roles.sql"), "utf8");

describe("is_admin runtime authorization contract", () => {
  it("grants role-helper RPC execution only to authenticated users", () => {
    expect(migration).toMatch(/grant execute on function public\.is_admin\(\) to authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.has_app_role\(public\.app_role\) to authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.has_any_app_role\(public\.app_role\[\]\) to authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.has_role\(public\.app_role\) to authenticated/i);
    expect(migration).toMatch(/revoke all on function public\.is_admin\(\) from anon/i);
    expect(migration).toMatch(/revoke all on function public\.is_admin\(\) from public/i);
  });

  it("keeps is_admin backed by centralized effective roles", () => {
    expect(effectiveRoles).toMatch(/create or replace function public\.is_admin\(\)[\s\S]*?select public\.has_any_app_role/i);
    expect(effectiveRoles).toMatch(/create or replace function public\.has_any_app_role/i);
    expect(effectiveRoles).toMatch(/from public\.effective_app_roles\(\)/i);
  });
});
