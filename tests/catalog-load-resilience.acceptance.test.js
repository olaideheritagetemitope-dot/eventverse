import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "src/services/catalog.js"), "utf8");

describe("Home base catalog root-cause regression", () => {
  it("settles each base query by the entries index rather than the callback array", () => {
    expect(source).toContain("const settled = await Promise.allSettled(entries.map(([, query]) => query()));");
    expect(source).toContain("entries.map(([name], index) => {");
    expect(source).toContain("const result = settled[index];");
    expect(source).not.toContain("entries.map(([name], _query, index) => {");
  });

  it("returns a catalog with isolated errors instead of rejecting on one failed query", () => {
    expect(source).toContain("if (result.status === \"rejected\") return [name, { data: [], error: result.reason }];");
    expect(source).toContain("if (result.value?.error) return [name, { data: [], error: result.value.error }];");
    expect(source).toContain("catalogErrors: Object.fromEntries");
    expect(source).toContain("events: filterLiveCatalogRows(\"events\", results.events.data).map(toEvent)");
    expect(source).toContain("venues: filterLiveCatalogRows(\"venues\", results.venues.data)");
  });

  it("settles global search categories independently and preserves per-category diagnostics", () => {
    expect(source).toContain("const settled = await Promise.allSettled(entries.map(([, loader]) => loader()));");
    expect(source).toContain("const resultByName = Object.fromEntries(entries.map(([name], index) => {");
    expect(source).toContain("searchErrors: Object.fromEntries");
    expect(source).toContain("artists: (await hydrateArtistAvatars(filterLiveCatalogRows(\"artists\", resultByName.artists.data))).map(toArtist)");
  });
});
