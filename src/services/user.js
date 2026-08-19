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

export async function updateProfile(userId, updates) {
  if (!userId) throw new Error("Sign in to edit your profile.");
  const payload = {
    id: userId,
    full_name: updates?.full_name?.trim() || null,
    phone: updates?.phone?.trim() || null,
    avatar_url: updates?.avatar_url?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "id" }).select("id,full_name,phone,avatar_url,onboarding_complete,updated_at").single();
  if (error) throw error;
  return data;
}

export async function loadArtistWorkspace(userId) {
  if (!userId) throw new Error("Sign in to open the artist workspace.");
  const { data: artist, error: artistError } = await supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,created_at,updated_at").eq("user_id", userId).maybeSingle();
  if (artistError) throw artistError;
  if (!artist) return { artist: null, songs: [], events: [], bookings: [] };
  const [songsResult, eventLinksResult, bookingsResult] = await Promise.all([
    supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,created_at").eq("artist_id", artist.id).order("created_at", { ascending: false }),
    supabase.from("event_artists").select("event_id,events(id,title,description,city,starts_at,ends_at,cover_url,status,venue_id,venues(name,address,capacity))").eq("artist_id", artist.id),
    supabase.from("artist_booking_requests").select("id,requester_id,artist_id,event_name,event_type,event_date,expected_audience,budget,message,status,created_at,updated_at").eq("artist_id", artist.id).order("created_at", { ascending: false }),
  ]);
  const firstError = [songsResult, eventLinksResult, bookingsResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return { artist, songs: songsResult.data || [], events: (eventLinksResult.data || []).map((row) => row.events).filter(Boolean), bookings: bookingsResult.data || [] };
}

export async function updateArtistProfile(artistId, userId, updates) {
  if (!artistId || !userId) throw new Error("Artist profile access is required.");
  const payload = { name: updates?.name?.trim(), bio: updates?.bio?.trim() || null, image_url: updates?.image_url?.trim() || null, updated_at: new Date().toISOString() };
  if (!payload.name) throw new Error("Artist name is required.");
  const { data, error } = await supabase.from("artists").update(payload).eq("id", artistId).eq("user_id", userId).select("id,user_id,name,bio,verified,follower_count,image_url,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function updateArtistSong(songId, artistId, updates) {
  if (!songId || !artistId) throw new Error("Artist song access is required.");
  const payload = { title: updates?.title?.trim(), cover_url: updates?.cover_url?.trim() || null };
  if (!payload.title) throw new Error("Song title is required.");
  const { data, error } = await supabase.from("songs").update(payload).eq("id", songId).eq("artist_id", artistId).select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,created_at").single();
  if (error) throw error;
  return data;
}

export async function artistUpdateBookingStatus(bookingId, status) {
  if (!bookingId || !status) throw new Error("Booking status is required.");
  const { data, error } = await supabase.rpc("artist_update_booking_status", { p_booking_id: bookingId, p_status: status });
  if (error) throw error;
  return data;
}

export async function loadArtistOnboarding(userId) {
  if (!userId) return { registration: null, verification: null, fees: [] };
  const [{ data: fees, error: feeError }, { data: registration, error: registrationError }, { data: artist, error: artistError }] = await Promise.all([
    supabase.from("platform_settings").select("key,amount,currency,description").in("key", ["artist_registration_fee", "artist_verification_fee"]),
    supabase.from("artist_registrations").select("id,user_id,transaction_id,artist_id,status,failure_reason,submitted_at,activated_at,updated_at").eq("user_id", userId).maybeSingle(),
    supabase.from("artists").select("id,user_id,verified").eq("user_id", userId).maybeSingle(),
  ]);
  if (feeError) throw feeError;
  if (registrationError) throw registrationError;
  if (artistError) throw artistError;
  let verification = null;
  if (artist?.id) {
    const { data, error } = await supabase.from("artist_verifications").select("id,artist_id,user_id,transaction_id,status,failure_reason,requested_at,verified_at,updated_at").eq("artist_id", artist.id).maybeSingle();
    if (error) throw error;
    verification = data;
  }
  return { fees: fees || [], registration, verification, artist };
}

export async function initializeArtistFeePayment(userId, transactionType) {
  if (!userId || !transactionType) throw new Error("Artist payment details are required.");
  const idempotencyKey = `atizzy-${transactionType.toLowerCase()}-${userId}-${Date.now()}`;
  const { data, error } = await supabase.rpc("initialize_artist_fee_payment", { p_transaction_type: transactionType, p_idempotency_key: idempotencyKey });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadArtistFeeTransaction(transactionId) {
  if (!transactionId) return null;
  const { data, error } = await supabase.from("artist_fee_transactions").select("id,user_id,artist_id,transaction_type,amount,currency,provider,provider_reference,idempotency_key,status,verified_at,created_at,updated_at").eq("id", transactionId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadArtistAdminOverview() {
  const [{ data: settings, error: settingsError }, { data: registrations, error: registrationsError }, { data: verifications, error: verificationsError }, { data: transactions, error: transactionsError }] = await Promise.all([
    supabase.from("platform_settings").select("key,amount,currency,description,updated_by,updated_at").in("key", ["artist_registration_fee", "artist_verification_fee"]),
    supabase.from("artist_registrations").select("id,user_id,transaction_id,artist_id,status,submitted_at,activated_at,updated_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("artist_verifications").select("id,artist_id,user_id,transaction_id,status,requested_at,verified_at,updated_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("artist_fee_transactions").select("id,user_id,artist_id,transaction_type,amount,currency,status,provider_reference,verified_at,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const firstError = [settingsError, registrationsError, verificationsError, transactionsError].find(Boolean);
  if (firstError) throw firstError;
  return { settings: settings || [], registrations: registrations || [], verifications: verifications || [], transactions: transactions || [] };
}

export async function updateArtistFee(key, amount, userId) {
  if (!userId || !key) throw new Error("Fee setting access is required.");
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) throw new Error("Enter a valid non-negative fee.");
  const { data, error } = await supabase.from("platform_settings").update({ amount: numericAmount, updated_by: userId, updated_at: new Date().toISOString() }).eq("key", key).select("key,amount,currency,description,updated_by,updated_at").single();
  if (error) throw error;
  return data;
}
