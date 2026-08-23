import { supabase } from "../lib/supabase";

// These IDs come only from the original synthetic catalog seed. They are excluded at the
// domain-service boundary so real dependent orders are never deleted from production.
export const SYNTHETIC_CATALOG_IDS = Object.freeze({
  events: new Set([
    "40000000-0000-0000-0000-000000000001",
    "40000000-0000-0000-0000-000000000002",
    "40000000-0000-0000-0000-000000000003",
    "40000000-0000-0000-0000-000000000004",
    "40000000-0000-0000-0000-000000000005",
    "40000000-0000-0000-0000-000000000006",
  ]),
  venues: new Set([
    "20000000-0000-0000-0000-000000000001",
    "20000000-0000-0000-0000-000000000002",
    "20000000-0000-0000-0000-000000000003",
    "20000000-0000-0000-0000-000000000004",
    "20000000-0000-0000-0000-000000000005",
    "20000000-0000-0000-0000-000000000006",
  ]),
  artists: new Set([
    "30000000-0000-0000-0000-000000000001",
    "30000000-0000-0000-0000-000000000002",
    "30000000-0000-0000-0000-000000000003",
    "30000000-0000-0000-0000-000000000004",
    "30000000-0000-0000-0000-000000000005",
    "30000000-0000-0000-0000-000000000006",
  ]),
  songs: new Set([
    "60000000-0000-0000-0000-000000000001",
    "60000000-0000-0000-0000-000000000002",
    "60000000-0000-0000-0000-000000000003",
    "60000000-0000-0000-0000-000000000004",
    "60000000-0000-0000-0000-000000000005",
  ]),
});

export const isSyntheticCatalogRecord = (kind, record) => Boolean(record?.id && SYNTHETIC_CATALOG_IDS[kind]?.has(record.id));
export const filterLiveCatalogRows = (kind, rows) => (rows || []).filter((row) => !isSyntheticCatalogRecord(kind, row));

const mediaUrl = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = mediaUrl(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === "object") return mediaUrl(value.public_url || value.publicUrl || value.url || value.image_url || value.cover_url || value.path || value.object_path);
  return null;
};

const firstVenueImage = (venue) => mediaUrl(venue?.image_urls || venue?.imageUrl || venue?.image_url || venue?.cover_url);

export const formatFollowers = (value) => {
  const count = Number(value || 0);
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
};

