import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "src/EventVerse.jsx"), "utf8");
const authEffect = source.slice(source.indexOf("useEffect(() => {\n    let mounted = true;", source.indexOf("export default function EventVerseApp")), source.indexOf("useEffect(() => {\n    const roles = effectiveRoleCodes(account);"));

describe("authentication startup performance contracts", () => {
  it("releases the auth shell before catalog and account hydration complete", () => {
    const readyIndex = authEffect.indexOf("setAuthReady(true);");
    const restoreIndex = authEffect.indexOf("void restore();");
    expect(readyIndex).toBeGreaterThanOrEqual(0);
    expect(restoreIndex).toBeGreaterThan(readyIndex);
    expect(authEffect).toContain("load();");
  });

  it("does not issue a duplicate initial loadCurrentUser request", () => {
    expect(authEffect).not.toContain("loadCurrentUser().then((value)");
    expect(authEffect).toContain("void hydrateAccount(data.session.user);");
    expect(authEffect).toContain("setTimeout(() => { void hydrateAccount(session.user); }, 0);");
  });

  it("coalesces profile and role hydration for the same authenticated user", () => {
    expect(source).toContain("const accountHydrationRef = useRef(null);");
    expect(source).toContain("if (active?.userId === user.id) return active.promise;");
    expect(source).toContain("await ensureUserProfile(user);");
    expect(source).toContain("return loadCurrentUser();");
  });
});
