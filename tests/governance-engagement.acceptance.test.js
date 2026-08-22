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

describe("content comment profile relationship contract", () => {
  it("uses the declared live PostgREST author relationship", () => {
    expect(service).toContain('from("content_comments").select("id,body,author_id,created_at,user_profiles(id,full_name,avatar_url)")');
    expect(service).toContain("user_profiles: comment.user_profiles || null");
    expect(service).not.toContain("profileById.get(comment.author_id)");
  });
});
