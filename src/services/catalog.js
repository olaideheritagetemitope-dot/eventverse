import { supabase } from "../lib/supabase";

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
    coverUrl: event.cover_url || null,
    img: event.cover_url || null,
    tag: index === 0 ? "Featured" : index === 1 ? "Trending" : null,
  };
};

export const toArtist = (artist) => ({
  ...artist,
  id: artist.id,
  name: artist.name,
  followers: formatFollowers(artist.follower_count),
  verified: Boolean(artist.verified),
  img: artist.image_url || null,
});

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
    supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url").order("follower_count", { ascending: false }),
    supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,artists(id,name,image_url)").order("play_count", { ascending: false }),
    supabase.from("categories").select("id,name,slug").order("name"),
    supabase.from("venues").select("id,name,city,address,capacity").order("name"),
  ]);
  const firstError = [eventResult, artistResult, songResult, categoryResult, venueResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return {
    events: (eventResult.data || []).map(toEvent),
    artists: (artistResult.data || []).map(toArtist),
    songs: (songResult.data || []).map(toSong),
    categories: categoryResult.data || [],
    venues: venueResult.data || [],
  };
}

export async function searchCatalog(query) {
  const term = query.trim();
  if (!term) return { events: [], artists: [], songs: [], venues: [] };
  const pattern = `%${term}%`;
  const [eventResult, artistResult, songResult, venueResult] = await Promise.all([
    supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,rating,review_count,venues(id,name,city,address,capacity),ticket_types(id,price)").in("status", ["PUBLISHED", "SOLD_OUT", "LIVE", "COMPLETED"]).or(`title.ilike.${pattern},description.ilike.${pattern},city.ilike.${pattern}`).order("starts_at").limit(20),
    supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url").or(`name.ilike.${pattern},bio.ilike.${pattern}`).order("follower_count", { ascending: false }).limit(20),
    supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,artists(id,name,image_url)").ilike("title", pattern).order("play_count", { ascending: false }).limit(20),
    supabase.from("venues").select("id,name,city,address,capacity").or(`name.ilike.${pattern},city.ilike.${pattern},address.ilike.${pattern}`).order("name").limit(20),
  ]);
  const firstError = [eventResult, artistResult, songResult, venueResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return {
    events: (eventResult.data || []).map(toEvent),
    artists: (artistResult.data || []).map(toArtist),
    songs: (songResult.data || []).map(toSong),
    venues: venueResult.data || [],
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
  return {
    ...toEvent(eventResult.data || {}),
    description: eventResult.data?.description || "",
    artists: (artistResult.data || []).map((row) => toArtist(row.artists)).filter((artist) => artist.id),
    ticketTypes: ticketResult.data || [],
  };
}
