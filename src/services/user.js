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


export async function loadOrganizerApplication(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from("organizer_applications").select("id,user_id,status,display_name,reason,created_at,updated_at,activated_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function applyAsOrganizer(userId, displayName, reason) {
  if (!userId) throw new Error("Sign in to become an Organizer.");
  const { data, error } = await supabase.rpc("apply_as_organizer", { p_display_name: displayName?.trim() || null, p_reason: reason?.trim() || null });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadOrganizerEvents(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,created_at,updated_at,venues(name,address,capacity),ticket_types(id,name,price,capacity,sold,reserved,sales_start,sales_end,maximum_per_customer)").eq("organizer_id", userId).order("starts_at", { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function createOrganizerEvent(userId, payload) {
  if (!userId) throw new Error("Organizer access is required.");
  const body = { organizer_id: userId, title: payload.title?.trim(), description: payload.description?.trim() || null, event_type: payload.event_type?.trim() || null, city: payload.city?.trim(), starts_at: payload.starts_at, ends_at: payload.ends_at || null, cover_url: payload.cover_url?.trim() || null, venue_id: null, status: "DRAFT" };
  if (!body.title || !body.description || !body.city || !body.starts_at) throw new Error("Title, description, city, and start date are required.");
  const { data, error } = await supabase.from("events").insert(body).select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function updateOrganizerEvent(eventId, userId, payload) {
  if (!eventId || !userId) throw new Error("Organizer event access is required.");
  const body = { title: payload.title?.trim(), description: payload.description?.trim() || null, event_type: payload.event_type?.trim() || null, city: payload.city?.trim(), starts_at: payload.starts_at, ends_at: payload.ends_at || null, cover_url: payload.cover_url?.trim() || null, venue_id: payload.venue_id || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("events").update(body).eq("id", eventId).eq("organizer_id", userId).select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function addOrganizerTicketType(eventId, userId, payload) {
  if (!eventId || !userId) throw new Error("Organizer ticket access is required.");
  const { data: ownedEvent, error: ownedError } = await supabase.from("events").select("id").eq("id", eventId).eq("organizer_id", userId).single();
  if (ownedError || !ownedEvent) throw ownedError || new Error("Event is not owned by this Organizer.");
  const body = { event_id: eventId, name: payload.name?.trim(), price: Number(payload.price), capacity: Number(payload.capacity), sales_start: payload.sales_start || null, sales_end: payload.sales_end || null, maximum_per_customer: Number(payload.maximum_per_customer || 4) };
  if (!body.name || !Number.isFinite(body.price) || body.price < 0 || !Number.isInteger(body.capacity) || body.capacity < 1) throw new Error("Enter a valid ticket name, price, and capacity.");
  const { data, error } = await supabase.from("ticket_types").insert(body).select("id,event_id,name,price,capacity,sold,reserved,sales_start,sales_end,maximum_per_customer").single();
  if (error) throw error;
  return data;
}

export async function linkOrganizerArtist(eventId, userId, artistId) {
  if (!eventId || !userId || !artistId) throw new Error("Event and Artist are required.");
  const { data: ownedEvent, error: ownedError } = await supabase.from("events").select("id").eq("id", eventId).eq("organizer_id", userId).single();
  if (ownedError || !ownedEvent) throw ownedError || new Error("Event is not owned by this Organizer.");
  const { data, error } = await supabase.from("event_artists").upsert({ event_id: eventId, artist_id: artistId }, { onConflict: "event_id,artist_id" }).select("event_id,artist_id").single();
  if (error) throw error;
  return data;
}

export async function publishOrganizerEvent(eventId) {
  if (!eventId) throw new Error("Event is required.");
  const { data, error } = await supabase.rpc("publish_organizer_event", { p_event_id: eventId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function cancelOrganizerEvent(eventId) {
  if (!eventId) throw new Error("Event is required.");
  const { data, error } = await supabase.rpc("cancel_organizer_event", { p_event_id: eventId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadOrganizerEventDashboard(eventId) {
  if (!eventId) throw new Error("Event is required.");
  const { data, error } = await supabase.rpc("get_organizer_event_dashboard", { p_event_id: eventId });
  if (error) throw error;
  return data;
}

export async function loadVenueManagerWorkspace(userId) {
  if (!userId) throw new Error("Sign in to open the Venue Manager workspace.");
  const [{ data: application, error: applicationError }, { data: venues, error: venuesError }, { data: bookings, error: bookingsError }, { data: availability, error: availabilityError }] = await Promise.all([
    supabase.from("venue_manager_applications").select("id,user_id,display_name,reason,status,rejection_reason,activated_at,reviewed_at,created_at,updated_at").eq("user_id", userId).maybeSingle(),
    supabase.from("venues").select("id,owner_id,name,city,address,capacity,description,venue_type,amenities,rules,contact_phone,image_urls,pricing,cancellation_policy,created_at,updated_at").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.from("venue_bookings").select("id,venue_id,organizer_id,event_id,event_name,starts_at,ends_at,expected_attendance,additional_requirements,status,rejection_reason,requested_at,responded_at,created_at,updated_at,venues(name,city,capacity)").order("starts_at", { ascending: true }).limit(100),
    supabase.from("venue_availability").select("id,venue_id,starts_at,ends_at,status,note,created_at,updated_at").order("starts_at", { ascending: true }).limit(100),
  ]);
  const firstError = [applicationError, venuesError, bookingsError, availabilityError].find(Boolean);
  if (firstError) throw firstError;
  const ownedVenueIds = new Set((venues || []).map((venue) => venue.id));
  const ownedBookings = (bookings || []).filter((booking) => ownedVenueIds.has(booking.venue_id));
  const ownedAvailability = (availability || []).filter((item) => ownedVenueIds.has(item.venue_id));
  const confirmed = ownedBookings.filter((booking) => booking.status === "CONFIRMED");
  let liveMetrics = {};
  const { data: metricData, error: metricError } = await supabase.rpc("get_venue_manager_metrics", { p_user_id: userId });
  if (!metricError) liveMetrics = metricData || {};
  return {
    application,
    venues: venues || [],
    bookings: ownedBookings,
    availability: ownedAvailability,
    metrics: {
      venues: Number(liveMetrics.venues ?? venues?.length ?? 0),
      pending: Number(liveMetrics.pending ?? ownedBookings.filter((booking) => booking.status === "PENDING").length),
      confirmed: Number(liveMetrics.confirmed ?? confirmed.length),
      rejected: Number(liveMetrics.rejected ?? ownedBookings.filter((booking) => booking.status === "REJECTED").length),
      history: Number(liveMetrics.history ?? ownedBookings.filter((booking) => ["COMPLETED", "CANCELLED"].includes(booking.status)).length),
      upcoming: confirmed.filter((booking) => new Date(booking.starts_at) >= new Date()).length,
      occupancy: confirmed.reduce((sum, booking) => sum + Number(booking.expected_attendance || 0), 0),
      revenue: Number(liveMetrics.revenue ?? 0),
    },
  };
}

export async function applyAsVenueManager(userId, displayName, reason) {
  if (!userId) throw new Error("Sign in to apply as a Venue Manager.");
  const { data, error } = await supabase.rpc("apply_as_venue_manager", { p_display_name: displayName, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function createOwnedVenue(userId, payload) {
  if (!userId) throw new Error("Sign in to create a venue.");
  const { data, error } = await supabase.rpc("create_owned_venue", {
    p_name: payload.name, p_city: payload.city, p_address: payload.address || null, p_capacity: Number(payload.capacity),
    p_description: payload.description || null, p_venue_type: payload.venue_type || null, p_amenities: payload.amenities || [],
    p_rules: payload.rules || null, p_contact_phone: payload.contact_phone || null, p_image_urls: payload.image_urls || [],
    p_pricing: payload.pricing || {}, p_cancellation_policy: payload.cancellation_policy || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function requestVenueBooking(userId, payload) {
  if (!userId) throw new Error("Sign in to request a venue.");
  const { data, error } = await supabase.rpc("request_venue_booking", {
    p_venue_id: payload.venue_id, p_event_id: payload.event_id || null, p_event_name: payload.event_name,
    p_starts_at: payload.starts_at, p_ends_at: payload.ends_at, p_expected_attendance: Number(payload.expected_attendance),
    p_additional_requirements: payload.additional_requirements || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function respondVenueBooking(bookingId, status, reason = null) {
  if (!bookingId || !status) throw new Error("Booking response is required.");
  const { data, error } = await supabase.rpc("respond_venue_booking", { p_booking_id: bookingId, p_status: status, p_reason: reason });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updateOwnedVenue(venueId, payload) {
  if (!venueId) throw new Error("Venue access is required.");
  const { data, error } = await supabase.rpc("update_owned_venue", {
    p_venue_id: venueId, p_name: payload.name, p_city: payload.city, p_address: payload.address || null,
    p_capacity: Number(payload.capacity), p_description: payload.description || null, p_venue_type: payload.venue_type || null,
    p_amenities: payload.amenities || [], p_rules: payload.rules || null, p_contact_phone: payload.contact_phone || null,
    p_image_urls: payload.image_urls || [], p_pricing: payload.pricing || {}, p_cancellation_policy: payload.cancellation_policy || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function setVenueAvailability(venueId, payload) {
  if (!venueId) throw new Error("Venue access is required.");
  const { data, error } = await supabase.rpc("set_venue_availability", { p_venue_id: venueId, p_starts_at: payload.starts_at, p_ends_at: payload.ends_at, p_status: payload.status || "BLOCKED", p_note: payload.note || null });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function initializeVenueBookingPayment(bookingId, idempotencyKey) {
  if (!bookingId || !idempotencyKey) throw new Error("Confirmed booking and idempotency key are required.");
  const { data, error } = await supabase.rpc("initialize_venue_booking_payment", { p_booking_id: bookingId, p_idempotency_key: idempotencyKey });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadAvailableVenues(startsAt, endsAt) {
  let query = supabase.from("venues").select("id,name,city,address,capacity,description,venue_type,amenities,rules,pricing,cancellation_policy").order("name", { ascending: true }).limit(100);
  const { data, error } = await query;
  if (error) throw error;
  const { data: conflicts, error: conflictError } = await supabase.from("venue_bookings").select("venue_id").in("status", ["PENDING", "CONFIRMED"]).lt("starts_at", endsAt).gt("ends_at", startsAt);
  if (conflictError) throw conflictError;
  const blocked = new Set((conflicts || []).map((row) => row.venue_id));
  return (data || []).filter((venue) => !blocked.has(venue.id));
}
