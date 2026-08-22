import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPaths = [
  'supabase/0047_fix_managed_media_trigger_regression.sql',
  'supabase/0074_fix_shared_media_trigger_avatar_regression.sql',
  'supabase/0075_fix_managed_media_helper_permissions.sql',
].map((relativePath) => path.resolve(process.cwd(), relativePath));

const historicalArtistMigration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/0070_artist_background_media_guard.sql'),
  'utf8',
);

const migrations = migrationPaths.map((migrationPath) => {
  const source = fs.readFileSync(migrationPath, 'utf8');
  return { source, executable: source.replace(/--.*$/gm, '') };
});

describe('managed media image_url schema regression', () => {
  it('keeps the repaired shared-trigger migrations JSONB-safe for heterogeneous rows', () => {
    for (const { source, executable } of migrations) {
      expect(source).toContain('v_row jsonb := to_jsonb(new);');
      expect(executable).not.toMatch(/\bnew\.(image_url|avatar_url|image_urls|background_url|cover_url|audio_url)\b/i);
      expect(executable).not.toMatch(/\bNEW\.(image_url|avatar_url|image_urls|background_url|cover_url|audio_url)\b/i);
    }
  });

  it('documents the historical regression and verifies the forward migration supersedes it', () => {
    expect(historicalArtistMigration).toMatch(/new\.image_urls|new\.avatar_url|new\.image_url/);
    expect(migrations.at(-1).executable).not.toMatch(/\bnew\.(image_url|avatar_url|image_urls)\b/i);
  });

  it('uses JSONB accessors for venue media and preserves the venue image_urls contract', () => {
    const latest = migrations.at(-1).source;
    expect(latest).toContain("v_row -> 'image_urls'");
    expect(latest).toContain('security definer');
    expect(latest).toContain('revoke all on function public.is_atizzy_managed_media_url(text)');
    expect(latest).toContain('before insert or update of image_urls on public.venues');
    expect(latest).not.toMatch(/\bnew\.(avatar_url|image_url|image_urls)\b/i);
  });

  it('reasserts table-specific media trigger columns', () => {
    const latest = migrations.at(-1).source;
    expect(latest).toContain('before insert or update of avatar_url on public.user_profiles');
    expect(latest).toContain('before insert or update of image_url, background_url on public.artists');
    expect(latest).toContain('before insert or update of cover_url, audio_url on public.songs');
    expect(latest).toContain('before insert or update of cover_url on public.events');
    expect(latest).toContain('before insert or update of image_url on public.posts');
    expect(latest).toContain('before insert or update of image_urls on public.venues');
  });
});


describe('event and venue image visibility contract', () => {
  it('loads venue image_urls in catalog, search, and detail queries and exposes imageUrl', () => {
    const catalogSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/catalog.js'), 'utf8');
    expect(catalogSource).toContain('capacity,status,image_urls');
    expect(catalogSource).toContain('imageUrl: firstVenueImage(venue)');
    expect(catalogSource).toContain('mediaUrl(event.cover_url || event.image_url || event.image_urls)');
  });

  it('passes normalized event and venue images into the existing Atizzy visual surfaces', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/EventVerse.jsx'), 'utf8');
    expect(appSource).toContain('imageStyle(ev.img, `linear-gradient(145deg, ${C.wood}, ${C.green})`)');
    expect(appSource).toContain('imageStyle(venue.imageUrl, `linear-gradient(160deg, ${C.wood}, ${C.blue})`)');
    expect(appSource).toContain('imageStyle(venue?.imageUrl, `linear-gradient(145deg, ${C.wood}, ${C.card})`)');
  });
});
