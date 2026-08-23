export const ATIZZY_TOKENS = Object.freeze({
  bg: "#0B0A08",
  card: "#17140F",
  card2: "#1D1811",
  blue: "#12141C",
  wood: "#3A2A1B",
  woodLight: "#4A3624",
  green: "#16261D",
  greenLight: "#1E3327",
  gold: "#CDA349",
  goldSoft: "#E4C179",
  ivory: "#F3EEE3",
  muted: "#8B8577",
  line: "#2A2419",
  red: "#E98979",
});

export const ATIZZY_MODULES = Object.freeze([
  { key: "home", label: "Home", surface: "discovery" },
  { key: "explore", label: "Explore", surface: "discovery" },
  { key: "music", label: "Music", surface: "music" },
  { key: "tickets", label: "Tickets", surface: "commerce" },
  { key: "profile", label: "Profile", surface: "account" },
  { key: "governance", label: "Super Admin", surface: "governance" },
]);

export const EMPTY_CATALOG = Object.freeze({
  events: [],
  artists: [],
  songs: [],
  categories: [],
  venues: [],
});

export function resourceState({ loading = false, error = "", data = null } = {}) {
  return {
    status: loading ? "loading" : error ? "error" : data == null ? "idle" : "success",
    loading,
    error: error || "",
    data,
    isEmpty: Array.isArray(data) ? data.length === 0 : false,
  };
}

export function normalizeCatalog(value) {
  return {
    events: Array.isArray(value?.events) ? value.events : [],
    artists: Array.isArray(value?.artists) ? value.artists : [],
    songs: Array.isArray(value?.songs) ? value.songs : [],
    categories: Array.isArray(value?.categories) ? value.categories : [],
    venues: Array.isArray(value?.venues) ? value.venues : [],
    discovery: value?.discovery && typeof value.discovery === "object" ? value.discovery : null,
    upcomingEvents: Array.isArray(value?.upcomingEvents) ? value.upcomingEvents : [],
    popularArtists: Array.isArray(value?.popularArtists) ? value.popularArtists : [],
    trendingEvents: Array.isArray(value?.trendingEvents) ? value.trendingEvents : [],
    nearbyEvents: Array.isArray(value?.nearbyEvents) ? value.nearbyEvents : [],
    popularVenues: Array.isArray(value?.popularVenues) ? value.popularVenues : [],
    recentlyPlayed: Array.isArray(value?.recentlyPlayed) ? value.recentlyPlayed : [],
    personalMostPlayed: Array.isArray(value?.personalMostPlayed) ? value.personalMostPlayed : [],
    platformMostPlayed: Array.isArray(value?.platformMostPlayed) ? value.platformMostPlayed : [],
    popularSongs: Array.isArray(value?.popularSongs) ? value.popularSongs : [],
    popularAlbums: Array.isArray(value?.popularAlbums) ? value.popularAlbums : [],
    mostLikedSongs: Array.isArray(value?.mostLikedSongs) ? value.mostLikedSongs : [],
    mostLikedArtists: Array.isArray(value?.mostLikedArtists) ? value.mostLikedArtists : [],
    mostWatchedMusicVideos: Array.isArray(value?.mostWatchedMusicVideos) ? value.mostWatchedMusicVideos : [],
    privatePlaylists: Array.isArray(value?.privatePlaylists) ? value.privatePlaylists : [],
    publicPlaylists: Array.isArray(value?.publicPlaylists) ? value.publicPlaylists : [],
  };
}
