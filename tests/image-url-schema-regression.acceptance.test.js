import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/0047_fix_managed_media_trigger_regression.sql',
);

const migration = fs.readFileSync(migrationPath, 'utf8');
const executableMigration = migration.replace(/--.*$/gm, '');

describe('managed media image_url schema regression', () => {
  it('reads heterogeneous trigger rows through JSON instead of direct NEW column access', () => {
    expect(migration).toContain('v_row jsonb := to_jsonb(new);');
    expect(executableMigration).not.toMatch(/\bnew\.(image_url|avatar_url|image_urls)\b/i);
    expect(executableMigration).not.toMatch(/\bNEW\.(image_url|avatar_url|image_urls)\b/i);
  });

  it('reasserts table-specific media trigger columns', () => {
    expect(migration).toContain('before insert or update of avatar_url on public.user_profiles');
    expect(migration).toContain('before insert or update of image_url on public.artists');
    expect(migration).toContain('before insert or update of cover_url on public.events');
    expect(migration).toContain('before insert or update of image_urls on public.venues');
  });
});
