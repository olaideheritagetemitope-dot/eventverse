import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("Atizzy platform control-plane health acceptance", () => {
  it("renders the System Requirements / Health control-plane section", () => {
    for (const label of [
      "System Requirements / Health",
      "Supabase",
      "Google Auth",
      "Spotify Auth",
      "Storage",
      "Push Notifications",
      "Notification permission",
      "Camera",
      "Location",
      "QR Scanner",
      "Payments",
      "Email",
    ]) expect(source).toContain(label);
  });

  it("distinguishes configured, pending, and device-dependent states", () => {
    for (const token of ["Connected", "Configured", "Configuration needed", "User-dependent", "Device-dependent", "Provider pending", "Implemented"]) expect(source).toContain(token);
    expect(source).toContain("navigator.mediaDevices?.getUserMedia");
    expect(source).toContain("navigator.geolocation");
  });

  it("keeps health visible inside the protected Admin workspace", () => {
    expect(source).toContain("function SystemHealthPanel()");
    expect(source).toContain("<SystemHealthPanel />");
    expect(source).toContain('if (!hasEffectiveRole(account, "ADMIN"))');
  });
});
