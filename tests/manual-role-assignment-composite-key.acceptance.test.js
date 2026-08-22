import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/0063_fix_super_admin_role_assignment_composite_key.sql"), "utf8");
const previousMigration = fs.readFileSync(path.join(root, "supabase/0060_super_admin_profile_linking_and_effective_status.sql"), "utf8");

describe("manual role assignment composite-key root fix", () => {
  it("uses user_id and role_id instead of a nonexistent user_roles.id", () => {
    expect(migration).toContain("select exists(");
    expect(migration).toContain("where user_id = p_target_user_id and role_id = v_role_id");
    expect(migration).not.toMatch(/v_existing\.id/);
  });

  it("keeps the corrected migration after the legacy implementation", () => {
    expect(previousMigration).toContain("super_admin_set_role");
    expect(migration).toContain("create or replace function public.super_admin_set_role");
    expect(migration).toContain("grant execute on function public.super_admin_set_role");
  });
});
