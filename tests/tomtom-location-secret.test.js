import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

describe("TomTom secure location integration", () => {
  it("uses server-side proxy endpoints without requiring a public TomTom key", () => {
    const client = fs.readFileSync(path.join(root, "src/services/tomtom.js"), "utf8");
    const handler = fs.readFileSync(path.join(root, "api/tomtom/[operation].js"), "utf8");

    expect(client).toContain("/api/tomtom/search");
    expect(client).toContain("/api/tomtom/reverse");
    expect(client).toContain("/api/tomtom/static-map");
    expect(client).not.toContain("NEXT_PUBLIC_TOMTOM_API_KEY");
    expect(handler).toContain('"search", "reverse", "static-map"');
    expect(handler).toMatch(/TOMTOM_API_KEY|TOMTOM_KEY|TOMTOM_TOKEN/);
    expect(handler).not.toContain("NEXT_PUBLIC_TOMTOM_API_KEY");
  });

  it("authorizes a lightweight TomTom geocoding request", async () => {
    const key = String(process.env.TOMTOM_API_KEY || "").trim();
    expect(key.length).toBeGreaterThan(0);
    const params = new URLSearchParams({ key, limit: "1", language: "en-GB" });
    const response = await fetch(`https://api.tomtom.com/search/2/geocode/Lagos.json?${params}`);
    const payload = await response.json().catch(() => ({}));
    expect(response.ok, payload?.errorText || "TomTom geocoding request failed").toBe(true);
    expect(Array.isArray(payload?.results)).toBe(true);
  });
});
