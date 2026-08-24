import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const appSource = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const initializeRoute = fs.readFileSync(path.join(root, "api/paystack/initialize.js"), "utf8");
const verifyRoute = fs.readFileSync(path.join(root, "api/paystack/verify.js"), "utf8");

describe("Paystack checkout latency contract", () => {
  it("uses the authenticated session email without a redundant getUser round trip", () => {
    const paymentStart = appSource.indexOf('function Payment({ nav, data })');
    const paymentEnd = appSource.indexOf('function Processing({ nav, data })');
    const paymentSource = appSource.slice(paymentStart, paymentEnd);

    expect(paymentSource).toContain("supabase.auth.getSession()");
    expect(paymentSource).toContain("const user = session?.user");
    expect(paymentSource).not.toContain("supabase.auth.getUser()");
  });

  it("keeps the server-authoritative order, provider, and reference sequence", () => {
    expect(initializeRoute.indexOf('"initialize_order_payment"')).toBeGreaterThan(-1);
    expect(initializeRoute.indexOf("await supabaseRpc(")).toBeLessThan(initializeRoute.indexOf("await paystackInitialize("));
    expect(initializeRoute).toContain('"attach_payment_provider_reference"');
    expect(initializeRoute).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(initializeRoute).toContain("apiKey = SUPABASE_PUBLISHABLE_KEY");
    expect(initializeRoute).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY,\n    );");
  });

  it("verifies the browser-return transaction before invoking exactly-once issuance", () => {
    expect(verifyRoute).toContain('"/auth/v1/user"');
    expect(verifyRoute).toContain("https://api.paystack.co/transaction/verify/");
    expect(verifyRoute).toContain('"/rest/v1/rpc/verify_payment_and_issue_tickets"');
    expect(verifyRoute).toContain("Payment does not belong to the authenticated user");
    expect(verifyRoute).toContain("p_payment_id: payment.id");
    expect(verifyRoute).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(appSource).toContain('fetch(apiUrl("/api/paystack/verify"');
    expect(appSource).toContain("callbackReference = url.searchParams.get(\"reference\") || url.searchParams.get(\"trxref\")");
    expect(appSource).toContain("data: pendingPayment || pendingArtistPayment || pendingPremiumPayment");
  });

  it("keeps the provider-reference guard private and service-role executable", () => {
    const migration = fs.readFileSync(path.join(root, "supabase/0077_fix_ticket_provider_reference_authority.sql"), "utf8");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.role()");
    expect(migration).toContain("v_request_role <> 'service_role'");
    expect(migration).toContain("revoke all on function public.attach_payment_provider_reference(uuid, text) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.attach_payment_provider_reference(uuid, text) to service_role");
  });
});
