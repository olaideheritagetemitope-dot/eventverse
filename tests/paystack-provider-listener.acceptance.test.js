import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const premiumWebhook = fs.readFileSync(path.join(root, "api/paystack/premium-webhook.js"), "utf8");
const sharedWebhook = fs.readFileSync(path.join(root, "api/paystack/webhook.js"), "utf8");
const premiumVerify = fs.readFileSync(path.join(root, "api/paystack/premium-verify.js"), "utf8");
const ticketVerify = fs.readFileSync(path.join(root, "api/paystack/verify.js"), "utf8");

describe("Paystack provider-authoritative listener contract", () => {
  it("re-checks Premium charge.success with Paystack before activation", () => {
    expect(premiumWebhook).toContain("/transaction/verify/");
    expect(premiumWebhook).toContain("Paystack live verification failed");
    expect(premiumWebhook).toContain("verified.status !== \"success\"");
    expect(premiumWebhook).toContain("Verified Paystack amount does not match Premium payment");
    expect(premiumWebhook).toContain("Verified Paystack currency does not match Premium payment");
    expect(premiumWebhook.indexOf("await paystackVerify(reference)")).toBeLessThan(premiumWebhook.indexOf("await activate(payment"));
  });

  it("re-checks every shared charge.success event before domain fulfillment", () => {
    expect(sharedWebhook).toContain("/transaction/verify/");
    expect(sharedWebhook).toContain("live_provider_status_not_success");
    expect(sharedWebhook).toContain("event.data = { ...event.data, ...verified }");
    expect(sharedWebhook.indexOf("await verifyPaystackTransaction(reference)")).toBeLessThan(sharedWebhook.indexOf("activate_artist_fee_transaction"));
    expect(sharedWebhook.indexOf("await verifyPaystackTransaction(reference)")).toBeLessThan(sharedWebhook.indexOf("verify_payment_and_issue_tickets"));
    expect(sharedWebhook.indexOf("await verifyPaystackTransaction(reference)")).toBeLessThan(sharedWebhook.indexOf("activate_role_application_payment"));
    expect(sharedWebhook.indexOf("await verifyPaystackTransaction(reference)")).toBeLessThan(sharedWebhook.indexOf("verify_venue_booking_payment"));
  });

  it("keeps callback verification live for Premium and tickets", () => {
    expect(premiumVerify).toContain("https://api.paystack.co/transaction/verify/");
    expect(premiumVerify).toContain('verified?.status !== "success"');
    expect(ticketVerify).toContain("https://api.paystack.co/transaction/verify/");
    expect(ticketVerify).toContain('verified?.status !== "success"');
  });

  it("does not allow a non-success provider response to reach fulfillment", () => {
    expect(sharedWebhook.indexOf('verified.status !== "success"')).toBeGreaterThan(-1);
    expect(sharedWebhook.indexOf('verified.status !== "success"')).toBeLessThan(sharedWebhook.indexOf("verify_payment_and_issue_tickets"));
    expect(premiumWebhook.indexOf('verified.status !== "success"')).toBeGreaterThan(-1);
    expect(premiumWebhook.indexOf('verified.status !== "success"')).toBeLessThan(premiumWebhook.indexOf("await activate(payment"));
  });
});
