import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const sourceFiles = [
  "src/EventVerse.jsx",
  "src/ui/designSystem.js",
  "src/services/catalog.js",
  "src/services/user.js",
  "src/components/SuperAdminModuleRegistry.jsx",
].map((file) => path.join(root, file));

const readSource = () => sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

describe("Atizzy live-data frontend contract", () => {
  it("preserves the original UI primitives and role surfaces", () => {
    const source = readSource();
    for (const token of [
      "EventCard",
      "EmptyArtistCard",
      "EmptySongCard",
      "EmptyVenueCard",
      "Ticket2",
      "Pill",
      "BottomNav",
      "MiniPlayer",
      "GovernanceDashboard",
      "AdminControlCenter",
      "AttendeeHome",
      "Explore",
      "SearchScreen",
      "MusicHome",
      "ArtistProfile",
      "EventDetail",
      "VenueDetail",
      "MyTickets",
      "Profile",
      "NotificationBoard",
      "UserExperience",
      "ArtistWorkspace",
      "OrganizerEvents",
      "VenueManagerWorkspace",
      "EventStaffWorkspace",
      "AdminWorkspace",
      "RoleCenter",
    ]) {
      expect(source).toContain(token);
    }
  });

  it("uses live catalog and domain service boundaries", () => {
    const source = readSource();
    for (const token of [
      "loadCatalog",
      "searchCatalog",
      "loadEventDetail",
      "loadVenueDetail",
      "loadUserExperienceSnapshot",
      "loadRoleGovernanceSnapshot",
      "loadAdminDashboardSnapshot",
    ]) {
      expect(source).toContain(token);
    }
    expect(source).toContain('supabase.from("events")');
    expect(source).toContain('supabase.from("artists")');
    expect(source).toContain('supabase.from("songs")');
    expect(source).toContain('supabase.from("venues")');
  });

  it("does not define fabricated frontend catalog records or mock datasets", () => {
    const source = readSource();
    expect(source).not.toMatch(/const\s+(MOCK|DEMO|EVENTS|ARTISTS|SONGS|VENUES|ALBUMS|TICKETS)\s*=\s*\[/);
    expect(source).not.toMatch(/export\s+const\s+(MOCK|DEMO|EVENTS|ARTISTS|SONGS|VENUES|ALBUMS|TICKETS)\s*=\s*\[/);
    expect(source).not.toMatch(/\b(fake|demo|sample)\s+(event|artist|song|venue|ticket|album|user)\b/i);
    expect(source).not.toMatch(/\basake\b/i);
    expect(source).not.toMatch(/https?:\/\/[^\s"']+(unsplash|pexels|example\.com)/i);
  });

  it("keeps empty and loading states as UI states rather than fake content", () => {
    const source = readSource();
    expect(source).toContain("EMPTY_CATALOG");
    expect(source).toContain("resourceState");
    expect(source).toContain("No live");
    expect(source).toContain("Loading");
  });
});
