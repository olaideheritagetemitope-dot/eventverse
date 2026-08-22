import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Unified role onboarding flow", () => {
  it("submits the live questionnaire and does not expose payment before approval", () => {
    const ui = read("src/EventVerse.jsx");
    const service = read("src/services/user.js");
    const migration = read("supabase/0058_role_onboarding_and_role_management_hardening.sql");
    const registry = read("src/components/SuperAdminModuleRegistry.jsx");

    expect(ui).toContain("const next = await submitRoleApplication(roleCode, answers)");
    expect(ui).toContain('onClick={submit}>{busy ? "Submitting..."');
    expect(ui).toContain('application.status === "PENDING_REVIEW" ? "A Super Admin must review your answers before any fee is shown."');
    expect(ui).toContain('application?.status === "APPROVED" || application?.status === "PENDING_PAYMENT"');
    expect(ui).toContain("initializeRoleApplicationPayment(application.id");
    expect(service).toContain('supabase.rpc("submit_role_application"');
    expect(service).toContain('/api/paystack/role-initialize');
    expect(migration).toContain("'PENDING_REVIEW'");
    expect(migration).toContain("activate_role_application_payment");
    expect(registry).toContain('item.status === "PENDING_REVIEW"');
    expect(registry).toContain('onReview?.(item.id, "REQUEST_CHANGES"');
    expect(registry).toContain("Submitted answers");
  });

  it("uses one role fee policy source for all supported roles", () => {
    const service = read("src/services/user.js");
    const migration = read("supabase/0058_role_onboarding_and_role_management_hardening.sql");

    expect(service).toContain("loadPublicRoleOnboardingConfig");
    expect(migration).toContain("role_fee_policies");
    expect(migration).toContain("p_role_code not in ('ARTIST','ORGANIZER','VENUE_MANAGER')");
    expect(migration).toContain("v_policy.amount");
  });
});
