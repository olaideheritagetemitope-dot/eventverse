import { describe, expect, it } from "vitest";

describe("Paystack credentials", () => {
  it("authenticates the configured server secret against Paystack", async () => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    expect(secret, "PAYSTACK_SECRET_KEY must be configured").toBeTruthy();

    const response = await fetch("https://api.paystack.co/balance", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const payload = await response.json();

    expect(response.ok, payload?.message || "Paystack credential validation failed").toBe(true);
    expect(payload?.status).toBe(true);
  }, 15000);
});
