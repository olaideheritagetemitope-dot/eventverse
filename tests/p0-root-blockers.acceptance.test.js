import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const eventVerse = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const userService = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");

function stripComments(source) {
  return source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("P0 root blocker contracts", () => {
  it("does not write provider-hosted OAuth avatar URLs during profile bootstrap", () => {
    const bootstrap = eventVerse.slice(eventVerse.indexOf("async function ensureUserProfile"), eventVerse.indexOf("const font ="));
    expect(bootstrap).toContain("{ id: user.id, full_name: fullName }");
    expect(bootstrap).not.toMatch(/avatar_url\s*:\s*user\.user_metadata/);
    expect(bootstrap).not.toMatch(/picture\s*\|\|/);
  });

  it("fails closed when authoritative role context is unavailable", () => {
    const source = stripComments(userService);
    expect(source).toContain("const roleContextFailed = Boolean(roleContextError);");
    expect(source).toContain("effectiveRoles: roleContextFailed ? []");
    expect(source).toContain("primaryRole: roleContextFailed ? null");
    expect(source).not.toMatch(/effectiveRoles:\s*Array\.isArray\(roleContext\?\.effective_roles\).*fallbackEffectiveRoles/);
  });
});
