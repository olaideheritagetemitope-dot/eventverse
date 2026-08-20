import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

describe("managed media critical fix", () => {
  it("uses a native picker with validation, preview, change, and removal controls", () => {
    const source = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
    expect(source).toMatch(/type=\"file\"/);
    expect(source).toMatch(/accept=\{accept\}/);
    expect(source).toMatch(/URL\.createObjectURL/);
    expect(source).toMatch(/Change \$\{label\}/);
    expect(source).toMatch(/Remove/);
    expect(source).not.toMatch(/placeholder=\"Image URL\"/);
  });

  it("keeps the internal managed-media validator least-privilege", () => {
    const migration = fs.readFileSync(path.join(root, "supabase/0041_managed_media_security_definer.sql"), "utf8");
    expect(migration).toMatch(/is_atizzy_managed_media_url\(p_url text\)[\s\S]*security definer/);
    expect(migration).toMatch(/validate_atizzy_media_writes\(\)[\s\S]*security definer/);
    expect(migration).toMatch(/revoke all on function public\.is_atizzy_managed_media_url\(text\) from public, anon, authenticated/);
    expect(migration).toMatch(/revoke all on function public\.validate_atizzy_media_writes\(\) from public, anon, authenticated/);
    expect(migration).not.toMatch(/grant execute on function public\.is_atizzy_managed_media_url\(text\) to anon/);
  });
});
