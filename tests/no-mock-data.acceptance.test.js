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
  "src/components/AdvancedGovernancePanels.jsx",
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


  it("renders Popular Venues from the live catalog only", () => {
    const source = readSource();
    expect(source).toContain('Section title="Popular Venues"');
    expect(source).toMatch(/const rankedVenues = catalog\?\.popularVenues \|\| \[\];/);
    expect(source).toContain("venues.slice(0, 6)");
    expect(source).toContain("EmptyVenueCard");
    expect(source).toContain('filterLiveCatalogRows("venues", venueResult.data)');
  });


describe("Super Admin advanced governance contract", () => {
  it("exposes live configurable fees, onboarding, lifecycle accounting, support, and niche analytics", () => {
    const source = readSource();
    for (const token of [
      "Ticket-sale fee policy",
      "PERCENTAGE",
      "FIXED",
      "setPlatformFeePolicy",
      "Configured onboarding questions",
      "Event lifecycle and allocated tickets",
      "Wallet credits",
      "Support requests routed to governance",
      "Niche engagement analytics",
      "engagement_by_type",
      "set_platform_fee_policy",
    ]) {
      expect(source).toContain(token);
    }
  });
});

describe("Super Admin complete role directory contract", () => {
  it("exposes every requested role cohort and future-role fallback", () => {
    const source = readSource();
    for (const token of [
      'id: "users"',
      'id: "artists"',
      'id: "organizers"',
      'id: "venues"',
      'id: "staff"',
      'id: "admins"',
      'id: "super_admins"',
      'id: "attendees"',
      'id: "other_roles"',
      'SUPER_ADMIN',
      'ATTENDEE',
      'Every row is an authenticated user',
      'Live role coverage',
    ]) {
      expect(source).toContain(token);
    }
  });

  it("does not fabricate role membership when the live snapshot has no role", () => {
    const source = readSource();
    expect(source).toContain('return roles.length ? roles : ["ATTENDEE"]');
    expect(source).toContain('!KNOWN_ROLE_CODES.has(role)');
    expect(source).toContain('snapshot?.users || []');
  });
});


describe("Reactive interaction wiring contract", () => {
  it("routes header, discovery, section, venue, and player actions through navigation or live handlers", () => {
    const source = readSource();
    expect(source).toContain('onClick={() => nav.push("notifications")}');
    expect(source).toContain('onClick={() => nav.push("profile")}');
    expect(source).toContain('onClick={() => nav.push("venueDetail", venue)}');
    expect(source).toContain("const openAll = () =>");
    expect(source).toContain('onClick={openAll}');
    expect(source).toContain('onClick={() => player.play(s)}');
    expect(source).toContain('onClick={player.toggle}');
  });

  it("keeps disabled states tied to missing live resources or in-flight work", () => {
    const source = readSource();
    expect(source).toContain('disabled={!song.audioUrl}');
    expect(source).toContain('disabled={busy}');
    expect(source).toContain('Action unavailable until a live record exists');
  });
});


describe("Backend-to-UI governance mutation contract", () => {
  it("surfaces role-fee and onboarding-question mutations in the existing governance panel", () => {
    const source = readSource();
    for (const token of [
      "setRoleFeePolicy",
      "saveOnboardingQuestion",
      "saveRoleFee",
      "Add question",
      "reviewHours",
      "roleCode",
    ]) {
      expect(source).toContain(token);
    }
  });
});


describe("linked directive capability matrix controls", () => {
  it("exposes live capability catalog and delegated Admin permission controls", () => {
    const source = readSource();
    for (const token of [
      "Role capability matrix and Admin delegation",
      "loadRoleCapabilityMatrix",
      "loadAdminPermissionGrants",
      "setAdminPermission",
      "role_capability_matrix",
      "list_admin_permission_grants",
      "set_admin_permission",
    ]) {
      expect(source).toContain(token);
    }
  });
});


describe("Strict detail null-contract", () => {
  it("requires EventDetail to unwrap the live event payload and preserve missing-record states", () => {
    const source = readSource();
    expect(source).toContain("detail?.event || null");
    expect(source).toContain("This event is unavailable or has not been published.");
    expect(source).not.toContain('venue: "Venue pending"');
  });
});


describe("Catalog detail service contract", () => {
  it("returns an explicit null event when a live event record is absent", () => {
    const source = fs.readFileSync(path.join(root, "src/services/catalog.js"), "utf8");
    expect(source).toContain("event: liveEvent ?");
    expect(source).toContain("} : null");
    expect(source).toContain("ticketTypes: liveEvent ?");
  });
});
