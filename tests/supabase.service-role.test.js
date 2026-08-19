import { describe, expect, it } from "vitest";

const SUPABASE_URL = "https://blalvoelllndmbppbkcy.supabase.co";

describe("Supabase service role credential", () => {
  it("authenticates against a read-only REST endpoint", async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY must be configured").toBeTruthy();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/roles?select=code&limit=1`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    const payload = await response.json();

    expect(response.ok, JSON.stringify(payload)).toBe(true);
    expect(Array.isArray(payload)).toBe(true);
  }, 15000);
});
