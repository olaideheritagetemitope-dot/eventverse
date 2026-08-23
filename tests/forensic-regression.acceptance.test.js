import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shell = fs.readFileSync(path.resolve(process.cwd(), "src/EventVerse.jsx"), "utf8");
const catalog = fs.readFileSync(path.resolve(process.cwd(), "src/services/catalog.js"), "utf8");

describe("Deep regression contract coverage", () => {
  it("keeps the artist directory live and searchable without requiring verification", () => {
    expect(catalog).toContain('artists: () => supabase.from("artists")');
    expect(catalog).not.toContain('artists: () => supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,background_url").eq("verified", true)');
    expect(catalog).toContain('["artistProfiles", () => supabase.from("user_profiles").select("id,full_name,avatar_url").ilike("full_name", pattern).limit(20)]');
    expect(catalog).toContain('.or(`name.ilike.${pattern},bio.ilike.${pattern}`)');
    expect(shell).toContain('const show = (section) => tab === "All" || tab === section;');
    expect(shell).toContain('query && show("Artists")');
  });

  it("refreshes artist profiles by ID without letting optional media joins blank the profile", () => {
    expect(catalog).toContain('// The artist profile is authoritative and must not be rejected');
    expect(catalog).toContain('const [profileResult, videosResult, songsResult, albumsResult, eventsResult] = await Promise.allSettled([');
    expect(catalog).toContain('from("user_profiles").select("id,avatar_url")');
    expect(catalog).toContain('const artistRecord = { ...data, image_url: mediaUrl(data.image_url) || profileAvatar || null };');
    expect(catalog).toContain('.from("music_videos")');
    expect(catalog).toContain('thumbnail_url,video_url,status,published_at,created_at');
    expect(catalog).toContain('.from("songs")');
    expect(catalog).toContain('duration_seconds,audio_url,cover_url,lyrics_text,status,published_at,created_at');
    expect(shell).toContain('loadArtistDetail(data.id)');
    expect(shell).toContain('setResolvedArtist(data || null);');
    expect(shell).toContain('if (loadingArtist && !a)');
    expect(shell).toContain('window.location.pathname.match(/^\\/artists?\\/([^/]+)/)?.[1]');
    expect(shell).toContain('sharedArtistId ? "artist"');
    expect(shell).toContain('const albums = a.albums || [];');
    expect(shell).toContain('const events = a.events || [];');
  });

  it("does not let geolocation failure replace the live catalog and exposes its state", () => {
    expect(shell).toContain('const [locationState, setLocationState] = useState("unavailable");');
    expect(shell).toContain('positionError?.code === 1 ? "denied" : positionError?.code === 3 ? "timeout" : "unavailable"');
    expect(shell).toContain('loadDiscoverySnapshot(effectiveLocation)');
    expect(shell).toContain('const locationRef = useRef({ latitude: null, longitude: null });');
    expect(shell).toContain('Promise.allSettled([loadCatalog(), requestBrowserLocation()])');
    expect(shell).toContain('locationState={locationState}');
    expect(shell).toContain('onRetryLocation');
    expect(shell).toContain("Nearby events use general discovery");
  });

  it("preserves the authoritative venue deletion path", () => {
    expect(shell).toContain("deleteOwnedVenue");
    expect(shell).not.toContain("supabase.from(\"venues\").delete()");
  });
});
