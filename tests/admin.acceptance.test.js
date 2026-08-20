import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/0021_admin_operations.sql", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../src/services/user.js", import.meta.url), "utf8");

describe("Admin operations contracts", () => {
  it("keeps Admin separate from Super Admin platform settings", () => {
    expect(migration).toContain("public.has_role('ADMIN'::public.app_role)");
    expect(migration).toContain("Admin access required");
    expect(source).toContain("Admin operations");
    expect(source).toContain("Super Admin platform settings remain separate");
  });
  it("provides server-authoritative user, moderation, event review, payment, and audit contracts", () => {
    for (const rpc of ["admin_list_users", "admin_suspend_user", "admin_review_event", "admin_update_report", "admin_payment_support_snapshot", "admin_recent_audit_logs"]) expect(migration).toContain(`function public.${rpc}`);
    expect(migration).toContain("admin.user.suspended");
    expect(migration).toContain("admin.event.reviewed");
    expect(migration).toContain("admin.report.updated");
    for (const fn of ["adminListUsers", "adminSuspendUser", "adminReviewEvent", "adminUpdateReport", "loadAdminPaymentSupport", "loadAdminAuditLogs"]) expect(service).toContain(`export async function ${fn}`);
  });
  it("renders live oversight metrics and protects destructive actions behind Admin UI", () => {
    expect(source).toContain("loadAdminDashboardSnapshot");
    expect(source).toContain("User management");
    expect(source).toContain("Payment support");
    expect(source).toContain("Audit & moderation oversight");
    expect(source).toContain("adminWorkspace: <AdminWorkspace");
  });
});
