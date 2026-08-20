import { execFile } from "node:child_process";
import { describe, expect, it } from "vitest";

function runCurl(args) {
  return new Promise((resolve) => {
    execFile("curl", args, { timeout: 15000 }, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

describe("Paystack credentials", () => {
  it("authenticates the configured server secret against Paystack", async ({ skip }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    expect(secret, "PAYSTACK_SECRET_KEY must be configured").toBeTruthy();

    const result = await runCurl([
      "--silent",
      "--show-error",
      "--location",
      "--header", "Accept: application/json",
      "--header", `Authorization: Bearer ${secret}`,
      "https://api.paystack.co/balance",
    ]);
    const payloadText = result.stdout || result.stderr || "";

    if (payloadText.includes("Sorry, you have been blocked") || payloadText.includes("cf-error-details")) {
      skip("Paystack Cloudflare blocked the sandbox egress; run this live credential check from the deployed server network.");
    }

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      throw new Error(`Paystack returned a non-JSON response: ${payloadText.slice(0, 160)}`);
    }
    expect(payload?.status, payload?.message || "Paystack credential validation failed").toBe(true);
  }, 20000);
});
