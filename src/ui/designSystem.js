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
  };
}
