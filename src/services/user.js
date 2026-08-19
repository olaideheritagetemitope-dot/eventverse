import { supabase } from "../lib/supabase";

export async function loadCurrentUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user || null;
  if (!user) return { user: null, profile: null, roles: [] };
  const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase.from("user_profiles").select("id,full_name,phone,avatar_url,onboarding_complete").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("roles(code,label)").eq("user_id", user.id),
  ]);
  if (profileError) throw profileError;
  if (roleError) throw roleError;
  return { user, profile, roles: (roleRows || []).map((row) => row.roles).filter(Boolean) };
}

export async function loadFavoriteState(userId, eventId, artistId) {
  if (!userId) return { eventFavorite: false, artistFollowing: false };
  const [{ data: eventFavorite, error: eventError }, { data: artistFollowing, error: artistError }] = await Promise.all([
    eventId ? supabase.from("event_favorites").select("event_id").eq("user_id", userId).eq("event_id", eventId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    artistId ? supabase.from("artist_followers").select("artist_id").eq("user_id", userId).eq("artist_id", artistId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (eventError) throw eventError;
  if (artistError) throw artistError;
  return { eventFavorite: Boolean(eventFavorite), artistFollowing: Boolean(artistFollowing) };
}

export async function toggleFavorite(table, key, userId, value) {
  if (!userId) throw new Error("Sign in to update your favorites.");
  if (value) {
    const { error } = await supabase.from(table).upsert({ user_id: userId, [key]: value }, { onConflict: `${key},user_id` });
    if (error) throw error;
    return true;
  }
  const { error } = await supabase.from(table).delete().eq("user_id", userId).eq(key, value);
  if (error) throw error;
  return false;
}

export async function toggleEventFavorite(userId, eventId, next) {
  return toggleFavorite("event_favorites", "event_id", userId, next ? eventId : eventId);
}

export async function toggleArtistFollow(userId, artistId, next) {
  return toggleFavorite("artist_followers", "artist_id", userId, next ? artistId : artistId);
}

export async function toggleMusicFavorite(userId, songId, next) {
  return toggleFavorite("music_favorites", "song_id", userId, next ? songId : songId);
}

export async function loadMusicFavorites(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("music_favorites").select("song_id").eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((row) => row.song_id);
}

export async function recordPlay(userId, songId, secondsPlayed = 0) {
  if (!userId || !songId) return;
  const { error } = await supabase.from("play_history").insert({ user_id: userId, song_id: songId, seconds_played: Math.max(0, Math.floor(secondsPlayed)) });
  if (error) throw error;
}

export async function loadPlaylists(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("playlists").select("id,name,created_at,playlist_items(song_id,position,songs(id,title,artist_id,audio_url,cover_url,duration_seconds,play_count,artists(name)))").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPlaylist(userId, name) {
  if (!userId) throw new Error("Sign in to create a playlist.");
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Enter a playlist name.");
  const { data, error } = await supabase.from("playlists").insert({ user_id: userId, name: cleanName }).select("id,name,created_at").single();
  if (error) throw error;
  return data;
}

export async function submitBooking(userId, artistId, payload) {
  if (!userId) throw new Error("Sign in to book an artist.");
  const { data, error } = await supabase.from("artist_booking_requests").insert({ requester_id: userId, artist_id: artistId, ...payload }).select("id,status,created_at").single();
  if (error) throw error;
  return data;
}

export async function loadRoleDashboard(userId, roles = []) {
  if (!userId) return { events: [], bookings: [], venues: [], songs: [], orders: [] };
  const roleCodes = roles.map((role) => typeof role === "string" ? role : role.code).filter(Boolean);
  const [eventsResult, bookingsResult, venuesResult, songsResult, ordersResult] = await Promise.all([
    roleCodes.includes("ORGANIZER") || roleCodes.includes("ADMIN") || roleCodes.includes("SUPER_ADMIN")
      ? supabase.from("events").select("id,title,status,starts_at,city,organizer_id").eq("organizer_id", userId).order("starts_at", { ascending: true }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    roleCodes.includes("ARTIST") || roleCodes.includes("ADMIN") || roleCodes.includes("SUPER_ADMIN")
      ? supabase.from("artist_booking_requests").select("id,event_name,event_date,status,budget,artist_id").eq("requester_id", userId).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    roleCodes.includes("VENUE_MANAGER") || roleCodes.includes("ADMIN") || roleCodes.includes("SUPER_ADMIN")
      ? supabase.from("venues").select("id,name,city,capacity,owner_id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    roleCodes.includes("ARTIST") || roleCodes.includes("ADMIN") || roleCodes.includes("SUPER_ADMIN")
      ? supabase.from("songs").select("id,title,audio_url,cover_url,play_count,artist_id").limit(20)
      : Promise.resolve({ data: [], error: null }),
    roleCodes.includes("ORGANIZER") || roleCodes.includes("ADMIN") || roleCodes.includes("SUPER_ADMIN")
      ? supabase.from("orders").select("id,status,total,currency,created_at").order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = [eventsResult, bookingsResult, venuesResult, songsResult, ordersResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return { events: eventsResult.data || [], bookings: bookingsResult.data || [], venues: venuesResult.data || [], songs: songsResult.data || [], orders: ordersResult.data || [] };
}

export async function issueTicketQrToken(ticketId) {
  if (!ticketId) throw new Error("A ticket id is required.");
  const { data, error } = await supabase.rpc("issue_ticket_qr_token", { p_ticket_id: ticketId });
  if (error) throw error;
  return data;
}

export async function checkInTicket(ticketId) {
  if (!ticketId) throw new Error("A ticket id is required.");
  const { data, error } = await supabase.rpc("check_in_ticket", { p_ticket_id: ticketId });
  if (error) throw error;
  return data;
}

export async function checkInTicketWithToken(qrToken) {
  if (!qrToken) throw new Error("A QR token is required.");
  const { data, error } = await supabase.rpc("check_in_ticket_with_token", { p_qr_token: qrToken });
  if (error) throw error;
  return data;
}
