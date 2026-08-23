import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shell = fs.readFileSync(path.resolve(process.cwd(), "src/EventVerse.jsx"), "utf8");
const catalog = fs.readFileSync(path.resolve(process.cwd(), "src/services/catalog.js"), "utf8");

describe("Deep regression contract coverage", () => {
  it("keeps the artist directory and search approved-only and live", () => {
    expect(catalog).toContain('artists: () => supabase.from("artists")');
    expect(catalog).toContain('.eq("verified", true)');
    expect(catalog).toContain('.or(`name.ilike.${pattern},bio.ilike.${pattern}`)');
    expect(shell).toContain('const show = (section) => tab === "All" || tab === section;');
    expect(shell).toContain('query && show("Artists")');
  });

  it("does not let geolocation failure replace the live catalog and exposes its state", () => {
    expect(shell).toContain('const [locationState, setLocationState] = useState("unavailable");');
    expect(shell).toContain('positionError?.code === 1 ? "denied" : positionError?.code === 3 ? "timeout" : "unavailable"');
    expect(shell).toContain('loadDiscoverySnapshot(location)');
    expect(shell).toContain('locationState={locationState}');
    expect(shell).toContain("Nearby events use general discovery");
  });

  it("preserves the authoritative venue deletion path", () => {
    expect(shell).toContain("deleteOwnedVenue");
    expect(shell).not.toContain("supabase.from(\"venues\").delete()");
  });
});
