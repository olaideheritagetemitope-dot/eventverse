import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("strict payment transaction-reference root fix", () => {
  it("defines a global collision-safe server reference registry and unique indexes", () => {
    const migration = read("supabase/0062_payment_transaction_reference_root_fix.sql");
    expect(migration).toContain("payment_transaction_references");
    expect(migration).toContain("mint_payment_transaction_reference");
    expect(migration).toContain("gen_random_uuid()");
    expect(migration).toContain("payments_transaction_reference_key");
    expect(migration).toContain("artist_fee_transactions_transaction_reference_key");
    expect(migration).toContain("role_application_payments_transaction_reference_key");
    expect(migration).toContain("venue_booking_payments_transaction_reference_key");
  });

  it("keeps retry keys stable while requiring a new key for a new payment attempt", () => {
    const migration = read("supabase/0062_payment_transaction_reference_root_fix.sql");
    expect(migration).toContain("where p.order_id=p_order_id and p.idempotency_key=trim(p_idempotency_key)");
    expect(migration).toContain("where idempotency_key=v_key limit 1");
    expect(migration).toContain("where booking_id=p_booking_id and idempotency_key=v_key limit 1");
    expect(migration).toContain("v_ref:=public.mint_payment_transaction_reference");
  });

  it("does not fall back to predictable references in Paystack API handlers", () => {
    const handlers = [
      read("api/paystack/initialize.js"),
      read("api/paystack/artist-initialize.js"),
      read("api/paystack/role-initialize.js"),
      read("api/paystack/venue-initialize.js"),
    ].join("\n");
    expect(handlers).toContain("transaction.transaction_reference");
    expect(handlers).toContain("payment.transaction_reference");
    expect(handlers).not.toMatch(/ATZ-(ARTIST|ROLE|VENUE)-\$\{/);
    expect(handlers).not.toContain("paystack-${orderId}");
  });
});
