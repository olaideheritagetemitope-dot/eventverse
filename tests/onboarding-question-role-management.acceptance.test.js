import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const panel = fs.readFileSync(path.join(root, "src/components/AdvancedGovernancePanels.jsx"), "utf8");
const registry = fs.readFileSync(path.join(root, "src/components/SuperAdminModuleRegistry.jsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0061_onboarding_question_lifecycle.sql"), "utf8");

describe("Super Admin onboarding and role management", () => {
  it("supports live question lifecycle actions without deleting historical answers", () => {
    expect(service).toContain("set_onboarding_question_status");
    expect(panel).toContain("Delete question");
    expect(panel).toContain("Delete this onboarding question");
    expect(panel).toContain("setOnboardingQuestionStatus(item.id, active ? \"DEACTIVATE\" : \"PUBLISH\"");
    expect(panel).toContain("Publish");
    expect(panel).toContain("RESTORE");
    expect(migration).toContain("set active = v_action in");
    expect(migration).toContain("role_onboarding_question");
  });

  it("exposes a dedicated live role assignment center with unrestricted actions", () => {
    expect(registry).toContain("role_assignments");
    expect(registry).toContain("Manual role assignment center");
    expect(registry).toContain("Apply unrestricted role action");
    expect(registry).toContain("SUPER_ADMIN");
    expect(registry).toContain("VENUE_MANAGER");
    expect(registry).toContain("ORGANIZER");
  });
});
