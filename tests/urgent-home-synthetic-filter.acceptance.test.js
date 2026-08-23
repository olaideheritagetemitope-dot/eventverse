import { describe, expect, it } from "vitest";
import { filterLiveCatalogRows, isSyntheticCatalogRecord, SYNTHETIC_CATALOG_IDS } from "../src/services/catalog.js";

describe("urgent Home synthetic catalog guard", () => {
  it("recognizes only the original fixed synthetic IDs", () => {
    expect(isSyntheticCatalogRecord("events", { id: "40000000-0000-0000-0000-000000000001" })).toBe(true);
    expect(isSyntheticCatalogRecord("events", { id: "real-event-id" })).toBe(false);
    expect(SYNTHETIC_CATALOG_IDS.events.size).toBe(6);
  });

  it("filters synthetic rows without changing live rows", () => {
    const rows = [
      { id: "40000000-0000-0000-0000-000000000001", title: "Burna Boy — The Summit" },
      { id: "real-event-id", title: "Real community event" },
    ];
    expect(filterLiveCatalogRows("events", rows)).toEqual([{ id: "real-event-id", title: "Real community event" }]);
  });

  it("filters synthetic music-video rows at the catalog boundary", () => {
    expect(isSyntheticCatalogRecord("musicVideos", { id: "70000000-0000-0000-0000-000000000001" })).toBe(true);
    expect(filterLiveCatalogRows("musicVideos", [
      { id: "70000000-0000-0000-0000-000000000001" },
      { id: "real-music-video-id" },
    ])).toEqual([{ id: "real-music-video-id" }]);
  });

  it("does not treat a null or incomplete row as synthetic", () => {
    expect(isSyntheticCatalogRecord("events", null)).toBe(false);
    expect(isSyntheticCatalogRecord("events", {})).toBe(false);
    expect(filterLiveCatalogRows("artists", undefined)).toEqual([]);
  });
});
