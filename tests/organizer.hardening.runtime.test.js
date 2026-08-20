import { describe, expect, it } from "vitest";
import crypto from "node:crypto";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && publishableKey);

async function callPublicRpc(name, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

describe("production hardening runtime boundaries", () => {
  it.skipIf(!hasSupabaseConfig)("rejects unauthenticated direct ticket check-in", async () => {
    const result = await callPublicRpc("check_in_ticket", { p_ticket_id: "00000000-0000-0000-0000-000000000000" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it.skipIf(!hasSupabaseConfig)("rejects unauthenticated QR-token check-in", async () => {
    const result = await callPublicRpc("check_in_ticket_with_token", { p_qr_token: "invalid-token-for-runtime-test" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects an invalid Paystack signature before any fulfillment call", async () => {
    process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "runtime-test-secret";
    const module = await import("../api/paystack/webhook.js");
    const response = {
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await module.default({ method: "POST", body: JSON.stringify({ event: "charge.success", data: { reference: "runtime-invalid" } }), headers: { "x-paystack-signature": crypto.createHmac("sha512", "wrong-secret").update(JSON.stringify({ event: "charge.success", data: { reference: "runtime-invalid" } })).digest("hex") } }, response);
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Invalid signature" });
  });
});
