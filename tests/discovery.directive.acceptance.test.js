import { describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: { rpc } }));

import { loadDiscoverySnapshot, recordDiscoveryEvent } from "../src/services/discovery";

describe("Atizzy canonical discovery directive contracts", () => {
  it("loads one server-authoritative snapshot with explicit location inputs", async () => {
    rpc.mockResolvedValueOnce({ data: { popularSongs: [{ id: "song-1" }] }, error: null });
    const snapshot = await loadDiscoverySnapshot({ latitude: 6.52, longitude: 3.37, radiusKm: 25 });
    expect(rpc).toHaveBeenCalledWith("get_discovery_snapshot", { p_latitude: 6.52, p_longitude: 3.37, p_radius_km: 25 });
    expect(snapshot.popularSongs).toEqual([{ id: "song-1" }]);
    expect(snapshot.nearbyEvents).toEqual([]);
    expect(snapshot).not.toHaveProperty("mock");
  });

  it("normalizes permission-denied location to a safe null scope at the caller boundary", async () => {
    rpc.mockResolvedValueOnce({ data: { nearbyEvents: [] }, error: null });
    await loadDiscoverySnapshot({ latitude: null, longitude: null });
    expect(rpc).toHaveBeenLastCalledWith("get_discovery_snapshot", { p_latitude: null, p_longitude: null, p_radius_km: 25 });
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
