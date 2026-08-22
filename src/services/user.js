import { supabase } from "../lib/supabase";

const MEDIA_BUCKET = "atizzy-media";
const MEDIA_LIMIT_BYTES = 50 * 1024 * 1024;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/x-m4a", "video/mp4", "video/webm"]);
const safeFileName = (name = "upload") => name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
const isManagedMediaUrl = (value) => !value || (typeof value === "string" && value.includes(`/storage/v1/object/public/${MEDIA_BUCKET}/`));
const managedMediaUrl = (value, label = "image") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!isManagedMediaUrl(normalized)) throw new Error(`Select a ${label} from your device. External image URLs are not supported.`);
  return normalized || null;
};

export async function uploadMediaFile(userId, file, mediaKind, entityType = null, entityId = null) {
  if (!userId) throw new Error("Authentication required");
  if (!file || typeof file !== "object") throw new Error("Choose a file before uploading");
  if (!MEDIA_TYPES.has(file.type)) throw new Error("Unsupported file type. Choose a supported image, audio, or video file.");
  if (file.size > MEDIA_LIMIT_BYTES) throw new Error("File is too large. The maximum upload size is 50 MB.");
  const path = `${userId}/${mediaKind.toLowerCase()}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { data: asset, error: assetError } = await supabase.from("media_assets").insert({ owner_id: userId, bucket_id: MEDIA_BUCKET, object_path: path, public_url: publicData.publicUrl, media_kind: mediaKind, mime_type: file.type, byte_size: file.size, entity_type: entityType, entity_id: entityId }).select("*").single();
  if (assetError) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw assetError;
  }
  return asset;
}

export async function removeMediaAsset(asset) {
  if (!asset?.object_path) return;
  const { error: storageError } = await supabase.storage.from(asset.bucket_id || MEDIA_BUCKET).remove([asset.object_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("media_assets").delete().eq("id", asset.id);
  if (error) throw error;
}

export async function loadCurrentUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user || null;
  if (!user) return { user: null, profile: null, roles: [], effectiveRoles: [], primaryRole: null };
  const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }, { data: roleContext, error: roleContextError }] = await Promise.all([
    supabase.from("user_profiles").select("id,full_name,phone,avatar_url,onboarding_complete").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("roles(code,label)").eq("user_id", user.id),
    supabase.rpc("get_current_role_context"),
  ]);
  if (profileError) throw profileError;
  if (roleError) throw roleError;
  const assignedRoles = (roleRows || []).map((row) => row.roles).filter(Boolean);
  const roleContextFailed = Boolean(roleContextError);
  return {
    user,
    profile,
    roles: assignedRoles,
    // Effective permissions are authoritative. Do not silently fall back to
    // assigned roles when the security-definer role-context RPC fails.
    effectiveRoles: roleContextFailed ? [] : (Array.isArray(roleContext?.effective_roles) ? roleContext.effective_roles : []),
    primaryRole: roleContextFailed ? null : (roleContext?.primary_role || null),
    roleContextError: roleContextError?.message || null,
  };
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
  if (!userId || !artistId) throw new Error("Artist follow requires an authenticated user and artist.");
  const { data, error } = await supabase.rpc("toggle_artist_follow", { p_artist_id: artistId, p_follow: next });
  if (error) throw error;
  return data || { following: next, artist_id: artistId };
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

export async function validateTicketQr(qrToken, expectedEventId = null) {
  if (!qrToken || !String(qrToken).trim()) throw new Error("A QR token is required.");
  const { data, error } = await supabase.rpc("validate_ticket_qr", {
    p_qr_token: String(qrToken).trim(),
    p_expected_event_id: expectedEventId || null,
  });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("Ticket verification returned no result.");
  return data;
}

export async function updateProfile(userId, updates) {
  if (!userId) throw new Error("Sign in to edit your profile.");
  const payload = {
    id: userId,
    full_name: updates?.full_name?.trim() || null,
    phone: updates?.phone?.trim() || null,
    avatar_url: managedMediaUrl(updates?.avatar_url, "profile photo"),
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
    supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,music_video_url,lyrics_text,play_count,status,published_at,created_at").eq("artist_id", artist.id).order("created_at", { ascending: false }),
    supabase.from("event_artists").select("event_id,events(id,title,description,city,starts_at,ends_at,cover_url,status,venue_id,venues(name,address,capacity))").eq("artist_id", artist.id),
    supabase.from("artist_booking_requests").select("id,requester_id,artist_id,event_name,event_type,event_date,expected_audience,budget,message,status,created_at,updated_at").eq("artist_id", artist.id).order("created_at", { ascending: false }),
  ]);
  const firstError = [songsResult, eventLinksResult, bookingsResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return { artist, songs: songsResult.data || [], events: (eventLinksResult.data || []).map((row) => row.events).filter(Boolean), bookings: bookingsResult.data || [] };
}

export async function loadArtistCreatorContent(artistId, userId) {
  if (!artistId || !userId) throw new Error("Artist profile access is required.");
  const { data: owner, error: ownerError } = await supabase.from("artists").select("id").eq("id", artistId).eq("user_id", userId).maybeSingle();
  if (ownerError) throw ownerError;
  if (!owner) throw new Error("Artist profile access denied.");
  const [albumsResult, videosResult] = await Promise.all([
    supabase.from("albums").select("id,artist_id,title,description,cover_url,status,release_date,created_at,updated_at").eq("artist_id", artistId).order("created_at", { ascending: false }),
    supabase.from("music_videos").select("id,artist_id,title,description,thumbnail_url,video_url,status,published_at,created_at,updated_at").eq("artist_id", artistId).order("created_at", { ascending: false }),
  ]);
  const firstError = [albumsResult, videosResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return { albums: albumsResult.data || [], musicVideos: videosResult.data || [] };
}

export async function createArtistAlbum(artistId, userId, input) {
  if (!artistId || !userId) throw new Error("Artist profile access is required.");
  if (!input?.title?.trim()) throw new Error("Album title is required.");
  const { data, error } = await supabase.from("albums").insert({ artist_id: artistId, title: input.title.trim(), description: input.description?.trim() || null, cover_url: managedMediaUrl(input.cover_url, "album cover"), release_date: input.release_date || null, status: "DRAFT" }).select("id,artist_id,title,description,cover_url,status,release_date,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function updateArtistAlbum(albumId, artistId, input) {
  if (!albumId || !artistId) throw new Error("Album access is required.");
  if (!input?.title?.trim()) throw new Error("Album title is required.");
  const { data, error } = await supabase.from("albums").update({ title: input.title.trim(), description: input.description?.trim() || null, cover_url: managedMediaUrl(input.cover_url, "album cover"), release_date: input.release_date || null, updated_at: new Date().toISOString() }).eq("id", albumId).eq("artist_id", artistId).select("id,artist_id,title,description,cover_url,status,release_date,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function setArtistAlbumStatus(albumId, status) {
  const { data, error } = await supabase.rpc("set_artist_album_status", { p_album_id: albumId, p_status: status });
  if (error) throw error;
  return data;
}

export async function createArtistMusicVideo(artistId, userId, input) {
  if (!artistId || !userId) throw new Error("Artist profile access is required.");
  if (!input?.title?.trim()) throw new Error("Music video title is required.");
  const { data, error } = await supabase.from("music_videos").insert({ artist_id: artistId, title: input.title.trim(), description: input.description?.trim() || null, thumbnail_url: managedMediaUrl(input.thumbnail_url, "music video thumbnail"), video_url: managedMediaUrl(input.video_url, "music video"), status: "DRAFT" }).select("id,artist_id,title,description,thumbnail_url,video_url,status,published_at,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function updateArtistMusicVideo(videoId, artistId, input) {
  if (!videoId || !artistId) throw new Error("Music video access is required.");
  if (!input?.title?.trim()) throw new Error("Music video title is required.");
  const { data, error } = await supabase.from("music_videos").update({ title: input.title.trim(), description: input.description?.trim() || null, thumbnail_url: managedMediaUrl(input.thumbnail_url, "music video thumbnail"), video_url: managedMediaUrl(input.video_url, "music video"), updated_at: new Date().toISOString() }).eq("id", videoId).eq("artist_id", artistId).select("id,artist_id,title,description,thumbnail_url,video_url,status,published_at,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function setArtistMusicVideoStatus(videoId, status) {
  const { data, error } = await supabase.rpc("set_artist_music_video_status", { p_video_id: videoId, p_status: status });
  if (error) throw error;
  return data;
}

export async function updateArtistProfile(artistId, userId, updates) {
  if (!artistId || !userId) throw new Error("Artist profile access is required.");
  const payload = { name: updates?.name?.trim(), bio: updates?.bio?.trim() || null, image_url: managedMediaUrl(updates?.image_url, "artist photo"), updated_at: new Date().toISOString() };
  if (!payload.name) throw new Error("Artist name is required.");
  const { data, error } = await supabase.from("artists").update(payload).eq("id", artistId).eq("user_id", userId).select("id,user_id,name,bio,verified,follower_count,image_url,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function createArtistSong(artistId, userId, input) {
  if (!artistId || !userId) throw new Error("Artist profile access is required.");
  if (!input?.title?.trim()) throw new Error("Song title is required.");
  const duration = Number(input.duration_seconds);
  if (!Number.isInteger(duration) || duration <= 0) throw new Error("Song duration must be a positive number of seconds.");
  const { data, error } = await supabase.from("songs").insert({
    artist_id: artistId,
    title: input.title.trim(),
    duration_seconds: duration,
    audio_url: managedMediaUrl(input.audio_url, "audio file"),
    cover_url: managedMediaUrl(input.cover_url, "song cover"),
    music_video_url: managedMediaUrl(input.music_video_url, "music video"),
    lyrics_text: input.lyrics_text?.trim() || null,
    status: "DRAFT",
  }).select("id,artist_id,title,duration_seconds,audio_url,cover_url,music_video_url,lyrics_text,play_count,status,published_at,created_at").single();
  if (error) throw error;
  return data;
}

export async function setArtistSongStatus(songId, status) {
  const { data, error } = await supabase.rpc("set_artist_song_status", { p_song_id: songId, p_status: status });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updateArtistSong(songId, artistId, updates) {
  if (!songId || !artistId) throw new Error("Artist song access is required.");
  const payload = { title: updates?.title?.trim(), cover_url: managedMediaUrl(updates?.cover_url, "song cover"), audio_url: managedMediaUrl(updates?.audio_url, "audio file"), music_video_url: managedMediaUrl(updates?.music_video_url, "music video"), lyrics_text: updates?.lyrics_text?.trim() || null };
  if (!payload.title) throw new Error("Song title is required.");
  const { data, error } = await supabase.from("songs").update(payload).eq("id", songId).eq("artist_id", artistId).select("id,artist_id,title,duration_seconds,audio_url,cover_url,music_video_url,lyrics_text,play_count,status,published_at,created_at").single();
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
  const [{ data: settings, error: settingsError }, { data: registrations, error: registrationsError }, { data: verifications, error: verificationsError }, { data: transactions, error: transactionsError }, { data: auditHistory, error: auditError }] = await Promise.all([
    supabase.from("platform_settings").select("key,amount,currency,description,updated_by,updated_at").in("key", ["artist_registration_fee", "artist_verification_fee"]),
    supabase.from("artist_registrations").select("id,user_id,transaction_id,artist_id,status,submitted_at,activated_at,updated_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("artist_verifications").select("id,artist_id,user_id,transaction_id,status,requested_at,verified_at,updated_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("artist_fee_transactions").select("id,user_id,artist_id,transaction_type,amount,currency,status,provider_reference,verified_at,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_logs").select("id,actor_id,action,entity_type,metadata,created_at").eq("action", "platform_fee.updated").order("created_at", { ascending: false }).limit(20),
  ]);
  const firstError = [settingsError, registrationsError, verificationsError, transactionsError, auditError].find(Boolean);
  if (firstError) throw firstError;
  return { settings: settings || [], registrations: registrations || [], verifications: verifications || [], transactions: transactions || [], auditHistory: auditHistory || [] };
}

export async function updateArtistFee(key, amount, userId) {
  if (!userId || !key) throw new Error("Fee setting access is required.");
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) throw new Error("Enter a valid non-negative fee.");
  const { data, error } = await supabase.rpc("update_platform_setting_fee", { p_key: key, p_amount: numericAmount });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}


export async function loadRoleApplication(userId, roleCode) {
  if (!userId || !roleCode) return null;
  const { data, error } = await supabase.from("role_applications").select("id,user_id,role_code,status,answers,fee_amount,fee_currency,fee_status,submitted_at,review_due_at,reviewed_by,reviewed_at,rejection_reason,profile_id,created_at,updated_at").eq("user_id", userId).eq("role_code", roleCode).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadOrganizerApplication(userId) {
  return loadRoleApplication(userId, "ORGANIZER");
}

export async function applyAsOrganizer(userId, displayName, reason) {
  if (!userId) throw new Error("Sign in to become an Organizer.");
  return submitRoleApplication("ORGANIZER", { display_name: displayName?.trim() || "", reason: reason?.trim() || "" });
}

export async function loadOrganizerEvents(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,created_at,updated_at,venues(name,address,capacity),ticket_types(id,name,price,capacity,sold,reserved,sales_start,sales_end,maximum_per_customer)").eq("organizer_id", userId).order("starts_at", { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function createOrganizerEvent(userId, payload) {
  if (!userId) throw new Error("Organizer access is required.");
  const body = { organizer_id: userId, title: payload.title?.trim(), description: payload.description?.trim() || null, event_type: payload.event_type?.trim() || null, city: payload.city?.trim(), starts_at: payload.starts_at, ends_at: payload.ends_at || null, cover_url: managedMediaUrl(payload.cover_url, "event cover"), venue_id: null, status: "DRAFT" };
  if (!body.title || !body.description || !body.city || !body.starts_at) throw new Error("Title, description, city, and start date are required.");
  const { data, error } = await supabase.from("events").insert(body).select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function updateOrganizerEvent(eventId, userId, payload) {
  if (!eventId || !userId) throw new Error("Organizer event access is required.");
  const body = { title: payload.title?.trim(), description: payload.description?.trim() || null, event_type: payload.event_type?.trim() || null, city: payload.city?.trim(), starts_at: payload.starts_at, ends_at: payload.ends_at || null, cover_url: managedMediaUrl(payload.cover_url, "event cover"), venue_id: payload.venue_id || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("events").update(body).eq("id", eventId).eq("organizer_id", userId).select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function addOrganizerTicketType(eventId, userId, payload) {
  if (!eventId || !userId) throw new Error("Organizer ticket access is required.");
  const body = {
    p_event_id: eventId,
    p_name: payload.name?.trim(),
    p_price: Number(payload.price),
    p_capacity: Number(payload.capacity),
    p_sales_start: payload.sales_start || null,
    p_sales_end: payload.sales_end || null,
    p_maximum_per_customer: Number(payload.maximum_per_customer || 4),
    p_visibility: payload.visibility || "PUBLIC",
    p_access_method: payload.access_method || null,
    p_code: payload.code?.trim() || null,
    p_word: payload.word?.trim() || null,
    p_access_credential_hint: payload.access_credential_hint?.trim() || null,
    p_maximum_redemptions: payload.maximum_redemptions ? Number(payload.maximum_redemptions) : null,
    p_maximum_purchases_per_user: payload.maximum_purchases_per_user ? Number(payload.maximum_purchases_per_user) : null,
  };
  if (!body.p_name || !Number.isFinite(body.p_price) || body.p_price < 0 || !Number.isInteger(body.p_capacity) || body.p_capacity < 1) throw new Error("Enter a valid ticket name, price, and capacity.");
  if (body.p_visibility === "PRIVATE" && body.p_access_method === "CODE_WORD" && (!body.p_code || !body.p_word)) throw new Error("Private tickets using Code + Word require both values.");
  if (body.p_visibility === "PRIVATE" && body.p_access_method === "CODE" && !body.p_code) throw new Error("Enter a private ticket code.");
  if (body.p_visibility === "PRIVATE" && body.p_access_method === "WORD" && !body.p_word) throw new Error("Enter a private ticket word.");
  const { data, error } = await supabase.rpc("create_organizer_ticket_type", body);
  if (error) throw error;
  return data;
}

export async function discoverPrivateTicket(eventId, { code = null, word = null } = {}) {
  if (!eventId) throw new Error("Event is required.");
  const { data, error } = await supabase.rpc("discover_private_ticket", { p_event_id: eventId, p_code: code?.trim() || null, p_word: word?.trim() || null });
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
  return submitRoleApplication("VENUE_MANAGER", { display_name: displayName?.trim() || "", reason: reason?.trim() || "" });
}

export async function createOwnedVenue(userId, payload) {
  if (!userId) throw new Error("Sign in to create a venue.");
  const { data, error } = await supabase.rpc("create_owned_venue", {
    p_name: payload.name, p_city: payload.city, p_address: payload.address || null, p_capacity: Number(payload.capacity),
    p_description: payload.description || null, p_venue_type: payload.venue_type || null, p_amenities: payload.amenities || [],
    p_rules: payload.rules || null, p_contact_phone: payload.contact_phone || null, p_image_urls: (payload.image_urls || []).map((url) => managedMediaUrl(url, "venue photo")),
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

export async function loadSuperAdminAnalytics() {
  const { data, error } = await supabase.rpc("get_super_admin_analytics");
  if (error) throw error;
  return data || {};
}

export async function searchOrganizerArtists(query = "") {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];
  const { data, error } = await supabase
    .from("artists")
    .select("id,stage_name,verification_status,avatar_url")
    .or(`stage_name.ilike.%${cleanQuery}%,bio.ilike.%${cleanQuery}%`)
    .order("stage_name", { ascending: true })
    .limit(12);
  if (error) throw error;
  return data || [];
}


export async function searchEventStaffUsers(query = "") {
  const { data, error } = await supabase.rpc("search_event_staff_users", { p_query: query });
  if (error) throw error;
  return data || [];
}

export async function assignEventStaff(eventId, staffUserId, responsibility = "GENERAL", instructions = "") {
  const { data, error } = await supabase.rpc("assign_event_staff", { p_event_id: eventId, p_staff_user_id: staffUserId, p_responsibility: responsibility, p_instructions: instructions || null });
  if (error) throw error;
  return data;
}

export async function loadEventStaffForOrganizer(eventId) {
  const { data, error } = await supabase.rpc("list_event_staff_for_organizer", { p_event_id: eventId });
  if (error) throw error;
  return data || [];
}

export async function updateEventStaffShift(assignmentId, shiftStartsAt = null, shiftEndsAt = null, shiftNote = "") {
  if (!assignmentId) throw new Error("Staff assignment is required.");
  const { data, error } = await supabase.rpc("update_event_staff_shift", {
    p_assignment_id: assignmentId,
    p_shift_starts_at: shiftStartsAt || null,
    p_shift_ends_at: shiftEndsAt || null,
    p_shift_note: shiftNote || null,
  });
  if (error) throw error;
  return data;
}

export async function revokeEventStaffAssignment(assignmentId) {
  const { data, error } = await supabase.rpc("revoke_event_staff_assignment", { p_assignment_id: assignmentId });
  if (error) throw error;
  return data;
}

export async function loadEventStaffWorkspace() {
  const { data, error } = await supabase.rpc("get_event_staff_workspace");
  if (error) throw error;
  return data || [];
}

export async function respondEventStaffAssignment(assignmentId, status) {
  const { data, error } = await supabase.rpc("respond_event_staff_assignment", { p_assignment_id: assignmentId, p_status: status });
  if (error) throw error;
  return data;
}

export async function acknowledgeEventStaffTask(taskId, status = "ACKNOWLEDGED") {
  const { data, error } = await supabase.rpc("acknowledge_event_staff_task", { p_task_id: taskId, p_status: status });
  if (error) throw error;
  return data;
}

export async function markEventStaffNotificationRead(notificationId) {
  const { data, error } = await supabase.rpc("mark_event_staff_notification_read", { p_notification_id: notificationId });
  if (error) throw error;
  return data;
}

export async function eventStaffEntryDecision(qrToken, decision = "ACCEPT") {
  const { data, error } = await supabase.rpc("event_staff_entry_decision", { p_qr_token: qrToken, p_decision: decision });
  if (error) throw error;
  return data;
}

export async function loadAdminDashboardSnapshot() {
  const { data, error } = await supabase.rpc("admin_dashboard_snapshot");
  if (error) throw error;
  return data || {};
}
export async function adminListUsers(search = "") {
  const { data, error } = await supabase.rpc("admin_list_users", { p_search: search || null });
  if (error) throw error;
  return data || [];
}
export async function adminSuspendUser(userId, suspend, reason = "") {
  const { data, error } = await supabase.rpc("admin_suspend_user", { p_user_id: userId, p_suspend: suspend, p_reason: reason || null });
  if (error) throw error;
  return data;
}
export async function adminReviewEvent(eventId, status, note = "") {
  const { data, error } = await supabase.rpc("admin_review_event", { p_event_id: eventId, p_status: status, p_note: note || null });
  if (error) throw error;
  return data;
}
export async function adminUpdateReport(reportId, status, note = "") {
  const { data, error } = await supabase.rpc("admin_update_report", { p_report_id: reportId, p_status: status, p_resolution_note: note || null });
  if (error) throw error;
  return data;
}
export async function loadAdminPaymentSupport() {
  const { data, error } = await supabase.rpc("admin_payment_support_snapshot");
  if (error) throw error;
  return data || { ticket_payments: [], venue_payments: [] };
}
export async function loadAdminAuditLogs() {
  const { data, error } = await supabase.rpc("admin_recent_audit_logs");
  if (error) throw error;
  return data || [];
}

export async function loadUserExperienceSnapshot() {
  const { data, error } = await supabase.rpc("user_experience_snapshot");
  if (error) throw error;
  return data || { search_history: [], notifications: [], preferences: {}, support_requests: [] };
}

export async function recordUserSearch(query) {
  const { data, error } = await supabase.rpc("record_user_search", { p_query: query });
  if (error) throw error;
  return data;
}

export async function clearUserSearchHistory() {
  const { error } = await supabase.rpc("clear_user_search_history");
  if (error) throw error;
}

export async function updateUserPreferences(preferences) {
  const { data, error } = await supabase.rpc("update_user_preferences", { p_preferences: preferences });
  if (error) throw error;
  return data;
}

export async function markUserNotificationRead(notificationId) {
  const { error } = await supabase.rpc("mark_user_notification_read", { p_notification_id: notificationId });
  if (error) throw error;
}

export async function markAllUserNotificationsRead() {
  const { error } = await supabase.rpc("mark_all_user_notifications_read");
  if (error) throw error;
}

export async function createSupportRequest(category, subject, message) {
  const { data, error } = await supabase.rpc("create_support_request", { p_category: category, p_subject: subject, p_message: message });
  if (error) throw error;
  return data;
}

export async function loadUserCollections(userId) {
  if (!userId) return { followedArtists: [], likedMusic: [], recentlyPlayed: [], activity: [] };
  const [{ data: followedArtists, error: artistsError }, { data: likedMusic, error: musicError }, { data: recentlyPlayed, error: playedError }] = await Promise.all([
    supabase.from("artist_followers").select("artist_id,created_at,artists(id,name,image_url,verified,follower_count)").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("music_favorites").select("song_id,created_at,songs(id,title,artist_id,audio_url,cover_url,duration_seconds,play_count,artists(name))").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("play_history").select("id,song_id,seconds_played,played_at,songs(id,title,artist_id,audio_url,cover_url,duration_seconds,play_count,artists(name))").eq("user_id", userId).order("played_at", { ascending: false }).limit(50),
  ]);
  if (artistsError) throw artistsError;
  if (musicError) throw musicError;
  if (playedError) throw playedError;
  return {
    followedArtists: (followedArtists || []).map((row) => row.artists || { id: row.artist_id }),
    likedMusic: (likedMusic || []).map((row) => row.songs || { id: row.song_id }),
    recentlyPlayed: (recentlyPlayed || []).map((row) => ({ ...(row.songs || {}), played_at: row.played_at, seconds_played: row.seconds_played })).filter((row) => row.id),
    activity: (recentlyPlayed || []).map((row) => ({ id: row.id, type: "PLAYED_MUSIC", label: `Played ${row.songs?.title || "music"}`, created_at: row.played_at })).filter((row) => row.created_at),
  };
}

export async function loadMyPosts(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("posts").select("id,author_id,caption,image_url,music_id,event_id,status,published_at,created_at,updated_at").eq("author_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}
export async function createPost(payload) {
  const { data, error } = await supabase.rpc("create_post", { p_caption: payload.caption || "", p_image_url: managedMediaUrl(payload.image_url, "post image"), p_music_id: payload.music_id || null, p_event_id: payload.event_id || null, p_status: payload.status || "DRAFT" });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
export async function updatePost(postId, payload) {
  if (!postId) throw new Error("Post access is required.");
  const { data, error } = await supabase.rpc("update_post", { p_post_id: postId, p_caption: payload.caption || "", p_image_url: managedMediaUrl(payload.image_url, "post image"), p_music_id: payload.music_id || null, p_event_id: payload.event_id || null });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
export async function setPostStatus(postId, status) {
  if (!postId) throw new Error("Post access is required.");
  const { data, error } = await supabase.rpc("set_post_status", { p_post_id: postId, p_status: status });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function deletePost(postId) {
  if (!postId) throw new Error("Post access is required.");
  const { data, error } = await supabase.rpc("delete_post", { p_post_id: postId });
  if (error) throw error;
  return data === true || data?.deleted === true;
}

export async function loadPolicySettings() {
  const { data, error } = await supabase.rpc("list_policy_settings");
  if (error) throw error;
  return data || [];
}

export async function updatePolicySetting(key, value) {
  if (!key) throw new Error("Policy key is required.");
  const { data, error } = await supabase.rpc("update_policy_setting", { p_key: key, p_value: value });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadRoleCapabilityMatrix() {
  const { data, error } = await supabase.rpc("role_capability_matrix");
  if (error) throw error;
  return data || [];
}
export async function loadAdminPermissionGrants(adminUserId = null) {
  const { data, error } = await supabase.rpc("list_admin_permission_grants", { p_admin_user_id: adminUserId });
  if (error) throw error;
  return data || [];
}
export async function setAdminPermission(adminUserId, permissionCode, granted, expiresAt = null) {
  if (!adminUserId || !permissionCode) throw new Error("Admin and permission are required.");
  const { data, error } = await supabase.rpc("set_admin_permission", { p_admin_user_id: adminUserId, p_permission_code: permissionCode, p_granted: Boolean(granted), p_expires_at: expiresAt });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadRoleGovernanceSnapshot() {
  const { data, error } = await supabase.rpc("admin_role_governance_snapshot");
  if (error) throw error;
  return data || { users: [], applications: [], fees: [], questions: [], wallets: [], analytics: {} };
}

export async function loadOnboardingConfig(roleCode = null) {
  const { data, error } = await supabase.rpc("get_onboarding_config", { p_role_code: roleCode });
  if (error) throw error;
  return data || [];
}

export async function loadPublicRoleOnboardingConfig(roleCode) {
  if (!roleCode) throw new Error("A role is required.");
  const { data, error } = await supabase.rpc("get_role_onboarding_public_config", { p_role_code: roleCode });
  if (error) throw error;
  return data || { role_code: roleCode, fee: null, questions: [] };
}

export async function saveOnboardingQuestion(question = {}) {
  const { data, error } = await supabase.rpc("save_onboarding_question", {
    p_id: question.id || null,
    p_role_code: question.roleCode,
    p_prompt: question.prompt,
    p_question_type: question.questionType || "SHORT_TEXT",
    p_options: question.options || [],
    p_required: question.required !== false,
    p_sort_order: Number(question.sortOrder || 0),
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function setOnboardingQuestionStatus(questionId, action, reason = "") {
  if (!questionId || !action) throw new Error("Question and action are required.");
  const { data, error } = await supabase.rpc("set_onboarding_question_status", {
    p_id: questionId,
    p_action: action,
    p_reason: reason || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function submitRoleApplication(roleCode, answers) {
  const { data, error } = await supabase.rpc("submit_role_application", { p_role_code: roleCode, p_answers: answers || {} });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function initializeRoleApplicationPayment(applicationId, idempotencyKey, email, callbackUrl) {
  if (!applicationId || !idempotencyKey || !email) throw new Error("Approved application and authenticated email are required.");
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error("Please sign in again before starting payment.");
  const response = await fetch("/api/paystack/role-initialize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ applicationId, idempotencyKey, email, callbackUrl }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to initialize role verification payment.");
  return payload;
}

export async function reviewRoleApplication(applicationId, status, reason = null) {
  const { data, error } = await supabase.rpc("admin_review_role_application", { p_application_id: applicationId, p_status: status, p_reason: reason });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function creditWalletForCancelledOrder(userId, amount, reason, referenceId = null) {
  const { data, error } = await supabase.rpc("wallet_credit_for_cancelled_order", { p_user_id: userId, p_amount: amount, p_reason: reason, p_reference_id: referenceId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadPublicContentAnalytics() {
  const { data, error } = await supabase.rpc("public_content_analytics");
  if (error) throw error;
  return data || { likes: 0, ratings: 0, comments: 0 };
}

export async function createContentComment(targetType, targetId, body, authorId) {
  if (!targetType || !targetId || !body?.trim() || !authorId) throw new Error("Comment details are required.");
  const { data, error } = await supabase.from("content_comments").insert({ target_type: targetType, target_id: targetId, body: body.trim(), author_id: authorId }).select().single();
  if (error) throw error;
  return data;
}

export async function setContentRating(targetType, targetId, rating, userId) {
  if (!targetType || !targetId || !userId) throw new Error("Rating details are required.");
  const { data, error } = await supabase.from("content_ratings").upsert({ target_type: targetType, target_id: targetId, rating: Number(rating), user_id: userId }, { onConflict: "user_id,target_type,target_id" }).select().single();
  if (error) throw error;
  return data;
}

export async function setContentLike(targetType, targetId, userId, liked) {
  if (!targetType || !targetId || !userId) throw new Error("Like details are required.");
  if (liked) {
    const { data, error } = await supabase.from("content_likes").upsert({ target_type: targetType, target_id: targetId, user_id: userId }, { onConflict: "user_id,target_type,target_id" }).select().single();
    if (error) throw error;
    return data;
  }
  const { error } = await supabase.from("content_likes").delete().match({ target_type: targetType, target_id: targetId, user_id: userId });
  if (error) throw error;
  return null;
}

export async function setRoleFeePolicy(roleCode, enabled, amount, currency = "NGN", reviewHours = 24) {
  const { data, error } = await supabase.rpc("set_role_fee_policy", { p_role_code: roleCode, p_enabled: enabled, p_amount: Number(amount || 0), p_currency: currency, p_review_hours: Number(reviewHours || 24) });
  if (error) throw error;
  return data;
}
export async function setPlatformFeePolicy(policyKey, enabled, feeType, amount, currency = "NGN") {
  const { data, error } = await supabase.rpc("set_platform_fee_policy", {
    p_policy_key: policyKey,
    p_enabled: enabled,
    p_fee_type: feeType,
    p_amount: Number(amount || 0),
    p_currency: currency,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function adminSetEventStatus(eventId, status, reason = null) {
  if (!eventId || !status) throw new Error("Event and status are required.");
  const { data, error } = await supabase.rpc("admin_set_event_status", {
    p_event_id: eventId,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadGovernanceEvents() {
  const { data, error } = await supabase.rpc("admin_governance_event_snapshot");
  if (error) throw error;
  return data || [];
}

export async function loadContentEngagement(targetType, targetId, userId = null) {
  if (!targetType || !targetId) return { comments: [], averageRating: 0, ratingCount: 0, likeCount: 0, liked: false };
  const [{ data: comments, error: commentsError }, { data: ratings, error: ratingsError }, { data: likes, error: likesError }] = await Promise.all([
    supabase.from("content_comments").select("id,body,author_id,created_at,user_profiles(id,full_name,avatar_url)").eq("target_type", targetType).eq("target_id", targetId).eq("status", "VISIBLE").order("created_at", { ascending: false }).limit(50),
    supabase.from("content_ratings").select("rating,user_id").eq("target_type", targetType).eq("target_id", targetId).limit(1000),
    supabase.from("content_likes").select("user_id").eq("target_type", targetType).eq("target_id", targetId).limit(1000),
  ]);
  const firstError = [commentsError, ratingsError, likesError].find(Boolean);
  if (firstError) throw firstError;
  const commentRows = comments || [];
  const ratingRows = ratings || [];
  const likeRows = likes || [];
  return {
    comments: commentRows.map((comment) => ({ ...comment, user_profiles: comment.user_profiles || null })),
    averageRating: ratingRows.length ? ratingRows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / ratingRows.length : 0,
    ratingCount: ratingRows.length,
    likeCount: likeRows.length,
    liked: Boolean(userId && likeRows.some((row) => row.user_id === userId)),
    userRating: userId ? ratingRows.find((row) => row.user_id === userId)?.rating || 0 : 0,
  };
}


export async function superAdminSetRole(targetUserId, roleCode, action, reason = "") {
  if (!targetUserId || !roleCode || !action) throw new Error("Role target, role, and action are required.");
  const { data, error } = await supabase.rpc("super_admin_set_role", {
    p_target_user_id: targetUserId,
    p_role_code: roleCode,
    p_action: action,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data;
}

export async function loadRoleAssignmentHistory(targetUserId = null) {
  let query = supabase.from("role_assignment_history").select("id,target_user_id,role_id,action,reason,actor_id,created_at,roles(code,label)").order("created_at", { ascending: false }).limit(100);
  if (targetUserId) query = query.eq("target_user_id", targetUserId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function superAdminSetRolePermission(roleCode, permissionCode, granted, reason = "") {
  if (!roleCode || !permissionCode) throw new Error("Role and permission are required.");
  const { data, error } = await supabase.rpc("super_admin_set_role_permission", {
    p_role_code: roleCode,
    p_permission_code: permissionCode,
    p_granted: Boolean(granted),
    p_reason: reason || null,
  });
  if (error) throw error;
  return data;
}
