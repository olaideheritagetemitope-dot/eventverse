import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0022_user_experience_persistence.sql"), "utf8");
const services = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("Atizzy user experience persistence", () => {
  it("stores private history, preferences, notifications, and support requests with RLS", () => {
    expect(migration).toContain("alter table public.user_search_history enable row level security");
    expect(migration).toContain("alter table public.user_preferences enable row level security");
    expect(migration).toContain("alter table public.user_notifications enable row level security");
    expect(migration).toContain("alter table public.support_requests enable row level security");
    expect(migration).toContain("user_id = auth.uid()");
  });
  it("exposes authenticated RPC wrappers for all persisted account actions", () => {
    for (const name of ["loadUserExperienceSnapshot", "recordUserSearch", "clearUserSearchHistory", "updateUserPreferences", "markUserNotificationRead", "markAllUserNotificationsRead", "createSupportRequest"]) expect(services).toContain(`export async function ${name}`);
  });
  it("preserves the existing Profile hierarchy while routing preference, notification, history, and support actions live", () => {
    expect(app).toContain("userExperience: <UserExperience");
    expect(app).toContain('"Search history"');
    expect(app).toContain('"Help & Support"');
    expect(app).toContain("recordUserSearch(query.trim())");
    expect(app).toContain("loadUserExperienceSnapshot()");
  });
});
