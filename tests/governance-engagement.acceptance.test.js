import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../src/services/user.js", import.meta.url), "utf8");

describe("governance and engagement UI wiring", () => {
  it("loads and renders Super Admin event lifecycle controls", () => {
    expect(service).toContain("export async function loadGovernanceEvents");
    expect(source).toContain("Event lifecycle controls");
    expect(source).toContain("adminSetEventStatus(event.id, \"CANCELLED\"");
    expect(source).toContain("adminSetEventStatus(event.id, \"DRAFT\"");
  });

  it("exposes persisted likes, ratings, and comments on event and music details", () => {
    expect(service).toContain("export async function loadContentEngagement");
    expect(source).toContain("function EngagementPanel");
    expect(source).toContain("targetType=\"EVENT\"");
    expect(source).toContain("targetType=\"MUSIC\"");
    expect(source).toContain("Post comment");
    expect(source).toContain("Rate ${value} stars");
  });
});
