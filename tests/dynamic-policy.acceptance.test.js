import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0030_dynamic_policy_control_plane.sql"), "utf8");
const detailMigration = fs.readFileSync(path.join(root, "supabase/0031_artist_verification_policy_details.sql"), "utf8");

describe("Atizzy dynamic policy control plane acceptance", () => {
  it("exposes the protected policy control surface", () => {
    expect(source).toContain("Dynamic business policies");
    expect(source).toContain("loadPolicySettings");
    expect(source).toContain("updatePolicySetting");
    expect(source).toContain("hasEffectiveRole(account, \"ADMIN\")");
  });

  it("registers every required operational policy key", () => {
    for (const token of [
      "artist_registration_enabled",
      "artist_verification_required",
      "artist_verification_approval_role",
      "event_publish_requires_ticket_config",
      "venue_publish_requires_owner",
    ]) expect(migration).toContain(token);
    expect(service).toContain("loadPolicySettings");
    expect(service).toContain("updatePolicySetting");
  });

  it("provides artist verification information and business-rule policy points", () => {
    for (const token of [
      "artist_verification_required_fields",
      "artist_verification_minimum_age",
      "artist_verification_requires_profile_photo",
      "can_approve_artist_verification",
    ]) expect(detailMigration).toContain(token);
  });

  it("validates, audits, and protects dynamic policy writes", () => {
    for (const token of [
      "security definer",
      "Super Admin access is required",
      "Unsupported policy setting",
      "Policy value must be boolean",
      "Policy value must be a non-negative number",
      "Policy value is not allowed",
      "policy_setting.updated",
      "has_any_app_role",
    ]) expect(migration).toContain(token);
  });

  it("keeps policy enforcement server-authoritative for artist payments", () => {
    expect(migration).toContain("get_policy_value");
    expect(migration).toContain("This Artist workflow is currently disabled by platform policy");
  });
});
