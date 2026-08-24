import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");

describe("TomTom blank-map rendering guard", () => {
  it("waits for MapLibre load/idle and does not finish on style.load alone", () => {
    expect(source).toContain('mapLibre.once("style.load", () => { styleLoaded = true; });');
    expect(source).toContain('mapLibre.once("load", () => { styleLoaded = true; finishReady(); });');
    expect(source).toContain('mapLibre.on("idle", finishReady);');
    expect(source).not.toContain('mapLibre.once("style.load", () => { styleLoaded = true; finishReady(); });');
  });

  it("requires a non-zero canvas and container viewport before ready", () => {
    expect(source).toContain("canvas.width > 0 && canvas.height > 0");
    expect(source).toContain("rect?.width > 0 && rect?.height > 0");
    expect(source).toContain('style={{ width: "100%", height: "100%" }}');
  });

  it("does not suppress provider errors before the first rendered state", () => {
    expect(source).toContain("if (disposed || rendered) return;");
    expect(source).toContain("TomTom map did not render visible style or tile content.");
  });
});
