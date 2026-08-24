import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const governance = fs.readFileSync(path.join(root, "src/components/AdvancedGovernancePanels.jsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0112_artist_premium_exposure.sql"), "utf8");

describe("Premium Artist exposure product", () => {
  it("keeps the purchase offer separate and gated by an existing Artist role", () => {
    expect(app).toContain('if (code === "ARTIST_PREMIUM") return roleCodes.includes("ARTIST");');
    expect(app).toContain("Premium Artist exposure");
    expect(app).toContain("available after your Artist role is active");
    expect(app).toContain("Boost artist exposure");
  });

  it("maps plan families to attendee, Artist, Organizer, and multi-role accounts", () => {
    expect(app).toContain('if (code === "PREMIUM_MONTHLY") return true;');
    expect(app).toContain('if (code === "ORGANIZER_PREMIUM") return roleCodes.includes("ORGANIZER");');
    expect(app).toContain("const roleCodes = Array.from(new Set([...accountRoles");
    expect(app).toContain("new Map((snapshot.plans || [])");
  });

  it("uses the canonical live plan catalog and does not route through onboarding", () => {
    expect(app).toContain("loadPremiumSnapshot");
    expect(app).toContain("initializePremiumPayment");
    expect(app).not.toContain("initializeRoleApplicationPayment(plan");
  });

  it("keeps Premium Artist discoverable in the existing Super Admin plan editor", () => {
    expect(governance).toContain('String(plan.code || "").toUpperCase() === "ARTIST_PREMIUM" ? "Premium Artist"');
    expect(governance).toContain("loadPremiumAdminPlans");
    expect(governance).toContain("setPremiumPlan");
  });

  it("defines a separate role-gated Artist Premium entitlement path", () => {
    expect(migration).toContain("artist_premium_entitlements");
    expect(migration).toContain("ARTIST_PREMIUM");
    expect(migration).toContain("has_any_app_role");
    expect(migration).toContain("ARTIST");
  });
});
