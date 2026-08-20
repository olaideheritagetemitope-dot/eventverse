import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/services/catalog.js"), "utf8");

describe("discovery and navigation workflows", () => {
  it("provides live artist, music, event, and venue detail destinations", () => {
    expect(app).toContain('nav.push("artist", artist)');
    expect(app).toContain('nav.push("musicDetail", song)');
    expect(app).toContain('nav.push("eventDetail", event)');
    expect(app).toContain('nav.push("venueDetail", venue)');
    expect(app).toContain("function VenueDetail");
    expect(app).toContain("function MusicDetail");
    expect(catalog).toContain("export async function loadVenueDetail");
  });

  it("preserves event-to-ticket checkout routing and music playback handoff", () => {
    expect(app).toContain('nav.push("tickets", ev)');
    expect(app).toContain('nav.push("checkout"');
    expect(app).toContain('nav.push("payment"');
    expect(app).toContain('nav.push("musicPlayer", song)');
    expect(app).toContain("recordPlay(account?.user?.id, song.id)");
  });

  it("exposes live Profile Collections destinations for followed artists, liked music, recently played, and activity", () => {
    expect(app).toContain('profileCollections: <ProfileCollections');
    expect(app).toContain('nav.push("profileCollections", { initialTab: it })');
    expect(app).toContain('function ProfileCollections');
    expect(app).toContain('loadUserCollections(account?.user?.id)');
    expect(app).toContain('const tabs = ["Followed Artists", "Liked Music", "Recently Played", "Activity"]');
  });

  it("exposes protected security and notification board routes with deep-link handling", () => {
    expect(app).toContain('security: <SecurityScreen');
    expect(app).toContain('notifications: <NotificationBoard');
    expect(app).toContain("markUserNotificationRead");
    expect(app).toContain("markAllUserNotificationsRead");
    expect(app).toContain("item.deep_link.screen");
  });
});
