import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: { rpc } }));

import { loadDiscoverySnapshot, recordDiscoveryEvent } from "../src/services/discovery";

describe("Atizzy canonical discovery directive contracts", () => {
  beforeEach(() => rpc.mockReset());

  it("loads ranked and cold-start catalogue data with explicit location inputs", async () => {
    rpc
      .mockResolvedValueOnce({ data: { popularSongs: [{ id: "song-1" }] }, error: null })
      .mockResolvedValueOnce({ data: { latestSongs: [{ id: "song-new" }], latestEvents: [{ id: "event-new" }] }, error: null });
    const snapshot = await loadDiscoverySnapshot({ latitude: 6.52, longitude: 3.37, radiusKm: 25 });
    expect(rpc).toHaveBeenCalledWith("get_discovery_snapshot", { p_latitude: 6.52, p_longitude: 3.37, p_radius_km: 25 });
    expect(rpc).toHaveBeenCalledWith("get_cold_start_discovery_catalogue", { p_limit: 24, p_offset: 0 });
    expect(snapshot.popularSongs[0]).toEqual(expect.objectContaining({ id: "song-1", duration: "0:00", audioUrl: null }));
    expect(snapshot.nearbyEvents).toEqual([]);
    expect(snapshot.latestSongs[0]).toEqual(expect.objectContaining({ id: "song-new", duration: "0:00", audioUrl: null }));
    expect(snapshot.latestEvents[0]).toEqual(expect.objectContaining({ id: "event-new", date: "Date pending", venue: "Venue pending", img: null }));
    expect(snapshot).not.toHaveProperty("mock");
  });

  it("rehydrates artist identity on partially-normalized song rows", async () => {
    rpc
      .mockResolvedValueOnce({ data: { popularSongs: [{ id: "song-live", title: "Badmangangsta", artist: "Asake", duration: "3:00", audioUrl: "https://cdn.example/audio.mp3" }] }, error: null })
      .mockResolvedValueOnce({ data: { latestSongs: [] }, error: null });
    const snapshot = await loadDiscoverySnapshot();
    expect(snapshot.popularSongs[0]).toEqual(expect.objectContaining({ id: "song-live", artist: "Asake", title: "Badmangangsta" }));
  });

  it("prefers artist-enriched ranked rows when cold-start returns the same ids without identity", async () => {
    rpc
      .mockResolvedValueOnce({ data: { popularSongs: [{ id: "song-live", title: "Badmangangsta", artist: "Asake" }], mostWatchedMusicVideos: [{ id: "video-live", title: "Never have I", artist: "Asake" }] }, error: null })
      .mockResolvedValueOnce({ data: { popularSongs: [{ id: "song-live", title: "Badmangangsta", artist_id: "artist-1" }], mostWatchedMusicVideos: [{ id: "video-live", title: "Never have I", artist_id: "artist-1" }] }, error: null });
    const snapshot = await loadDiscoverySnapshot();
    expect(snapshot.popularSongs[0]).toEqual(expect.objectContaining({ id: "song-live", artist: "Asake" }));
    expect(snapshot.mostWatchedMusicVideos[0]).toEqual(expect.objectContaining({ id: "video-live", artist: "Asake" }));
  });

  it("keeps ranked data when the cold-start catalogue RPC fails", async () => {
    rpc
      .mockResolvedValueOnce({ data: { popularSongs: [{ id: "song-ranked" }], events: [{ id: "event-ranked" }] }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "cold-start unavailable" } });
    const snapshot = await loadDiscoverySnapshot();
    expect(snapshot.popularSongs[0]).toEqual(expect.objectContaining({ id: "song-ranked", duration: "0:00" }));
    expect(snapshot.events[0]).toEqual(expect.objectContaining({ id: "event-ranked", date: "Date pending", venue: "Venue pending", img: null }));
    expect(snapshot.discoveryStatus).toEqual({ ranked: "success", catalogue: "error" });
  });

  it("keeps cold-start data when the ranked discovery RPC fails", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "ranked unavailable" } })
      .mockResolvedValueOnce({ data: { latestSongs: [{ id: "song-new" }], latestEvents: [{ id: "event-new" }] }, error: null });
    const snapshot = await loadDiscoverySnapshot();
    expect(snapshot.latestSongs[0]).toEqual(expect.objectContaining({ id: "song-new", duration: "0:00" }));
    expect(snapshot.latestEvents[0]).toEqual(expect.objectContaining({ id: "event-new", date: "Date pending", venue: "Venue pending", img: null }));
    expect(snapshot.discoveryStatus).toEqual({ ranked: "error", catalogue: "success" });
  });

  it("returns a safe empty discovery snapshot when both RPCs fail", async () => {
    rpc
      .mockRejectedValueOnce(new Error("ranked network failure"))
      .mockResolvedValueOnce({ data: null, error: { message: "catalogue unavailable" } });
    const snapshot = await loadDiscoverySnapshot();
    expect(snapshot.events).toEqual([]);
    expect(snapshot.latestSongs).toEqual([]);
    expect(snapshot.discoveryStatus).toEqual({ ranked: "error", catalogue: "error" });
  });

  it("normalizes permission-denied location to a safe null scope at the caller boundary", async () => {
    rpc
      .mockResolvedValueOnce({ data: { nearbyEvents: [] }, error: null })
      .mockResolvedValueOnce({ data: { latestSongs: [] }, error: null });
    await loadDiscoverySnapshot({ latitude: null, longitude: null });
    expect(rpc).toHaveBeenCalledWith("get_discovery_snapshot", { p_latitude: null, p_longitude: null, p_radius_km: 25 });
  });

  it("keeps catalogue loading paginated and ranking-independent", async () => {
    rpc.mockResolvedValueOnce({ data: { latestSongs: [{ id: "song-new" }], allSongs: [{ id: "song-new" }], newVenues: [{ id: "venue-new" }] }, error: null });
    const catalogue = await (await import("../src/services/discovery")).loadDiscoveryCatalogue({ limit: 12, offset: 24 });
    expect(rpc).toHaveBeenCalledWith("get_cold_start_discovery_catalogue", { p_limit: 12, p_offset: 24 });
    expect(catalogue.latestSongs[0]).toEqual(expect.objectContaining({ id: "song-new", duration: "0:00" }));
    expect(catalogue.newVenues).toEqual([{ id: "venue-new" }]);
  });

  it("normalizes raw discovery events so EventCard date rendering cannot throw", async () => {
    rpc
      .mockResolvedValueOnce({ data: { events: [{ id: "event-raw", title: "Live event", starts_at: "2026-08-24T20:00:00Z", city: "Lagos", cover_url: null }] }, error: null })
      .mockResolvedValueOnce({ data: { latestEvents: [] }, error: null });
    const snapshot = await loadDiscoverySnapshot();
    const event = snapshot.events[0];
    expect(event.date).toMatch(/2026|Aug|24|Date pending/);
    expect(event.venue).toBe("Lagos");
    expect(event.img).toBeNull();
    expect(() => event.date.split(" ")).not.toThrow();
  });

  it("records qualified events through the single canonical RPC contract", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "event-1" }, error: null });
    await recordDiscoveryEvent({ eventType: "SONG_PLAY_QUALIFIED", entityType: "SONG", entityId: "song-1", sessionId: "session-1", idempotencyKey: "session-1:qualified", durationSeconds: 30, completed: false });
    expect(rpc).toHaveBeenCalledWith("record_discovery_event", {
      p_event_type: "SONG_PLAY_QUALIFIED",
      p_entity_type: "SONG",
      p_entity_id: "song-1",
      p_session_id: "session-1",
      p_idempotency_key: "session-1:qualified",
      p_duration_seconds: 30,
      p_completed: false,
      p_metadata: {},
    });
  });
});
