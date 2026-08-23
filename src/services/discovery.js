import { supabase } from "../lib/supabase";

const emptySnapshot = Object.freeze({
  events: [],
  upcomingEvents: [],
  popularArtists: [],
  trendingEvents: [],
  nearbyEvents: [],
  popularVenues: [],
  recentlyPlayed: [],
  personalMostPlayed: [],
  platformMostPlayed: [],
  popularSongs: [],
  popularAlbums: [],
  mostLikedSongs: [],
  mostLikedArtists: [],
  mostWatchedMusicVideos: [],
  privatePlaylists: [],
  publicPlaylists: [],
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function loadDiscoverySnapshot({ latitude = null, longitude = null, radiusKm = 25 } = {}) {
  const { data, error } = await supabase.rpc("get_discovery_snapshot", {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_km: radiusKm,
  });
  if (error) throw error;
  return { ...emptySnapshot, ...(data || {}), generatedAt: data?.generatedAt || null };
}

export async function recordDiscoveryEvent({ eventType, entityType, entityId, sessionId = null, idempotencyKey = null, durationSeconds = 0, completed = false, metadata = {} }) {
  if (!eventType || !entityType || !entityId) throw new Error("Discovery event requires an event type, entity type, and entity id.");
  const { data, error } = await supabase.rpc("record_discovery_event", {
    p_event_type: eventType,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_session_id: sessionId,
    p_idempotency_key: idempotencyKey,
    p_duration_seconds: durationSeconds,
    p_completed: completed,
    p_metadata: metadata,
  });
  if (error) throw error;
  return data;
}

export const getEvents = (snapshot) => asArray(snapshot?.events);
export const getUpcomingEvents = (snapshot) => asArray(snapshot?.upcomingEvents);
export const getPopularArtists = (snapshot) => asArray(snapshot?.popularArtists);
export const getTrendingEvents = (snapshot) => asArray(snapshot?.trendingEvents);
export const getNearbyEvents = (snapshot) => asArray(snapshot?.nearbyEvents);
export const getPopularVenues = (snapshot) => asArray(snapshot?.popularVenues);
export const getRecentlyPlayed = (snapshot) => asArray(snapshot?.recentlyPlayed);
export const getPersonalMostPlayed = (snapshot) => asArray(snapshot?.personalMostPlayed);
export const getPlatformMostPlayed = (snapshot) => asArray(snapshot?.platformMostPlayed);
export const getPopularSongs = (snapshot) => asArray(snapshot?.popularSongs);
export const getPopularAlbums = (snapshot) => asArray(snapshot?.popularAlbums);
export const getUserMostPlayedSongs = (snapshot) => asArray(snapshot?.personalMostPlayed);
export const getPlatformMostPlayedSongs = (snapshot) => asArray(snapshot?.platformMostPlayed);
export const getMostLikedSongs = (snapshot) => asArray(snapshot?.mostLikedSongs);
export const getMostLikedArtists = (snapshot) => asArray(snapshot?.mostLikedArtists);
export const getMostWatchedMusicVideos = (snapshot) => asArray(snapshot?.mostWatchedMusicVideos);
export const getPrivatePlaylists = (snapshot) => asArray(snapshot?.privatePlaylists);
export const getPublicPlaylists = (snapshot) => asArray(snapshot?.publicPlaylists);
