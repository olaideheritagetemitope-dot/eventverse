import { describe, expect, it } from "vitest";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../api/paystack/initialize.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/0056_ticket_payment_checkout_idempotency.sql", import.meta.url), "utf8");
const reservedInvariantMigration = fs.readFileSync(new URL("../supabase/0118_fix_ticket_reserved_invariant.sql", import.meta.url), "utf8");

describe("ticket payment idempotency", () => {
  it("persists and reuses provider checkout data instead of creating duplicate checkouts", () => {
    expect(api).toContain("persistedAuthorizationUrl");
    expect(api).toContain("updatePayment(payment.payment_id");
    expect(api).toContain("payment.provider_reference");
    expect(api).toContain("replayed: true");
  });

  it("returns both normalized and Paystack-native authorization fields", () => {
    expect(api).toContain("authorizationUrl:");
    expect(api).toContain("authorization_url:");
    expect(api).toContain("accessCode:");
    expect(api).toContain("access_code:");
  });

  it("adds persisted checkout fields and returns them from the live RPC", () => {
    expect(migration).toContain("add column if not exists checkout_url");
    expect(migration).toContain("add column if not exists access_code");
    expect(migration).toContain("authorization_url");
    expect(migration).toMatch(/p\.idempotency_key\s*=\s*trim\(p_idempotency_key\)/);
  });

  it("keeps ticket reserved inventory non-negative and makes release idempotent", () => {
    expect(reservedInvariantMigration).toContain("greatest(0, coalesce(tt.reserved, 0) - ri.quantity)");
    expect(reservedInvariantMigration).toContain("set status = 'EXPIRED'");
    expect(reservedInvariantMigration).toContain("set status = 'CANCELLED'");
    expect(reservedInvariantMigration).toContain("greatest(0, coalesce(reserved, 0)) + item_row.quantity");
    expect(reservedInvariantMigration).toContain("sold + greatest(0, coalesce(reserved, 0)) + item_row.quantity <= capacity");
  });
});