export const formatDateTime = (value) => {
  if (!value) return { date: "Date pending", time: "Time pending" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Date pending", time: "Time pending" };
  return {
    date: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
};

export const toEvent = (event, index = 0) => {
  const time = formatDateTime(event.starts_at);
  const ticketPrices = Array.isArray(event.ticket_types) ? event.ticket_types.map((item) => Number(item.price || 0)).filter(Boolean) : [];
  return {
    ...event,
    id: event.id,
    title: event.title,
    venue: event.venues?.name || event.city || "Venue pending",
    venueRecord: event.venues || null,
    date: time.date,
    time: time.time,
    price: ticketPrices.length ? Math.min(...ticketPrices) : null,
    rating: event.rating == null ? null : Number(event.rating),
    reviews: Number(event.review_count || 0),
    coverUrl: mediaUrl(event.cover_url || event.image_url || event.image_urls),
    img: mediaUrl(event.cover_url || event.image_url || event.image_urls),
    tag: index === 0 ? "Featured" : index === 1 ? "Trending" : null,
  };
};

const artistAvatarSource = (artist) => artist?.image_url || artist?.avatar_url || artist?.avatarUrl || artist?.profile_image_url || null;
const artistBackgroundSource = (artist) => artist?.background_url || artist?.background_image_url || artist?.cover_url || artist?.coverUrl || null;

export const toArtist = (artist) => {
  const avatarUrl = artistAvatarSource(artist);
  const backgroundUrl = artistBackgroundSource(artist);
  return {
    ...artist,
    id: artist.id,
    name: artist.name,
    followers: formatFollowers(artist.follower_count),
    verified: Boolean(artist.verified),
    avatarUrl,
    backgroundUrl,
    coverUrl: backgroundUrl || avatarUrl || null,
    img: avatarUrl,
  };
};

export async function loadArtistDetail(artistId) {
  if (!artistId) return null;
  const { data, error } = await supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,background_url,created_at,updated_at").eq("id", artistId).maybeSingle();
  if (error) throw error;
  return data ? toArtist(data) : null;
}

export const toSong = (song) => ({
  ...song,
  id: song.id,
  title: song.title,
  artist: song.artists?.name || "Artist pending",
  artistId: song.artist_id,
  duration: `${Math.floor(Number(song.duration_seconds || 0) / 60)}:${String(Number(song.duration_seconds || 0) % 60).padStart(2, "0")}`,
  plays: formatFollowers(song.play_count),
  audioUrl: song.audio_url || null,
  coverUrl: song.cover_url || null,
});

export async function loadCatalog() {
  const [eventResult, artistResult, songResult, categoryResult, venueResult] = await Promise.all([
    supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,rating,review_count,venues(id,name,city,address,capacity),ticket_types(id,price)").in("status", ["PUBLISHED", "SOLD_OUT", "LIVE", "COMPLETED"]).order("starts_at"),
    supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,background_url").eq("verified", true).order("follower_count", { ascending: false }),
    supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,status,published_at,artists(id,name,image_url)").eq("status", "PUBLISHED").not("audio_url", "is", null).order("play_count", { ascending: false }),
    supabase.from("categories").select("id,name,slug").order("name"),
    supabase.from("venues").select("id,name,city,address,capacity,status,image_urls").eq("status", "ACTIVE").order("name"),
  ]);
  const firstError = [eventResult, artistResult, songResult, categoryResult, venueResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return {
    events: filterLiveCatalogRows("events", eventResult.data).map(toEvent),
    artists: filterLiveCatalogRows("artists", artistResult.data).map(toArtist),
    songs: filterLiveCatalogRows("songs", songResult.data).map(toSong),
    categories: categoryResult.data || [],
    venues: filterLiveCatalogRows("venues", venueResult.data).map((venue) => ({ ...venue, imageUrl: firstVenueImage(venue) })),
  };
}

export async function searchCatalog(query) {
  const term = query.trim();
  if (!term) return { events: [], artists: [], songs: [], venues: [] };
  const pattern = `%${term}%`;
  const [eventResult, artistResult, songResult, venueResult] = await Promise.all([
    supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,rating,review_count,venues(id,name,city,address,capacity),ticket_types(id,price)").in("status", ["PUBLISHED", "SOLD_OUT", "LIVE", "COMPLETED"]).or(`title.ilike.${pattern},description.ilike.${pattern},city.ilike.${pattern}`).order("starts_at").limit(20),
    supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,background_url").eq("verified", true).or(`name.ilike.${pattern},bio.ilike.${pattern}`).order("follower_count", { ascending: false }).limit(20),
    supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,status,published_at,artists(id,name,image_url)").eq("status", "PUBLISHED").not("audio_url", "is", null).ilike("title", pattern).order("play_count", { ascending: false }).limit(20),
    supabase.from("venues").select("id,name,city,address,capacity,status,image_urls").eq("status", "ACTIVE").or(`name.ilike.${pattern},city.ilike.${pattern},address.ilike.${pattern}`).order("name").limit(20),
  ]);
  const firstError = [eventResult, artistResult, songResult, venueResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return {
    events: filterLiveCatalogRows("events", eventResult.data).map(toEvent),
    artists: filterLiveCatalogRows("artists", artistResult.data).map(toArtist),
    songs: filterLiveCatalogRows("songs", songResult.data).map(toSong),
    venues: filterLiveCatalogRows("venues", venueResult.data).map((venue) => ({ ...venue, imageUrl: firstVenueImage(venue) })),
  };
}

export async function loadEventDetail(eventId) {
  const [eventResult, artistResult, ticketResult] = await Promise.all([
    supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,rating,review_count,venues(id,name,city,address,capacity)").eq("id", eventId).maybeSingle(),
    supabase.from("event_artists").select("artist_id,artists(id,user_id,name,bio,verified,follower_count,image_url)").eq("event_id", eventId),
    supabase.from("ticket_types").select("id,event_id,name,price,capacity,sold,reserved,maximum_per_customer,sales_start,sales_end").eq("event_id", eventId).order("price"),
  ]);
  const firstError = [eventResult, artistResult, ticketResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  const liveEvent = isSyntheticCatalogRecord("events", eventResult.data) ? null : eventResult.data;
  return {
    event: liveEvent ? { ...toEvent(liveEvent), description: liveEvent.description || "" } : null,
    artists: filterLiveCatalogRows("artists", (artistResult.data || []).map((row) => row.artists)).map(toArtist).filter((artist) => artist.id),
    ticketTypes: liveEvent ? ticketResult.data || [] : [],
  };
}

export async function loadVenueDetail(venueId) {
  const [venueResult, eventResult] = await Promise.all([
    supabase.from("venues").select("id,name,city,address,capacity,status,image_urls").eq("id", venueId).neq("status", "ARCHIVED").maybeSingle(),
    supabase.from("events").select("id,title,description,event_type,city,starts_at,ends_at,cover_url,status,rating,review_count,venues(id,name,city,address,capacity),ticket_types(id,price)").eq("venue_id", venueId).in("status", ["PUBLISHED", "SOLD_OUT", "LIVE", "COMPLETED"]).order("starts_at").limit(30),
  ]);
  const firstError = [venueResult, eventResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return {
    venue: isSyntheticCatalogRecord("venues", venueResult.data) ? null : venueResult.data ? { ...venueResult.data, imageUrl: firstVenueImage(venueResult.data) } : null,
    events: filterLiveCatalogRows("events", eventResult.data).map(toEvent),
  };
}
