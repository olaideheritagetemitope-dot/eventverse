import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0071_canonical_role_policy_bridge.sql"), "utf8");
const latestArtistPaymentMigration = fs.readFileSync(path.join(root, "supabase/0096_canonical_artist_fee_source.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const governance = fs.readFileSync(path.join(root, "src/components/AdvancedGovernancePanels.jsx"), "utf8");

const has = (source, value) => expect(source).toContain(value);

describe("Atizzy canonical role-policy acceptance", () => {
  it("uses role_fee_policies as the authoritative Artist, Organizer, and Venue Manager fee source", () => {
    has(migration, "role_fee_policies");
    has(migration, "create or replace function public.initialize_artist_fee_payment");
    has(migration, "from public.role_fee_policies");
    has(latestArtistPaymentMigration, "from public.role_fee_policies");
    expect(latestArtistPaymentMigration).not.toContain("from public.platform_settings");
    has(latestArtistPaymentMigration, "mint_payment_transaction_reference");
    has(service, 'supabase.rpc("get_role_onboarding_public_config"');
    has(service, 'supabase.from("role_fee_policies")');
    has(service, 'setRoleFeePolicy("ARTIST"');
    has(governance, 'const ROLE_LABELS = ["ARTIST", "ORGANIZER", "VENUE_MANAGER"]');
    has(governance, "Role verification policies");
  });

  it("keeps legacy Artist pricing as a compatibility bridge with audit history only", () => {
    has(migration, "update_platform_setting_fee");
    has(migration, "updated_via_legacy_bridge");
    has(migration, "previous_amount");
    has(migration, "new_amount");
    expect(service).not.toContain('supabase.rpc("update_platform_setting_fee"');
  });

  it("keeps onboarding-question controls and all role onboarding routes in the existing UI", () => {
    has(governance, "Configured onboarding questions");
    has(governance, "Delete question");
    has(ui, "artistOnboarding");
    has(ui, "organizerOnboarding");
    has(ui, "venueOnboarding");
    has(ui, "Complete the live questionnaire first");
  });
});
