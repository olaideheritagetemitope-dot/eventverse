import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(
  path.join(root, 'supabase/0064_fix_super_admin_profile_email_lookup.sql'),
  'utf8',
);

describe('manual role assignment profile fallback', () => {
  it('does not read email from user_profiles', () => {
    expect(migration).not.toMatch(/up\.email|user_profiles[^;]*email/i);
    expect(migration).toContain('au.email');
    expect(migration).toContain('left join public.user_profiles up on up.id = au.id');
  });

  it('preserves direct activation and profile linking for manual assignment', () => {
    expect(migration).toMatch(/v_action not in \([\s\S]*'ASSIGN'[\s\S]*'RESTORE'[\s\S]*'REACTIVATE'[\s\S]*'ACTIVATE'/);
    expect(migration).toContain("p_role_code = 'ARTIST'::public.app_role");
    expect(migration).toContain("p_role_code = 'VENUE_MANAGER'::public.app_role");
    expect(migration).toContain("'APPROVED'");
    expect(migration).toContain('role_assignment_history');
  });
});
