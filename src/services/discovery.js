import { supabase } from "../lib/supabase";

import { toEvent, toArtist, toSong, toMusicVideo } from "./catalog";

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
  latestSongs: [],
  allSongs: [],
  latestArtists: [],
  allArtists: [],
  latestAlbums: [],
  allAlbums: [],
  newVenues: [],
  allVenues: [],
  latestEvents: [],
  allEvents: [],
  latestMusicVideos: [],
  allMusicVideos: [],
  latestPublicPlaylists: [],
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function firstNonEmpty(...arrays) {
  return arrays.find((value) => Array.isArray(value) && value.length > 0) || [];
}

const normalizeEvents = (rows) => asArray(rows).map((row, index) => {
  // Base-catalog rows are already normalized; raw RPC rows are SQL-shaped.
  return typeof row?.date === "string" && Object.prototype.hasOwnProperty.call(row, "img")
    ? row
    : toEvent(row, index);
});

const normalizeArtists = (rows) => asArray(rows).map((row) => {
  const alreadyNormalized = typeof row?.name === "string" && (
    Object.prototype.hasOwnProperty.call(row, "img") ||
    Object.prototype.hasOwnProperty.call(row, "avatarUrl")
  );
  return alreadyNormalized ? row : toArtist(row);
});

const normalizeSongs = (rows) => asArray(rows).map((row) => (
  typeof row?.duration === "string" || Object.prototype.hasOwnProperty.call(row, "audioUrl")
    ? row
    : toSong(row)
));

const normalizeMusicVideos = (rows) => asArray(rows).map((row) => toMusicVideo(row));

export function normalizeDiscoverySnapshot(snapshot) {
  const value = snapshot && typeof snapshot === "object" ? snapshot : {};
  return {
    ...emptySnapshot,
    ...value,
    events: normalizeEvents(value.events),
    upcomingEvents: normalizeEvents(value.upcomingEvents),
    trendingEvents: normalizeEvents(value.trendingEvents),
    nearbyEvents: normalizeEvents(value.nearbyEvents),
    latestEvents: normalizeEvents(value.latestEvents),
    allEvents: normalizeEvents(value.allEvents),
    popularArtists: normalizeArtists(value.popularArtists),
    latestArtists: normalizeArtists(value.latestArtists),
    allArtists: normalizeArtists(value.allArtists),
    mostLikedArtists: normalizeArtists(value.mostLikedArtists),
    popularSongs: normalizeSongs(value.popularSongs),
    latestSongs: normalizeSongs(value.latestSongs),
    allSongs: normalizeSongs(value.allSongs),
    mostLikedSongs: normalizeSongs(value.mostLikedSongs),
    recentlyPlayed: normalizeSongs(value.recentlyPlayed),
    personalMostPlayed: normalizeSongs(value.personalMostPlayed),
    platformMostPlayed: normalizeSongs(value.platformMostPlayed),
    mostWatchedMusicVideos: normalizeMusicVideos(value.mostWatchedMusicVideos),
    latestMusicVideos: normalizeMusicVideos(value.latestMusicVideos),
    allMusicVideos: normalizeMusicVideos(value.allMusicVideos),
  };
}

function settledRpcResult(label, result) {
  if (result.status === "fulfilled") {
    if (result.value?.error) {
      console.error(`Atizzy ${label} discovery RPC failed`, result.value.error);
      return { data: null, error: result.value.error };
    }
    return { data: result.value?.data || null, error: null };
  }
  console.error(`Atizzy ${label} discovery RPC rejected`, result.reason);
  return { data: null, error: result.reason };
}

export async function loadDiscoverySnapshot({ latitude = null, longitude = null, radiusKm = 25, limit = 24, offset = 0 } = {}) {
  const results = await Promise.allSettled([
    supabase.rpc("get_discovery_snapshot", {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_km: radiusKm,
    }),
    supabase.rpc("get_cold_start_discovery_catalogue", {
      p_limit: limit,
      p_offset: offset,
    }),
  ]);
  const rankedResult = settledRpcResult("ranked", results[0]);
  const catalogueResult = settledRpcResult("cold-start catalogue", results[1]);
  const rankedData = rankedResult.data || {};
  const catalogueData = catalogueResult.data || {};
  return normalizeDiscoverySnapshot({
    ...emptySnapshot,
    ...rankedData,
    ...catalogueData,
    generatedAt: catalogueData.generatedAt || rankedData.generatedAt || null,
    discoveryStatus: {
      ranked: rankedResult.error ? "error" : "success",
      catalogue: catalogueResult.error ? "error" : "success",
    },
    discoveryErrors: {
      ranked: rankedResult.error || null,
      catalogue: catalogueResult.error || null,
    },
  });
}

export async function loadDiscoveryCatalogue({ limit = 24, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc("get_cold_start_discovery_catalogue", { p_limit: limit, p_offset: offset });
  if (error) throw error;
  return normalizeDiscoverySnapshot({ ...emptySnapshot, ...(data || {}), generatedAt: data?.generatedAt || null });
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
export const getLatestSongs = (snapshot) => asArray(snapshot?.latestSongs);
export const getAllSongs = (snapshot) => asArray(snapshot?.allSongs);
export const getLatestArtists = (snapshot) => asArray(snapshot?.latestArtists);
export const getAllArtists = (snapshot) => asArray(snapshot?.allArtists);
export const getLatestAlbums = (snapshot) => asArray(snapshot?.latestAlbums);
export const getAllAlbums = (snapshot) => asArray(snapshot?.allAlbums);
export const getNewVenues = (snapshot) => asArray(snapshot?.newVenues);
export const getAllVenues = (snapshot) => asArray(snapshot?.allVenues);
export const getLatestEvents = (snapshot) => asArray(snapshot?.latestEvents);
export const getAllEvents = (snapshot) => asArray(snapshot?.allEvents);
export const getLatestMusicVideos = (snapshot) => asArray(snapshot?.latestMusicVideos);
export const getAllMusicVideos = (snapshot) => asArray(snapshot?.allMusicVideos);
export const getLatestPublicPlaylists = (snapshot) => asArray(snapshot?.latestPublicPlaylists);
