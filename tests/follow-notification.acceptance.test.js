import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/0023_follow_notifications.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("follow notification deep-link contract", () => {
  it("uses an authenticated RPC instead of direct follower writes", () => {
    expect(service).toContain('supabase.rpc("toggle_artist_follow"');
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("insert into public.artist_followers");
  });

  it("persists an Artist notification with an artist detail deep link", () => {
    expect(migration).toContain("insert into public.user_notifications");
    expect(migration).toContain("'ARTIST'");
    expect(migration).toContain("'deep_link'");
    expect(migration).toContain("'artist'");
  });

  it("opens metadata deep links from the existing notification board", () => {
    expect(app).toContain("item.metadata?.deep_link");
    expect(app).toContain("markUserNotificationRead(item.id)");
  });
});
