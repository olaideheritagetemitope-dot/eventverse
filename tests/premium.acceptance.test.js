import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const initialize = fs.readFileSync(path.join(root, "api/paystack/premium-initialize.js"), "utf8");
const verify = fs.readFileSync(path.join(root, "api/paystack/premium-verify.js"), "utf8");
const webhook = fs.readFileSync(path.join(root, "api/paystack/premium-webhook.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0084_premium_entitlement_system.sql"), "utf8");
const attendeeMigration = fs.readFileSync(path.join(root, "supabase/0086_premium_attendee_surfaces.sql"), "utf8");
const adminMigration = fs.readFileSync(path.join(root, "supabase/0087_premium_admin_plan_controls.sql"), "utf8");
const monitoringMigration = fs.readFileSync(path.join(root, "supabase/0089_premium_admin_monitoring.sql"), "utf8");
const governance = fs.readFileSync(path.join(root, "src/components/AdvancedGovernancePanels.jsx"), "utf8");

describe("Premium attendee system acceptance contract", () => {
  it("keeps Premium as an entitlement layer with a canonical plan and durable lifecycle", () => {
    expect(migration).toContain("create table if not exists public.premium_plans");
    expect(migration).toContain("create table if not exists public.premium_subscriptions");
    expect(migration).toContain("create table if not exists public.premium_payments");
    expect(migration).toContain("create table if not exists public.premium_entitlements");
    expect(migration).toContain("premium_one_live_subscription_idx");
    expect(migration).toContain("has_premium_access");
    expect(migration).toContain("can_access_ticket_type");
  });

  it("uses the established Atizzy callback convention and persists a pending attempt", () => {
    expect(app).toContain("?premium-payment=callback");
    expect(app).toContain("atizzy:pending-premium-payment");
    expect(app).toContain("premiumProcessing");
    expect(app).toContain("/api/paystack/premium-verify");
  });

  it("connects the account surface to the authoritative Premium service", () => {
    expect(app).toContain("loadPremiumSnapshot");
    expect(app).toContain("initializePremiumPayment");
    expect(app).toContain("cancelPremiumSubscription");
    expect(app).toContain("[\"Preferences\", \"Notifications\", \"Premium\"");
    expect(service).toContain('supabase.rpc("get_premium_snapshot")');
    expect(service).toContain('supabase.rpc("cancel_premium_subscription"');
  });

  it("connects Premium attendee tools to server-authoritative RPCs and preserves entitlement gates", () => {
    expect(attendeeMigration).toContain("create or replace function public.get_premium_event_discovery");
    expect(attendeeMigration).toContain("create or replace function public.get_premium_attendee_snapshot");
    expect(attendeeMigration).toContain("premium_feature_enabled('advanced_discovery'");
    expect(attendeeMigration).toContain("premium_feature_enabled('follow_radar'");
    expect(attendeeMigration).toContain("premium_feature_enabled('planner'");
    expect(attendeeMigration).toContain("premium_feature_enabled('personal_statistics'");
    expect(service).toContain('supabase.rpc("get_premium_event_discovery"');
    expect(service).toContain('supabase.rpc("get_premium_attendee_snapshot"');
    expect(app).toContain("Follow Radar");
    expect(app).toContain("Personal Event Planner");
    expect(app).toContain("Personal Music Statistics");
    expect(app).toContain("Premium");
  });

  it("exposes one canonical admin plan catalogue and feature editor", () => {
    expect(adminMigration).toContain("create or replace function public.get_premium_admin_plans");
    expect(adminMigration).toContain("has_any_app_role");
    expect(service).toContain('supabase.rpc("get_premium_admin_plans"');
    expect(service).toContain('supabase.rpc("set_premium_plan"');
    expect(governance).toContain("Premium attendee configuration");
    expect(governance).toContain("Save Premium plan");
  });

  it("exposes live Premium subscriber and payment monitoring to governance", () => {
    expect(monitoringMigration).toContain("create or replace function public.get_premium_admin_monitoring");
    expect(monitoringMigration).toContain("premium_subscriptions");
    expect(monitoringMigration).toContain("premium_payments");
    expect(monitoringMigration).toContain("has_any_app_role");
    expect(service).toContain('supabase.rpc("get_premium_admin_monitoring"');
    expect(governance).toContain("Premium subscribers and payments");
    expect(governance).toContain("Recent payment attempts");
  });

  it("verifies Premium webhook amounts in the database currency and safely rejects malformed signatures", () => {
    expect(webhook).toContain("p_paid_amount: Number(paidAmount) / 100");
    expect(webhook).toContain("signature.length !== expected.length");
    expect(webhook).toContain("activate_premium_payment");
  });

  it("keeps payment initialization and verification server-authoritative", () => {
    expect(initialize).toContain("initialize_premium_payment");
    expect(initialize).toContain("transaction_reference");
    expect(initialize).toContain("attach_premium_checkout");
    expect(verify).toContain("activate_premium_payment");
    expect(verify).toContain("provider_reference");
    expect(verify).toContain("amount");
    expect(verify).toContain("currency");
  });

  it("uses the canonical UUID-backed reference registry for Premium payments", () => {
    const rootFix = fs.readFileSync(path.join(root, "supabase/0104_premium_payment_reference_root_fix.sql"), "utf8");
    expect(rootFix).toContain("payment_transaction_references");
    expect(rootFix).toContain("mint_payment_transaction_reference('PREMIUM')");
    expect(rootFix).toContain("gen_random_uuid()");
    expect(rootFix).not.toContain("gen_random_bytes");
    expect(rootFix).toContain("payment_domain in ('TICKET','ARTIST','ROLE_APPLICATION','VENUE','PREMIUM')");
    expect(rootFix).toContain("reused");
  });
});
