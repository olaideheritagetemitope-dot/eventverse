import { describe, expect, it } from "vitest";

describe("TomTom browser map key", () => {
  it("retrieves a Map Display static image with the configured key", async () => {
    const key = process.env.VITE_TOMTOM_MAP_API_KEY;
    expect(key, "VITE_TOMTOM_MAP_API_KEY must be configured").toBeTruthy();
    const url = new URL("https://api.tomtom.com/map/1/staticimage");
    url.searchParams.set("key", key);
    url.searchParams.set("center", "3.3792,6.5244");
    url.searchParams.set("zoom", "10");
    url.searchParams.set("width", "256");
    url.searchParams.set("height", "160");
    url.searchParams.set("format", "png");
    url.searchParams.set("layer", "basic");
    url.searchParams.set("style", "main");
    url.searchParams.set("language", "en-GB");
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    expect(response.ok, await response.text()).toBe(true);
    expect(contentType).toMatch(/^image\/(png|jpeg)/);
  }, 15000);
});
