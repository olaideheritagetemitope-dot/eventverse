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
  musicVideos: new Set([
    "70000000-0000-0000-0000-000000000001",
    "70000000-0000-0000-0000-000000000002",
    "70000000-0000-0000-0000-000000000003",
    "70000000-0000-0000-0000-000000000004",
    "70000000-0000-0000-0000-000000000005",
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

const artistAvatarSource = (artist) => artist?.image_url || artist?.avatar_url || artist?.avatarUrl || artist?.profile_image_url || artist?.profile_avatar_url || null;
const artistBackgroundSource = (artist) => artist?.background_url || artist?.background_image_url || artist?.cover_url || artist?.coverUrl || null;

export const toArtist = (artist) => {
  const avatarUrl = artistAvatarSource(artist);
  const backgroundUrl = artistBackgroundSource(artist);
  return {
    ...artist,
    id: artist.id,
    name: artist.name || artist.artist_name || artist.display_name || artist.full_name || "Artist pending",
    followers: formatFollowers(artist.follower_count ?? artist.followers_count),
    verified: Boolean(artist.verified),
    avatarUrl,
    backgroundUrl,
    coverUrl: backgroundUrl || avatarUrl || null,
    img: avatarUrl,
  };
};

async function hydrateArtistAvatars(rows) {
  const artists = Array.isArray(rows) ? rows : [];
  const missingIds = artists.map((artist) => artist?.user_id).filter(Boolean);
  if (!missingIds.length) return artists;
  const { data: profiles } = await supabase.from("user_profiles").select("id,avatar_url,full_name").in("id", missingIds);
  const profileByUserId = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return artists.map((artist) => {
    const profile = profileByUserId.get(artist.user_id);
    return {
      ...artist,
      name: artist.name || profile?.full_name || "Artist pending",
      image_url: mediaUrl(artist.image_url) || mediaUrl(profile?.avatar_url) || null,
    };
  });
}

export async function loadArtistDetail(artistId) {
  if (!artistId) return null;
  // The artist profile is authoritative and must not be rejected because an optional
  // media relationship, legacy FK, or schema-cache join is unavailable. Load the base
  // entity first, then settle independent media queries separately.
  const { data, error } = await supabase
    .from("artists")
    .select("id,user_id,name,bio,verified,follower_count,image_url,background_url,created_at,updated_at")
    .eq("id", artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [profileResult, videosResult, songsResult, albumsResult, eventsResult] = await Promise.allSettled([
    data.user_id ? supabase.from("user_profiles").select("id,avatar_url").eq("id", data.user_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase
      .from("music_videos")
      .select("id,artist_id,song_id,title,description,thumbnail_url,video_url,status,published_at,created_at")
      .eq("artist_id", artistId)
      .eq("status", "PUBLISHED")
      .not("video_url", "is", null)
      .order("published_at", { ascending: false }),
    supabase
      .from("songs")
      .select("id,artist_id,title,duration_seconds,audio_url,cover_url,lyrics_text,status,published_at,created_at")
      .eq("artist_id", artistId)
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false }),
    supabase
      .from("albums")
      .select("id,artist_id,title,description,cover_url,status,release_date,created_at,updated_at")
      .eq("artist_id", artistId)
      .eq("status", "PUBLISHED")
      .order("release_date", { ascending: false }),
    supabase
      .from("event_artists")
      .select("event_id,events(id,title,starts_at,city,status,image_url,cover_url)")
      .eq("artist_id", artistId),
  ]);

  const profileAvatar = profileResult.status === "fulfilled" && !profileResult.value.error ? mediaUrl(profileResult.value.data?.avatar_url) : null;
  const artistRecord = { ...data, image_url: mediaUrl(data.image_url) || profileAvatar || null };
  const videos = videosResult.status === "fulfilled" && !videosResult.value.error
    ? (videosResult.value.data || []).map((video) => toMusicVideo({ ...video, artists: { id: data.id, name: data.name } }))
    : [];
  const songs = songsResult.status === "fulfilled" && !songsResult.value.error
    ? (songsResult.value.data || []).map((song) => toSong({ ...song, artists: { id: data.id, name: data.name } }))
    : [];
  const albums = albumsResult.status === "fulfilled" && !albumsResult.value.error
    ? (albumsResult.value.data || []).map((album) => ({ ...album, coverUrl: mediaUrl(album.cover_url), artistId: album.artist_id }))
    : [];
  const events = eventsResult.status === "fulfilled" && !eventsResult.value.error
    ? (eventsResult.value.data || []).map((row) => row.events).filter(Boolean)
    : [];

  return { ...toArtist(artistRecord), songs, musicVideos: videos, albums, events };
}

export const toMusicVideo = (video) => ({
  ...video,
  id: video.id,
  title: video.title,
  artistId: video.artist_id,
  songId: video.song_id || null,
  linkedSong: video.songs ? toSong(video.songs) : null,
  artist: video.artists?.name || "Artist pending",
  description: video.description || "",
  videoUrl: mediaUrl(video.video_url || video.videoUrl),
  thumbnailUrl: mediaUrl(video.thumbnail_url || video.thumbnailUrl || video.cover_url),
  musicVideoUrl: mediaUrl(video.video_url || video.videoUrl),
  publishedAt: video.published_at || null,
});

const MUSIC_VIDEO_DETAIL_SELECT = "id,artist_id,song_id,title,description,thumbnail_url,video_url,status,published_at,created_at,artists(id,name),songs(id,title,duration_seconds,audio_url,cover_url,lyrics_text,artists(id,name))";

export async function loadMusicVideoDetail(videoId) {
  if (!videoId) return null;
  const { data, error } = await supabase.from("music_videos").select(MUSIC_VIDEO_DETAIL_SELECT).eq("id", videoId).eq("status", "PUBLISHED").not("video_url", "is", null).maybeSingle();
  if (error) throw error;
  return data ? toMusicVideo(data) : null;
}

export async function loadMusicVideoForSong(songId) {
  if (!songId) return null;
  const { data, error } = await supabase.from("music_videos").select(MUSIC_VIDEO_DETAIL_SELECT).eq("song_id", songId).eq("status", "PUBLISHED").not("video_url", "is", null).order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? toMusicVideo(data) : null;
}

// A standalone video is not silently converted into a Song relationship. This lookup only
// surfaces an explicitly published, same-artist, exact-title video as a related record.
export async function loadRelatedStandaloneMusicVideo(song) {
  if (!song?.artistId || !song?.title) return null;
  const { data, error } = await supabase.from("music_videos").select("id,artist_id,song_id,title,description,thumbnail_url,video_url,status,published_at,created_at,artists(id,name),songs(id,title,duration_seconds,audio_url,cover_url,lyrics_text,artists(id,name))").eq("artist_id", song.artistId).is("song_id", null).eq("status", "PUBLISHED").not("video_url", "is", null).ilike("title", song.title).order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { ...toMusicVideo(data), isRelatedStandalone: true } : null;
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

const baseCatalogQueries = {
  events: () => supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,rating,review_count,venues(id,name,city,address,capacity),ticket_types(id,price)").in("status", ["PUBLISHED", "SOLD_OUT", "LIVE", "COMPLETED"]).order("starts_at"),
  artists: () => supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,background_url").order("follower_count", { ascending: false }),
  songs: () => supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,status,published_at,artists(id,name,image_url)").eq("status", "PUBLISHED").not("audio_url", "is", null).order("play_count", { ascending: false }),
  musicVideos: () => supabase.from("music_videos").select("id,artist_id,song_id,title,description,thumbnail_url,video_url,status,published_at,created_at,artists(id,name),songs(id,title,duration_seconds,audio_url,cover_url,lyrics_text,artists(id,name))").eq("status", "PUBLISHED").not("video_url", "is", null).order("published_at", { ascending: false }),
  categories: () => supabase.from("categories").select("id,name,slug").order("name"),
  venues: () => supabase.from("venues").select("id,name,city,address,capacity,status,image_urls").eq("status", "ACTIVE").order("name"),
};

async function settleCatalogQueries() {
  const entries = Object.entries(baseCatalogQueries);
  const settled = await Promise.allSettled(entries.map(([, query]) => query()));
  return Object.fromEntries(entries.map(([name], index) => {
    const result = settled[index];
    if (result.status === "rejected") return [name, { data: [], error: result.reason }];
    if (result.value?.error) return [name, { data: [], error: result.value.error }];
    return [name, { data: result.value?.data || [], error: null }];
  }));
}

export async function loadCatalog() {
  const results = await settleCatalogQueries();
  const artistRows = await hydrateArtistAvatars(filterLiveCatalogRows("artists", results.artists.data));
  return {
    events: filterLiveCatalogRows("events", results.events.data).map(toEvent),
    artists: artistRows.map(toArtist),
    songs: filterLiveCatalogRows("songs", results.songs.data).map(toSong),
    musicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo),
    latestMusicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo),
    allMusicVideos: filterLiveCatalogRows("musicVideos", results.musicVideos.data).map(toMusicVideo),
    categories: results.categories.data,
    venues: filterLiveCatalogRows("venues", results.venues.data).map((venue) => ({ ...venue, imageUrl: firstVenueImage(venue) })),
    catalogErrors: Object.fromEntries(Object.entries(results).filter(([, result]) => result.error).map(([name, result]) => [name, result.error])),
  };
}

export async function searchCatalog(query) {
  const term = query.trim();
  if (!term) return { events: [], artists: [], songs: [], venues: [] };
  const pattern = `%${term}%`;
  const entries = [
    ["events", () => supabase.from("events").select("id,organizer_id,venue_id,title,description,event_type,city,starts_at,ends_at,cover_url,status,rating,review_count,venues(id,name,city,address,capacity),ticket_types(id,price)").in("status", ["PUBLISHED", "SOLD_OUT", "LIVE", "COMPLETED"]).or(`title.ilike.${pattern},description.ilike.${pattern},city.ilike.${pattern}`).order("starts_at").limit(20)],
    ["artists", () => supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,background_url").or(`name.ilike.${pattern},bio.ilike.${pattern}`).order("follower_count", { ascending: false }).limit(20)],
    ["artistProfiles", () => supabase.from("user_profiles").select("id,full_name,avatar_url").ilike("full_name", pattern).limit(20)],
    ["songs", () => supabase.from("songs").select("id,artist_id,title,duration_seconds,audio_url,cover_url,play_count,status,published_at,artists(id,name,image_url)").eq("status", "PUBLISHED").not("audio_url", "is", null).ilike("title", pattern).order("play_count", { ascending: false }).limit(20)],
    ["venues", () => supabase.from("venues").select("id,name,city,address,capacity,status,image_urls").eq("status", "ACTIVE").or(`name.ilike.${pattern},city.ilike.${pattern},address.ilike.${pattern}`).order("name").limit(20)],
  ];
  const settled = await Promise.allSettled(entries.map(([, loader]) => loader()));
  const resultByName = Object.fromEntries(entries.map(([name], index) => {
    const result = settled[index];
    if (result.status === "rejected") return [name, { data: [], error: result.reason }];
    return [name, { data: result.value?.error ? [] : (result.value?.data || []), error: result.value?.error || null }];
  }));
  const profileMatches = resultByName.artistProfiles.data || [];
  const directArtists = resultByName.artists.data || [];
  let profileArtists = [];
  if (profileMatches.length) {
    const userIds = profileMatches.map((profile) => profile.id).filter(Boolean);
    const { data: linkedArtists, error: linkedArtistError } = await supabase.from("artists").select("id,user_id,name,bio,verified,follower_count,image_url,background_url").in("user_id", userIds);
    if (!linkedArtistError) profileArtists = linkedArtists || [];
  }
  const mergedArtists = [...directArtists, ...profileArtists].filter((artist, index, rows) => artist?.id && rows.findIndex((item) => item.id === artist.id) === index);
  return {
    events: filterLiveCatalogRows("events", resultByName.events.data).map(toEvent),
    artists: (await hydrateArtistAvatars(filterLiveCatalogRows("artists", mergedArtists))).map(toArtist),
    songs: filterLiveCatalogRows("songs", resultByName.songs.data).map(toSong),
    venues: filterLiveCatalogRows("venues", resultByName.venues.data).map((venue) => ({ ...venue, imageUrl: firstVenueImage(venue) })),
    searchErrors: Object.fromEntries(Object.entries(resultByName).filter(([name, result]) => !["artistProfiles"].includes(name) && result.error).map(([name, result]) => [name, result.error])),
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
