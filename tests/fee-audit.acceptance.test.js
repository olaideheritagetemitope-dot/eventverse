import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0017_fee_change_audit.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

const has = (source, value) => expect(source).toContain(value);

describe("Atizzy fee audit acceptance", () => {
  it("uses a Super Admin-only server RPC for fee changes", () => {
    has(migration, "update_platform_setting_fee");
    has(migration, "SUPER_ADMIN");
    has(migration, "grant execute on function public.update_platform_setting_fee(text, numeric) to authenticated");
    has(service, 'supabase.rpc("update_platform_setting_fee"');
  });

  it("records previous and new fee values in the audit log", () => {
    has(migration, "platform_fee.updated");
    has(migration, "previous_amount");
    has(migration, "new_amount");
    has(service, 'eq("action", "platform_fee.updated")');
  });

  it("keeps fee history visible in the existing Super Admin UI", () => {
    has(ui, "Fee change history");
    has(ui, "No fee changes have been recorded yet.");
    has(ui, "overview.auditHistory");
  });
});
