import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/catalog.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase/0121_related_content_engine.sql"), "utf8");

describe("Related Content engine contract", () => {
  it("uses one live RPC wrapper and does not block detail pages on failure", () => {
    expect(service).toContain('supabase.rpc("get_related_content"');
    expect(service).toContain("rpcRow.related_payload");
    expect(service).toContain("Array.isArray(payload.items)");
    expect(source).toContain("loadRelatedContent(entityType, entityId");
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain("Related content is temporarily unavailable.");
    expect(source).toContain("No related content available yet.");
  });

  it("covers all first-class content types and has a real See all route", () => {
    for (const type of ["EVENT", "ARTIST", "VENUE", "SONG", "ALBUM", "MUSIC_VIDEO", "PLAYLIST"]) {
      expect(sql).toContain(`'${type}'`);
    }
    expect(source).toContain('nav.push("relatedContent"');
    expect(source).toContain('relatedContent: <RelatedContentScreen');
    expect(source).toContain('albumDetail: <AlbumDetail');
  });

  it("filters the recommendation surface to published/public/live records and excludes the current item", () => {
    expect(sql).toContain("e.id <> p_entity_id");
    expect(sql).toContain("e.status::text in ('PUBLISHED','SOLD_OUT','LIVE')");
    expect(sql).toContain("a.verified = true");
    expect(sql).toContain("v.status::text = 'ACTIVE'");
    expect(sql).toContain("s.status::text='PUBLISHED'");
    expect(sql).toContain("al.status::text='PUBLISHED'");
    expect(sql).toContain("mv.status::text='PUBLISHED'");
    expect(sql).toContain("p.visibility='PUBLIC'");
  });

  it("keeps relationship and location indexes in the canonical migration", () => {
    expect(sql).toContain("event_artists_artist_event_idx");
    expect(sql).toContain("playlist_items_song_playlist_idx");
    expect(sql).toContain("events_venue_status_time_idx");
    expect(sql).toContain("events_organizer_status_time_idx");
  });
});
