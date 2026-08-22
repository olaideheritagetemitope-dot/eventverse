import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");

describe("Profile role workspace visibility", () => {
  it("exposes Event Organizer onboarding and workspace routes", () => {
    expect(source).toContain("Become an Event Organizer");
    expect(source).toContain('nav.push("organizerOnboarding")');
    expect(source).toContain('nav.push("organizerEvents")');
  });

	it("uses assigned roles for onboarding ownership and effective roles for workspace projection", () => {
		expect(source).toContain("const assignedRoleCodes = (account)");
		expect(source).toContain("const hasAssignedRole = (account, role)");
		expect(source).toContain("assignedRoleCodes(account).some((role) => [\"ORGANIZER\", \"ADMIN\", \"SUPER_ADMIN\"].includes(role))");
		expect(source).toContain("effectiveRoleCodes(account).length > 0");
	});

	it("exposes a direct Artist Dashboard route for active artists", () => {
    expect(source).toContain("Artist Dashboard");
    expect(source).toContain('nav.push("artistWorkspace")');
    expect(source).toContain('artistWorkspace: <ArtistWorkspace');
  });
});
