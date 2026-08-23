import React, { useState, useRef, useEffect, useImperativeHandle } from "react";
import {
  Search, Bell, Menu, ChevronLeft, ChevronRight, Play, Pause,
  SkipBack, SkipForward, Heart, Share2, Star, MapPin, Calendar,
  Clock, Minus, Plus, Check, ShieldCheck, Home, Compass, Music2,
  Ticket, User, LogOut, X, QrCode, Shuffle, Repeat, ListMusic, ChevronDown, MoreVertical,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { loadCatalog, loadArtistDetail, loadEventDetail, loadVenueDetail, searchCatalog, formatFollowers } from "./services/catalog";
import CheckInScreen from "./components/CheckInScreen";
import { loadCurrentUser, loadFavoriteState, toggleEventFavorite, toggleArtistFollow, toggleMusicFavorite, loadMusicFavorites, recordPlay, loadPlaylists, createPlaylist, submitBooking, loadRoleDashboard, loadArtistWorkspace, loadArtistCreatorContent, createArtistSong, setArtistSongStatus, archiveArtistSong, deleteArtistSong, createArtistAlbum, updateArtistAlbum, setArtistAlbumStatus, createArtistMusicVideo, updateArtistMusicVideo, setArtistMusicVideoStatus, updateArtistProfile, updateArtistSong, artistUpdateBookingStatus, issueTicketQrToken, updateProfile, loadArtistOnboarding, initializeArtistFeePayment, loadArtistFeeTransaction, loadArtistAdminOverview, updateArtistFee, loadOrganizerApplication, applyAsOrganizer, loadOrganizerEvents, createOrganizerEvent, updateOrganizerEvent, addOrganizerTicketType, discoverPrivateTicket, linkOrganizerArtist, publishOrganizerEvent, cancelOrganizerEvent, loadOrganizerEventDashboard, loadVenueManagerWorkspace, applyAsVenueManager, createOwnedVenue, updateOwnedVenue, archiveOwnedVenue, deleteOwnedVenue, requestVenueBooking, respondVenueBooking, setVenueAvailability, initializeVenueBookingPayment, loadAvailableVenues, searchOrganizerArtists, searchEventStaffUsers, assignEventStaff, loadEventStaffForOrganizer, updateEventStaffShift, revokeEventStaffAssignment, loadEventStaffWorkspace, respondEventStaffAssignment, acknowledgeEventStaffTask, loadSuperAdminAnalytics, loadAdminDashboardSnapshot, adminListUsers, adminSuspendUser, adminReviewEvent, loadAdminPaymentSupport, loadAdminAuditLogs, loadUserExperienceSnapshot, loadUserCollections, recordUserSearch, clearUserSearchHistory, updateUserPreferences, markUserNotificationRead, markAllUserNotificationsRead, createSupportRequest, uploadMediaFile, loadMyPosts, createPost, updatePost, setPostStatus, deletePost, removeMediaAsset, loadPolicySettings, updatePolicySetting, loadRoleCapabilityMatrix, loadAdminPermissionGrants, setAdminPermission, loadRoleGovernanceSnapshot, loadOnboardingConfig, loadPublicRoleOnboardingConfig, saveOnboardingQuestion, submitRoleApplication, loadRoleApplication, initializeRoleApplicationPayment, reviewRoleApplication, creditWalletForCancelledOrder, loadPublicContentAnalytics, createContentComment, setContentRating, setContentLike, setRoleFeePolicy, setPlatformFeePolicy, adminSetEventStatus, loadGovernanceEvents, loadContentEngagement, superAdminSetRole, superAdminSetRolePermission, loadRoleAssignmentHistory } from "./services/user";
import QRCode from "qrcode";
import { ATIZZY_TOKENS, EMPTY_CATALOG, normalizeCatalog, resourceState } from "./ui/designSystem";
import { loadDiscoverySnapshot, recordDiscoveryEvent } from "./services/discovery";
import SuperAdminModuleRegistry from "./components/SuperAdminModuleRegistry";
import AdvancedGovernancePanels from "./components/AdvancedGovernancePanels";

/* ============================== DESIGN TOKENS ==============================
   Black (bg)        #0B0A08  — dominant surface
   Charcoal (card)    #17140F  — cards / inputs / secondary surface
   Deep blue (panel)  #12141C  — subtle depth on select panels
   Wood (premium)     #3A2A1B  — premium / selected / ticket surfaces
   Green (music)      #16261D  — music accents, artist imagery overlay
   Gold (accent)      #CDA349  — CTAs, active states, premium markers
   Ivory (text)       #F3EEE3  — primary text
============================================================================ */
const C = ATIZZY_TOKENS;

async function ensureUserProfile(user) {
  if (!user?.id) return;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null;
  // OAuth providers may return external avatar URLs. Managed-media policy requires
  // Storage-backed URLs only, so bootstrap identity metadata without writing them.
  const { error } = await supabase.from("user_profiles").upsert(
    { id: user.id, full_name: fullName },
    { onConflict: "id", ignoreDuplicates: false },
  );
  if (error) console.error("EventVerse profile bootstrap failed", error);
}

const font = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
  .ev-root { font-family: 'Inter', sans-serif; }
  .ev-display { font-family: 'Fraunces', serif; }
`;

/* ============================== LIVE DATA HELPERS ============================== */

const categoryLabel = (category) => category?.name || category?.slug || "Uncategorized";
const imageStyle = (url, fallback = C.card) => url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: fallback };

const money = (n) => `\u20A6${Number(n || 0).toLocaleString()}`;
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; };
const assignedRoleCodes = (account) => (account?.roles || []).map((role) => typeof role === "string" ? role : role.code).filter(Boolean);
const effectiveRoleCodes = (account) => (Array.isArray(account?.effectiveRoles) && account.effectiveRoles.length ? account.effectiveRoles : assignedRoleCodes(account));
const hasAssignedRole = (account, role) => assignedRoleCodes(account).includes(role);
const hasEffectiveRole = (account, role) => effectiveRoleCodes(account).includes(role);

/* ============================== SHARED UI ============================== */
function Phone({ children }) {
  return (
    <div
      className="ev-root ev-app-frame relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      style={{
        background: C.bg,
        minHeight: "100dvh",
        width: "100dvw",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
      }}
    >
      <div aria-hidden="true" className="ev-atizzy-pattern" />
      <div className="relative z-[1] flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function TopBack({ title, onBack, right }) {
  return (
    <div className="ev-global-header flex items-center justify-between px-5 py-3">
      <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.card, color: C.ivory }}>
        <ChevronLeft size={18} />
      </button>
      {title && <span className="text-[15px] font-semibold" style={{ color: C.ivory }}>{title}</span>}
      <div className="w-9 h-9 flex items-center justify-center">{right}</div>
    </div>
  );
}

function GoldButton({ children, onClick, disabled, full = true, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? C.line : `linear-gradient(135deg, ${C.goldSoft}, ${C.gold})`,
        color: disabled ? C.muted : "#1A1408",
        width: full ? "100%" : undefined,
        ...style,
      }}
      className="rounded-2xl py-3.5 font-semibold text-[14px] tracking-wide transition active:scale-[0.98] disabled:active:scale-100"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }) {
  return (
    <button onClick={onClick} className="w-full rounded-2xl py-3.5 font-medium text-[14px]" style={{ background: "transparent", color: C.ivory, border: `1px solid ${C.line}` }}>
      {children}
    </button>
  );
}

function Pill({ active, children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="ev-pill flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition"
      style={{
        background: active ? `linear-gradient(135deg, ${C.woodLight}, ${C.wood})` : C.card,
        color: active ? C.goldSoft : C.muted,
        border: active ? `1px solid ${C.gold}55` : `1px solid transparent`,
      }}
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  );
}

function Field({ label, type = "text", placeholder, value, onChange }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl px-4 py-3.5 text-[14px] outline-none"
        style={{ background: C.card, color: C.ivory, border: `1px solid ${C.line}` }}
      />
    </div>
  );
}

function MediaUploadField({ label, accept, value, onChange, existingUrl = "", onRemove, hint = "JPG, PNG, WEBP or audio · max 50 MB" }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [validationError, setValidationError] = useState("");
  useEffect(() => {
    if (!value || !value.type?.startsWith("image/")) { setPreviewUrl(""); return undefined; }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  const imageUrl = previewUrl || existingUrl;
  const isImage = accept?.includes("image/") && imageUrl;
  const chooseFile = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setValidationError("");
    if (!file) return;
    const acceptedTypes = String(accept || "").split(",").map((item) => item.trim()).filter(Boolean);
    const typeAllowed = !acceptedTypes.length || acceptedTypes.some((acceptedType) => acceptedType === file.type || (acceptedType.endsWith("/*") && file.type.startsWith(`${acceptedType.slice(0, -1)}`)));
    if (!typeAllowed) {
      setValidationError("Choose a supported photo or media file.");
      return;
    }
    const isImageFile = file.type.startsWith("image/");
    const maxBytes = isImageFile ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    const maxLabel = isImageFile ? "5 MB" : "50 MB";
    if (file.size > maxBytes) {
      setValidationError(`The selected file must be smaller than ${maxLabel}.`);
      return;
    }
    onChange(file);
  };
  const removeFile = () => { setValidationError(""); onChange(null); onRemove?.(); };
  return (
    <div className="mb-4">
      <span className="block text-[12px] mb-1.5" style={{ color: C.muted }}>{label}</span>
      {isImage && <div className="relative mb-2"><img src={imageUrl} alt={`${label} preview`} className="w-full max-h-40 rounded-xl object-cover" /><button type="button" onClick={removeFile} aria-label={`Remove ${label.toLowerCase()}`} className="absolute top-2 right-2 rounded-full px-2.5 py-1.5 text-[10px] font-semibold" style={{ background: "rgba(11,10,8,.86)", color: C.ivory }}>Remove</button></div>}
      <input ref={inputRef} type="file" accept={accept} onChange={chooseFile} className="sr-only" aria-label={`Choose ${label.toLowerCase()}`} />
      <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-xl px-3 py-3 text-[12px] font-semibold text-left transition active:scale-[0.98]" style={{ background: C.card, color: C.ivory, border: `1px solid ${C.line}` }}>
        {value || existingUrl ? `Change ${label}` : `Select ${label}`}
      </button>
      {(value || existingUrl) && <div className="flex items-center justify-between gap-3 mt-2"><span className="text-[10px] truncate" style={{ color: C.muted }}>{value?.name || "Current uploaded image"}{value?.size ? ` · ${(value.size / 1024 / 1024).toFixed(1)} MB` : ""}</span>{!isImage && <button type="button" onClick={removeFile} className="text-[10px] font-semibold shrink-0" style={{ color: C.red }}>Remove</button>}</div>}
      <p className="text-[10px] mt-1" style={{ color: validationError ? C.red : C.muted }}>{validationError || (!value && existingUrl ? "Current media · select another to replace" : hint)}</p>
    </div>
  );
}

function EventCard({ ev, onClick, wide }) {
  return (
    <button onClick={onClick} className="ev-card flex-shrink-0 text-left rounded-2xl overflow-hidden" style={{ width: wide ? "100%" : 168, background: C.card }}>
      <div className="relative" style={{ height: wide ? 150 : 100, ...imageStyle(ev.img, `linear-gradient(145deg, ${C.wood}, ${C.green})`) }}>
        <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "#00000080", color: C.goldSoft }}>{ev.tag}</span>
        <span className="absolute bottom-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: C.gold, color: "#1A1408" }}>{ev.date.split(" ")[0]} {ev.date.split(" ")[1]}</span>
      </div>
      <div className="p-3">
        <p className="text-[13px] font-semibold leading-tight mb-1" style={{ color: C.ivory }}>{ev.title}</p>
        <p className="text-[11px] mb-1.5 flex items-center gap-1" style={{ color: C.muted }}><MapPin size={10} />{ev.venue}</p>
        <p className="text-[12px] font-semibold" style={{ color: C.goldSoft }}>From {money(ev.price)}</p>
      </div>
    </button>
  );
}

function EmptyEventCard({ wide = false }) {
  return (
    <div className="ev-card flex-shrink-0 text-left rounded-2xl overflow-hidden" style={{ width: wide ? "100%" : 168, background: C.card, opacity: 0.78 }}>
      <div className="relative flex items-center justify-center" style={{ height: wide ? 150 : 100, background: `linear-gradient(145deg, ${C.wood}66, ${C.card})` }}>
        <span className="text-[24px]" style={{ color: C.muted }}>—</span>
        <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: `${C.line}cc`, color: C.muted }}>Coming soon</span>
      </div>
      <div className="p-3">
        <p className="text-[13px] font-semibold leading-tight mb-1" style={{ color: C.muted }}>Event details pending</p>
        <p className="text-[11px] mb-1.5 flex items-center gap-1" style={{ color: C.muted }}><MapPin size={10} />Venue pending</p>
        <p className="text-[12px] font-semibold" style={{ color: C.muted }}>Price pending</p>
        <button type="button" disabled className="mt-3 w-full rounded-lg py-2 text-[11px] font-semibold" style={{ color: C.muted, border: `1px solid ${C.line}` }}>View event →</button>
      </div>
    </div>
  );
}

function EmptyArtistCard() {
  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16 opacity-78">
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(145deg, ${C.wood}66, ${C.card})`, border: `1px solid ${C.line}` }}><User size={19} color={C.muted} /></div>
      <span className="text-[11px] truncate w-full text-center" style={{ color: C.muted }}>Artist pending</span>
    </div>
  );
}

function EmptySongCard() {
  return (
    <div className="flex-shrink-0 w-36 rounded-2xl p-3 opacity-78" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="h-24 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(145deg, ${C.wood}66, ${C.card})` }}><Music2 size={20} color={C.muted} /></div>
      <p className="text-[12px] font-semibold mt-2 truncate" style={{ color: C.muted }}>Song pending</p>
      <p className="text-[11px] mt-1 truncate" style={{ color: C.muted }}>Artist pending</p>
      <button type="button" disabled className="mt-2 text-[11px]" style={{ color: C.muted }}>Play unavailable</button>
    </div>
  );
}

function EmptyVenueCard() {
  return (
    <div className="flex-shrink-0 w-44 rounded-2xl overflow-hidden opacity-78" style={{ background: C.card }}>
      <div className="h-[90px] flex items-center justify-center" style={{ background: `linear-gradient(160deg, ${C.wood}, ${C.blue})` }}><MapPin size={20} color={C.muted} /></div>
      <div className="p-3"><p className="text-[12.5px] font-semibold" style={{ color: C.muted }}>Venue pending</p><p className="text-[11px]" style={{ color: C.muted }}>Location unavailable</p></div>
    </div>
  );
}

function EmptySongRow() {
  return <div className="w-full flex items-center gap-3 py-2 opacity-78"><div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.green})` }}><Music2 size={16} color={C.muted} /></div><div className="flex-1 text-left"><p className="text-[13px] font-semibold" style={{ color: C.muted }}>Song details pending</p><p className="text-[11px]" style={{ color: C.muted }}>Artist details pending</p></div><span className="text-[11px]" style={{ color: C.muted }}>—</span><Heart size={15} color={C.muted} /></div>;
}

function EmptyResourceCard({ label, description }) {
  return <div className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.wood }}><ShieldCheck size={17} color={C.muted} /></div><div><p className="text-[13px] font-semibold" style={{ color: C.muted }}>{label}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{description}</p></div></div><button disabled className="mt-3 w-full rounded-lg py-2 text-[11px]" style={{ color: C.muted, border: `1px solid ${C.line}` }}>Action unavailable until a live record exists</button></div>;
}

function BottomNav({ current, go }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "explore", label: "Explore", icon: Compass },
    { id: "music", label: "Music", icon: Music2 },
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "profile", label: "Profile", icon: User },
  ];
  return (
    <nav className="ev-bottom-nav" aria-label="Primary navigation">
      <div className="ev-bottom-nav-inner">
        {items.map((it) => {
          const active = current === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => go(it.id)}
              aria-label={`Go to ${it.label}`}
              aria-current={active ? "page" : undefined}
              className="ev-bottom-nav-item"
              data-active={active ? "true" : "false"}
            >
              <it.icon aria-hidden="true" size={19} color={active ? C.gold : C.muted} strokeWidth={active ? 2.2 : 1.8} />
              <span style={{ color: active ? C.gold : C.muted }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MiniPlayer({ song, playing, onToggle, onOpen, onPrevious, onNext }) {
  if (!song) return null;
  return (
    <div className="ev-mini-player" role="region" aria-label="Now playing">
      <div className="ev-mini-player-inner">
        <button type="button" onClick={onOpen} className="ev-mini-player-main" aria-label={`Open player for ${song.title || "current song"}`}>
          <div className="ev-mini-player-art" style={imageStyle(song.coverUrl, `linear-gradient(135deg, ${C.greenLight}, ${C.gold}55)`)} aria-hidden="true" />
          <div className="flex-1 text-left min-w-0"><p className="text-[12.5px] font-semibold truncate" style={{ color: C.ivory }}>{song.title || "Now playing"}</p><p className="text-[11px] truncate" style={{ color: C.muted }}>{song.artist || "Atizzy music"}</p></div>
        </button>
        <button type="button" onClick={onPrevious} className="ev-mini-player-control" aria-label="Play previous song"><SkipBack size={13} color="#1A1408" /></button>
        <button type="button" onClick={onToggle} className="ev-mini-player-control" aria-label={playing ? "Pause current song" : "Play current song"}>{playing ? <Pause size={15} color="#1A1408" /> : <Play size={15} color="#1A1408" fill="#1A1408" />}</button>
        <button type="button" onClick={onNext} className="ev-mini-player-control" aria-label="Play next song"><SkipForward size={13} color="#1A1408" /></button>
        <button type="button" onClick={onOpen} className="ev-mini-player-menu" aria-label="Open player options"><MoreVertical size={18} color={C.muted} /></button>
      </div>
    </div>
  );
}

const formatPlaybackTime = (value) => {
  const seconds = Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const AudioController = React.forwardRef(function AudioController({ song, playing, setPlaying, userId, onProgress }, controllerRef) {
  const audioRef = useRef(null);
  const frameRef = useRef(null);
  const intervalRef = useRef(null);
  const analyticsRef = useRef({ audio: null, sessionId: null, qualified: false });
  const syncProgress = (audio, { forceEnd = false } = {}) => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const rawCurrentTime = Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : 0;
    const currentTime = forceEnd && duration > 0 ? duration : Math.min(rawCurrentTime, duration || rawCurrentTime);
    onProgress?.({ currentTime, duration });
  };
  const stopProgressLoop = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    frameRef.current = null;
    intervalRef.current = null;
  };
  const startProgressLoop = (audio) => {
    stopProgressLoop();
    const tick = () => {
      if (audioRef.current !== audio) return stopProgressLoop();
      syncProgress(audio);
      if (audio.paused || audio.ended) return stopProgressLoop();
    };
    tick();
    intervalRef.current = setInterval(tick, 100);
    if (typeof requestAnimationFrame === "function") {
      const frameTick = () => {
        if (audioRef.current !== audio || audio.paused || audio.ended) return;
        syncProgress(audio);
        frameRef.current = requestAnimationFrame(frameTick);
      };
      frameRef.current = requestAnimationFrame(frameTick);
    }
  };

  useImperativeHandle(controllerRef, () => ({
    seekTo: (seconds) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(Number(seconds))) return;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(seconds);
      const target = Math.max(0, Math.min(Number(seconds), duration));
      audio.currentTime = target;
      syncProgress(audio);
      if (!audio.paused) startProgressLoop(audio);
    },
  }), []);

  useEffect(() => {
    stopProgressLoop();
    onProgress?.({ currentTime: 0, duration: 0 });
    if (!song?.audioUrl) {
      audioRef.current?.pause();
      audioRef.current = null;
      return undefined;
    }
    const audio = new Audio(song.audioUrl);
    audio.preload = "metadata";
    audioRef.current = audio;
    analyticsRef.current = { audio, sessionId: `${song.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`, qualified: false };
    const sync = () => syncProgress(audio);
    const playStarted = () => {
      startProgressLoop(audio);
      const analytics = analyticsRef.current;
      if (analytics.audio === audio && analytics.sessionId) {
        void recordDiscoveryEvent({ eventType: "SONG_PLAY_START", entityType: "SONG", entityId: song.id, sessionId: analytics.sessionId, idempotencyKey: `${analytics.sessionId}:start` }).catch(() => {});
      }
    };
    const qualifiedPlay = () => {
      const analytics = analyticsRef.current;
      if (analytics.audio !== audio || analytics.qualified || !Number.isFinite(audio.currentTime) || audio.currentTime < 30) return;
      analytics.qualified = true;
      void recordDiscoveryEvent({ eventType: "SONG_PLAY_QUALIFIED", entityType: "SONG", entityId: song.id, sessionId: analytics.sessionId, idempotencyKey: `${analytics.sessionId}:qualified`, durationSeconds: Math.floor(audio.currentTime) }).catch(() => {});
    };
    const playbackStopped = () => { sync(); if (audio.paused || audio.ended) stopProgressLoop(); };
    const ended = () => {
      syncProgress(audio, { forceEnd: true });
      stopProgressLoop();
      setPlaying(false);
      void recordPlay(userId, song.id, Math.floor(audio.currentTime || song.duration_seconds || 0));
    };
    const failed = () => { stopProgressLoop(); sync(); setPlaying(false); };
    ["loadedmetadata", "loadeddata", "canplay", "durationchange", "timeupdate", "progress", "seeking", "seeked", "ratechange", "playing"].forEach((eventName) => audio.addEventListener(eventName, sync));
    audio.addEventListener("play", playStarted);
    audio.addEventListener("playing", playStarted);
    audio.addEventListener("timeupdate", qualifiedPlay);
    audio.addEventListener("pause", playbackStopped);
    audio.addEventListener("waiting", playbackStopped);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", failed);
    sync();
    if (playing) audio.play().catch(() => setPlaying(false));
    return () => {
      stopProgressLoop();
        ["loadedmetadata", "loadeddata", "canplay", "durationchange", "timeupdate", "progress", "seeking", "seeked", "ratechange", "playing"].forEach((eventName) => audio.removeEventListener(eventName, sync));
      audio.removeEventListener("play", playStarted);
      audio.removeEventListener("playing", playStarted);
      audio.removeEventListener("timeupdate", qualifiedPlay);
      audio.removeEventListener("pause", playbackStopped);
      audio.removeEventListener("waiting", playbackStopped);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", failed);
      audio.pause();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [song?.id, song?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!song?.audioUrl) { setPlaying(false); return; }
    if (playing) {
      audio.play().then(() => startProgressLoop(audio)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      syncProgress(audio);
      stopProgressLoop();
    }
  }, [playing, song?.audioUrl]);
  return null;
});

/* ============================== ONBOARDING ============================== */
const SLIDES = [
  { title: "ATIZZY", sub: "Events, Music, Experiences.\nAll in one place.", cta: "Get Started", showLogin: true, bg: `linear-gradient(180deg, transparent, ${C.bg}), radial-gradient(circle at 50% 30%, ${C.woodLight}55, transparent 60%), linear-gradient(160deg, ${C.green}, ${C.bg})` },
  { title: "Discover", sub: "Find amazing events, artists, and venues near you.", cta: "Next", bg: `linear-gradient(180deg, transparent, ${C.bg}), linear-gradient(160deg, ${C.wood}, ${C.bg})` },
  { title: "Book", sub: "Book tickets, venues, and artists in a few taps.", cta: "Next", bg: `linear-gradient(180deg, transparent, ${C.bg}), linear-gradient(160deg, ${C.blue}, ${C.bg})` },
  { title: "Experience", sub: "Enjoy events, stream music, and create memories.", cta: "Get Started", bg: `linear-gradient(180deg, transparent, ${C.bg}), linear-gradient(160deg, ${C.green}, ${C.wood})` },
];

function Onboarding({ nav }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const openAuth = () => {
    window.localStorage.setItem("eventverse:onboarding-complete", "1");
    nav.push("login");
  };
  const next = () => {
    if (i < 3) return setI(i + 1);
    openAuth();
  };
  return (
    <Phone>
      <div className="flex-1 flex flex-col justify-end relative" style={{ background: s.bg }}>
        {i === 0 && (
          <div className="absolute inset-x-0 top-24 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ border: `1.5px solid ${C.gold}`, transform: "rotate(45deg)" }}>
              <span className="ev-display text-[22px]" style={{ color: C.gold, transform: "rotate(-45deg)" }}>E</span>
            </div>
            <span className="ev-display tracking-[0.2em] text-[15px]" style={{ color: C.goldSoft }}>ATIZZY</span>
          </div>
        )}
        <div className="px-7 pb-8">
          <h1 className="ev-display text-[30px] mb-2 leading-tight" style={{ color: C.ivory }}>{s.title}</h1>
          <p className="text-[13.5px] mb-7 whitespace-pre-line leading-relaxed" style={{ color: C.muted }}>{s.sub}</p>
          <GoldButton onClick={next}>{s.cta}</GoldButton>
          {s.showLogin ? (
            <button onClick={openAuth} className="w-full text-center py-3.5 text-[14px] font-medium" style={{ color: C.ivory }}>Login</button>
          ) : (
            <div className="flex justify-center gap-1.5 pt-5">
              {SLIDES.map((_, idx) => (
                <span key={idx} className="rounded-full transition-all" style={{ width: idx === i ? 18 : 6, height: 6, background: idx === i ? C.gold : C.line }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Phone>
  );
}

/* ============================== AUTH ============================== */
function AuthMessage({ message, error }) {
  if (!message && !error) return null;
  return <p className="text-[12px] mt-3" style={{ color: error ? "#E98979" : C.goldSoft }}>{message || error}</p>;
}

function ProviderIcon({ provider }) {
  if (provider === "spotify") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" focusable="false">
        <circle cx="12" cy="12" r="12" fill="#1DB954" />
        <path d="M6.4 9.1c3.65-1.1 7.6-.82 11.2.78" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.65" />
        <path d="M7.2 12.35c3.05-.82 6.27-.56 9.32.7" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.55" />
        <path d="M8.05 15.38c2.3-.55 4.68-.33 6.9.58" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.45" />
      </svg>
    );
  }

  if (provider === "facebook") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" focusable="false">
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path d="M13.35 20v-7h2.35l.35-2.72h-2.7V8.54c0-.79.22-1.33 1.36-1.33h1.46V4.78c-.25-.03-1.1-.1-2.1-.1-2.08 0-3.5 1.27-3.5 3.6v2H8.22V13h2.35v7h2.78Z" fill="#fff" />
      </svg>
    );
  }

  if (provider === "google") {
    return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[12px] font-bold" style={{ color: "#fff", background: "#4285F4" }}>G</span>;
  }

  return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[12px] font-bold" style={{ color: C.bg, background: C.ivory }}>●</span>;
}

function Login({ nav }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    setBusy(true); setError(""); setMessage("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) return setError(authError.message);
    nav.replace("home");
  };

  const sendEmailCode = async () => {
    if (!email.trim()) return setError("Enter your email first.");
    setBusy(true); setError(""); setMessage("");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (authError) return setError(authError.message);
    setMessage("A 6-digit sign-in code was sent to your email.");
    nav.push("verify", { email: email.trim(), mode: "login" });
  };

  const recover = async () => {
    if (!email.trim()) return setError("Enter your email first.");
    setBusy(true); setError("");
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (authError) return setError(authError.message);
    setMessage("Password recovery instructions sent.");
  };

  const oauth = async (provider) => {
    setError("");
    const queryParams = provider === "spotify"
      ? { show_dialog: "true" }
      : provider === "google"
        ? { prompt: "select_account" }
        : undefined;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        ...(queryParams ? { queryParams } : {}),
      },
    });
    if (authError) setError(authError.message);
  };

  const providers = [
    { label: "Google", provider: "google", enabled: true },
    { label: "Facebook", provider: "facebook", enabled: false },
    { label: "Spotify", provider: "spotify", enabled: true },
    { label: "Apple", provider: "apple", enabled: false },
  ];

  return (
    <Phone>
      <div className="flex-1 px-6 pt-8 overflow-y-auto">
        <span className="ev-display tracking-[0.15em] text-[13px]" style={{ color: C.goldSoft }}>ATIZZY</span>
        <h1 className="ev-display text-[26px] mt-6 mb-1" style={{ color: C.ivory }}>Welcome Back</h1>
        <p className="text-[13px] mb-8" style={{ color: C.muted }}>Login to your account</p>
        <Field label="Email" type="email" placeholder="renile@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={recover} disabled={busy} className="text-[12.5px] font-medium mb-6" style={{ color: C.gold }}>Forgot Password?</button>
        <GoldButton disabled={busy || !email || !password} onClick={login}>{busy ? "Signing in..." : "Login"}</GoldButton>
        <button onClick={sendEmailCode} disabled={busy || !email} className="w-full py-3.5 text-[13px] font-medium" style={{ color: C.goldSoft }}>{busy ? "Sending code..." : "Login with email code"}</button>
        <AuthMessage message={message} error={error} />
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: C.line }} />
          <span className="text-[11px]" style={{ color: C.muted }}>or continue with</span>
          <div className="flex-1 h-px" style={{ background: C.line }} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {providers.map(({ label, provider, enabled }) => (
            <button
              key={provider}
              disabled={!enabled || busy}
              onClick={() => enabled ? oauth(provider) : setError(`${label} sign-in is not configured yet.`)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-medium disabled:opacity-50"
              style={{ background: C.card, color: C.ivory, border: `1px solid ${C.line}` }}
            >
              <ProviderIcon provider={provider} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] mb-6" style={{ color: C.muted }}>Google and Spotify are enabled. Facebook and Apple will appear when their credentials are configured.</p>
        <p className="text-center text-[13px]" style={{ color: C.muted }}>
          Don't have an account?{" "}
          <button onClick={() => nav.push("signup")} className="font-semibold" style={{ color: C.gold }}>Sign up</button>
        </p>
      </div>
    </Phone>
  );
}

function Signup({ nav }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const signup = async () => {
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: form.email.trim(),
      options: {
        shouldCreateUser: true,
        data: { full_name: form.name.trim() },
      },
    });
    setBusy(false);
    if (authError) return setError(authError.message);
    nav.push("verify", { email: form.email.trim(), mode: "signup", password: form.password });
  };
  return (
    <Phone>
      <TopBack onBack={nav.pop} />
      <div className="flex-1 px-6 overflow-y-auto">
        <h1 className="ev-display text-[26px] mb-1" style={{ color: C.ivory }}>Create Account</h1>
        <p className="text-[13px] mb-7" style={{ color: C.muted }}>Sign up to get started</p>
        <Field label="Full Name" placeholder="Your full name" value={form.name} onChange={update("name")} />
        <Field label="Email" type="email" placeholder="renile@example.com" value={form.email} onChange={update("email")} />
        <Field label="Password" type="password" placeholder="At least 8 characters" value={form.password} onChange={update("password")} />
        <Field label="Confirm Password" type="password" placeholder="Repeat your password" value={form.confirm} onChange={update("confirm")} />
        <GoldButton disabled={busy || !form.name || !form.email || !form.password || !form.confirm} onClick={signup}>{busy ? "Creating account..." : "Sign Up"}</GoldButton>
        <AuthMessage error={error} />
        <p className="text-center text-[13px] mt-6 pb-6" style={{ color: C.muted }}>
          Already have an account?{" "}
          <button onClick={() => nav.pop()} className="font-semibold" style={{ color: C.gold }}>Login</button>
        </p>
      </div>
    </Phone>
  );
}

function Verify({ nav, data }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const email = data?.email || "your email address";
  const verify = async () => {
    setBusy(true); setError("");
    const { error: authError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: data?.mode === "signup" ? "signup" : "email" });
    if (authError) {
      setBusy(false);
      return setError(authError.message);
    }
    if (data?.password) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: data.password });
      if (passwordError) {
        setBusy(false);
        return setError(passwordError.message);
      }
    }
    setBusy(false);
    nav.replace("home");
  };
  const resend = async () => {
    const { error: authError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: data?.mode === "signup" } });
    if (authError) setError(authError.message);
  };
  return (
    <Phone>
      <TopBack onBack={nav.pop} />
      <div className="flex-1 px-6 pt-4">
        <h1 className="ev-display text-[24px] mb-1" style={{ color: C.ivory }}>Verify Email</h1>
        <p className="text-[13px] mb-8" style={{ color: C.muted }}>We sent a 6-digit code to<br />{email}</p>
        <Field label="Verification code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\\D/g, "").slice(0, 6))} />
        <button onClick={resend} className="text-[12.5px] mb-8" style={{ color: C.gold }}>Resend code</button>
        <GoldButton disabled={busy || code.length !== 6} onClick={verify}>{busy ? "Verifying..." : "Verify & Continue"}</GoldButton>
        <AuthMessage error={error} />
      </div>
    </Phone>
  );
}

/* ============================== HOME ============================== */
function AttendeeHome({ nav, player, catalog, account, loading, error }) {
  const [cat, setCat] = useState("All");
  const events = catalog?.events || [];
  const artists = catalog?.popularArtists || [];
  const songs = catalog?.popularSongs || [];
  const categories = [{ name: "All" }, ...(catalog?.categories || [])];
  const displayName = account?.profile?.full_name || account?.user?.user_metadata?.full_name || account?.user?.email?.split("@")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const liveLocation = events.find((event) => event.city || event.venues?.city)?.city || events.find((event) => event.venues?.city)?.venues?.city || "Location unavailable";
  const eventsState = resourceState({ loading, error, data: events });
  return (
    <Phone>
      <div className="flex items-center justify-between px-5 pt-1 pb-3">
        <button type="button" onClick={() => nav.push("profile")} aria-label="Open profile menu" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.card }}><Menu size={17} color={C.ivory} /></button>
        <div className="text-center">
          <p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>{greeting}, {displayName} 👋</p>
          <p className="text-[11px] flex items-center justify-center gap-1" style={{ color: C.muted }}><MapPin size={10} />{liveLocation}</p>
        </div>
        <button type="button" onClick={() => nav.push("notifications")} aria-label="Open notifications" className="w-9 h-9 rounded-full flex items-center justify-center relative" style={{ background: C.card }}>
          <Bell size={16} color={C.ivory} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: C.gold }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        <div className="px-5 mb-4">
          <button onClick={() => nav.push("search")} className="w-full flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <Search size={16} color={C.muted} />
            <span className="text-[13px]" style={{ color: C.muted }}>Search events, artists, venues...</span>
          </button>
        </div>

        <div className="flex gap-2 px-5 mb-5 overflow-x-auto no-scrollbar">
          {categories.map((c) => <Pill key={c.name} active={cat === c.name} onClick={() => setCat(c.name)}>{categoryLabel(c)}</Pill>)}
        </div>

        <div className="px-5 mb-6">
          {eventsState.loading && <p className="text-[13px] py-3 text-center" style={{ color: C.muted }}>Loading live events...</p>}
          {eventsState.status === "error" && <AuthMessage error={eventsState.error} />}
          {events[0] ? <EventCard ev={events[0]} wide onClick={() => nav.push("eventDetail", events[0])} /> : <EmptyEventCard wide />}
          {eventsState.status === "success" && eventsState.isEmpty && <p className="text-[11px] mt-2 text-center" style={{ color: C.muted }}>Featured event content will appear here when published.</p>}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>Upcoming Events</span>
            <button onClick={() => nav.push("explore")} className="text-[12px]" style={{ color: C.gold }}>See all</button>
          </div>
          <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar">
            {(events.length ? events.slice(1, 5) : []).map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
            {!events.length && [0, 1, 2].map((slot) => <EmptyEventCard key={`upcoming-empty-${slot}`} />)}
            {events.length > 0 && events.length < 4 && Array.from({ length: 4 - events.length }).map((_, index) => <EmptyEventCard key={`upcoming-empty-${index}`} />)}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between px-5 mb-3">
            <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>Popular Artists</span>
            <button type="button" onClick={() => nav.push("explore")} className="text-[12px]" style={{ color: C.gold }}>See all</button>
          </div>
          <div className="flex gap-4 px-5 overflow-x-auto no-scrollbar">
            {artists.map((a) => (
              <button key={a.id} onClick={() => nav.push("artist", a)} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
                <div className="w-16 h-16 rounded-full relative" style={imageStyle(a.img, C.card)}>
                  {a.verified && <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: C.gold }}><Check size={9} color="#1A1408" strokeWidth={3} /></span>}
                </div>
                <span className="text-[11px] truncate w-full text-center" style={{ color: C.ivory }}>{a.name}</span>
              </button>
            ))}
            {!artists.length && [0, 1, 2].map((slot) => <EmptyArtistCard key={`artist-empty-${slot}`} />)}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between px-5 mb-3">
            <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>Music</span>
            <button onClick={() => nav.tab("music")} className="text-[12px]" style={{ color: C.gold }}>See all</button>
          </div>
          <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar">
            {songs.slice(0, 4).map((song) => <button key={song.id} onClick={() => nav.push("musicDetail", song)} className="flex-shrink-0 w-36 rounded-2xl p-3 text-left" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="h-24 rounded-xl" style={imageStyle(song.coverUrl, C.card)} /><p className="text-[12px] font-semibold mt-2 truncate" style={{ color: C.ivory }}>{song.title}</p><p className="text-[11px] mt-1 truncate" style={{ color: C.muted }}>{song.artist}</p></button>)}
            {!songs.length && [0, 1, 2].map((slot) => <EmptySongCard key={`song-empty-${slot}`} />)}
          </div>
        </div>
      </div>

      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onPrevious={player.previous} onNext={player.next} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="home" go={nav.tab} />
    </Phone>
  );
}

/* ============================== EXPLORE ============================== */
function Explore({ nav, player, catalog }) {
  const [cat, setCat] = useState("All");
  const events = catalog?.events || [];
  const trendingEvents = catalog?.trendingEvents || [];
  const nearbyEvents = catalog?.nearbyEvents || [];
  const categories = [{ name: "All" }, ...(catalog?.categories || [])];
  const venues = catalog?.popularVenues || [];
  return (
    <Phone>
      <div className="px-5 pt-1 pb-3">
        <h1 className="ev-display text-[22px] mb-3" style={{ color: C.ivory }}>Explore</h1>
        <button onClick={() => nav.push("search")} className="w-full flex items-center gap-2 rounded-2xl px-4 py-3 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <Search size={16} color={C.muted} />
          <span className="text-[13px]" style={{ color: C.muted }}>Search events, artists, venues...</span>
        </button>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((c) => <Pill key={c.name} active={cat === c.name} onClick={() => setCat(c.name)}>{categoryLabel(c)}</Pill>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section title="Trending Events" nav={nav}>
            {trendingEvents.slice(0, 3).map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
            {!trendingEvents.length && [0, 1, 2].map((slot) => <EmptyEventCard key={`trending-empty-${slot}`} />)}
        </Section>
        <Section title="Events Near You" nav={nav}>
            {nearbyEvents.map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
            {!nearbyEvents.length && [0, 1, 2].map((slot) => <EmptyEventCard key={`nearby-empty-${slot}`} />)}
        </Section>
        <Section title="Popular Venues" nav={nav} last>
          {venues.slice(0, 6).map((venue) => (
            <button type="button" key={venue.id} onClick={() => nav.push("venueDetail", venue)} className="flex-shrink-0 w-44 rounded-2xl overflow-hidden text-left" style={{ background: C.card }}>
              <div style={{ height: 90, ...imageStyle(venue.imageUrl, `linear-gradient(160deg, ${C.wood}, ${C.blue})`) }} />
              <div className="p-3">
                <p className="text-[12.5px] font-semibold" style={{ color: C.ivory }}>{venue.name}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>{venue.city || venue.address || "Location pending"}</p>
              </div>
            </button>
          ))}
          {!venues.length && [0, 1, 2].map((slot) => <EmptyVenueCard key={`venue-empty-${slot}`} />)}
        </Section>
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onPrevious={player.previous} onNext={player.next} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="explore" go={nav.tab} />
    </Phone>
  );
}

function Section({ title, children, last, nav }) {
  const destination = title.includes("Artist") ? "explore" : title.includes("Venue") ? "search" : title.includes("Music") || title.includes("Played") ? "music" : "explore";
  const openAll = () => { if (destination === "music") nav?.tab("music"); else nav?.push(destination); };
  return (
    <div className={last ? "mb-4" : "mb-6"}>
      <div className="flex items-center justify-between px-5 mb-3">
        <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>{title}</span>
        <button type="button" onClick={openAll} className="text-[12px]" style={{ color: C.gold }}>See all</button>
      </div>
      <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar">{children}</div>
    </div>
  );
}

/* ============================== SEARCH ============================== */
function SearchScreen({ nav, catalog, account }) {
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ events: [], artists: [], songs: [], venues: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) { setResults({ events: [], artists: [], songs: [], venues: [] }); return; }
      if (account?.user?.id) recordUserSearch(query.trim()).catch(() => {});
      setLoading(true); setError("");
      try { setResults(await searchCatalog(query)); } catch (searchError) { setError(searchError.message || "Search is unavailable."); } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const artists = query ? results.artists : [];
  const songs = query ? results.songs : [];
  const events = query ? results.events : [];
  const venues = query ? results.venues : [];
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-1 pb-3">
        <button onClick={nav.pop}><ChevronLeft size={20} color={C.ivory} /></button>
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: C.card, border: `1px solid ${C.gold}55` }}>
          <Search size={15} color={C.gold} />
          <input autoFocus aria-label="Search Atizzy" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, artists, venues..." className="bg-transparent outline-none text-[13px] w-full" style={{ color: C.ivory }} />
        </div>
      </div>
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto no-scrollbar">
        {["All", "Events", "Artists", "Songs", "Venues"].map((t) => <Pill key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Pill>)}
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {loading && <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>Searching live catalog...</p>}
        {!loading && error && <AuthMessage error={error} />}
        {!loading && !error && query && !artists.length && !songs.length && !events.length && !venues.length && <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>No results for “{query}”.</p>}
        {!!artists.length && <><p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>ARTISTS</p>{artists.map((artist) => <button key={artist.id} onClick={() => nav.push("artist", artist)} className="w-full flex items-center gap-3 py-2.5"><div className="w-11 h-11 rounded-full" style={imageStyle(artist.img, C.card)} /><div className="flex-1 text-left"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{artist.name}</p><p className="text-[11px]" style={{ color: C.muted }}>{artist.followers} Followers</p></div></button>)}</>}
        {!!songs.length && <><p className="text-[12px] font-semibold mt-4 mb-2" style={{ color: C.muted }}>SONGS</p>{songs.map((song) => <button key={song.id} onClick={() => nav.push("musicDetail", song)} className="w-full flex items-center gap-3 py-2.5 text-left"><div className="w-11 h-11 rounded-lg" style={imageStyle(song.coverUrl, C.card)} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{song.title}</p><p className="text-[11px]" style={{ color: C.muted }}>{song.artist}</p></div><Play size={16} color={C.gold} /></button>)}</>}
        {!!events.length && <><p className="text-[12px] font-semibold mt-4 mb-2" style={{ color: C.muted }}>EVENTS</p>{events.map((event) => <button key={event.id} onClick={() => nav.push("eventDetail", event)} className="w-full flex items-center gap-3 pb-4 text-left"><div className="w-14 h-14 rounded-xl flex-shrink-0" style={imageStyle(event.img, C.card)} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{event.title}</p><p className="text-[11px]" style={{ color: C.muted }}>{event.date} · {event.venue}</p></div></button>)}</>}
        {!!venues.length && <><p className="text-[12px] font-semibold mt-4 mb-2" style={{ color: C.muted }}>VENUES</p>{venues.map((venue) => <button key={venue.id} onClick={() => nav.push("venueDetail", venue)} className="w-full flex items-center gap-3 py-2.5 text-left"><div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: C.card }}><MapPin size={16} color={C.gold} /></div><div><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{venue.name}</p><p className="text-[11px]" style={{ color: C.muted }}>{venue.city || venue.address || "Location pending"}</p></div></button>)}</>}
      </div>
    </Phone>
  );
}

/* ============================== EVENT DETAIL ============================== */
// Compatibility: EngagementPanel targetType="MUSIC" is normalized by the service to the live SONG target.
function EngagementPanel({ targetType, targetId, account }) {
  const [state, setState] = useState({ comments: [], averageRating: 0, ratingCount: 0, likeCount: 0, liked: false, userRating: 0 });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => { try { setState(await loadContentEngagement(targetType, targetId, account?.user?.id)); } catch (loadError) { setError(loadError.message || "Unable to load engagement."); } };
  useEffect(() => { load(); }, [targetType, targetId, account?.user?.id]);
  const requireUser = () => { if (!account?.user?.id) { setError("Sign in to like, rate, or comment."); return false; } return true; };
  const toggleLike = async () => { if (!requireUser()) return; setBusy(true); setError(""); try { await setContentLike(targetType, targetId, account.user.id, !state.liked); await load(); } catch (actionError) { setError(actionError.message || "Unable to update like."); } finally { setBusy(false); } };
  const rate = async (value) => { if (!requireUser()) return; setBusy(true); setError(""); try { await setContentRating(targetType, targetId, value, account.user.id); await load(); } catch (actionError) { setError(actionError.message || "Unable to save rating."); } finally { setBusy(false); } };
  const submit = async (event) => { event.preventDefault(); if (!requireUser() || !comment.trim()) return; setBusy(true); setError(""); try { await createContentComment(targetType, targetId, comment, account.user.id); setComment(""); await load(); } catch (actionError) { setError(actionError.message || "Unable to post comment."); } finally { setBusy(false); } };
  return <section className="rounded-2xl p-4 mb-6" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between"><div><h2 className="font-semibold" style={{ color: C.ivory }}>Community feedback</h2><p className="text-[11px] mt-1" style={{ color: C.muted }}>{state.likeCount} likes · {state.ratingCount} ratings · {state.comments.length} comments</p></div><button type="button" disabled={busy} onClick={toggleLike} className="flex items-center gap-1 rounded-full px-3 py-2 text-[11px]" style={{ background: state.liked ? `${C.red}22` : C.card2, color: state.liked ? C.red : C.muted }}><Heart size={13} fill={state.liked ? C.red : "none"} />{state.liked ? "Liked" : "Like"}</button></div><div className="flex items-center gap-1 mt-4"><span className="text-[11px] mr-2" style={{ color: C.muted }}>{state.averageRating ? state.averageRating.toFixed(1) : "No rating"}</span>{[1,2,3,4,5].map((value) => <button type="button" key={value} disabled={busy} onClick={() => rate(value)} aria-label={`Rate ${value} stars`}><Star size={18} color={value <= Number(state.userRating || Math.round(state.averageRating)) ? C.gold : C.line} fill={value <= Number(state.userRating || Math.round(state.averageRating)) ? C.gold : "none"} /></button>)}</div>{error && <p className="text-[11px] mt-3" style={{ color: C.red }}>{error}</p>}<form onSubmit={submit} className="mt-4"><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Share your experience" className="w-full rounded-xl px-3 py-3 text-[12px] resize-none outline-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="flex justify-end mt-2"><button type="submit" disabled={busy || !comment.trim()} className="rounded-xl px-4 py-2 text-[11px] font-semibold" style={{ background: busy || !comment.trim() ? C.line : C.gold, color: busy || !comment.trim() ? C.muted : C.bg }}>Post comment</button></div></form><div className="mt-4">{state.comments.slice(0, 5).map((item) => <div key={item.id} className="py-3 border-t" style={{ borderColor: C.line }}><p className="text-[11px] font-semibold" style={{ color: C.ivory }}>{item.user_profiles?.full_name || "Atizzy user"}</p><p className="text-[12px] mt-1 leading-5" style={{ color: C.muted }}>{item.body}</p></div>)}{!state.comments.length && <p className="text-[11px] py-3" style={{ color: C.muted }}>No comments yet. Be the first to share feedback.</p>}</div></section>;
}

function EventDetail({ nav, data, account }) {
  const [event, setEvent] = useState(null);
  const [artists, setArtists] = useState([]);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(Boolean(data?.id));
  const [error, setError] = useState("");
  const ev = event;
  useEffect(() => {
    if (!data?.id) return;
    let mounted = true;
    setLoading(true);
    loadEventDetail(data.id).then((detail) => {
      if (mounted) {
        setEvent(detail?.event || null);
        setArtists(Array.isArray(detail?.artists) ? detail.artists : []);
      }
    }).catch((loadError) => { if (mounted) setError(loadError.message || "Unable to load event details."); }).finally(() => { if (mounted) setLoading(false); });
    if (account?.user?.id) loadFavoriteState(account.user.id, data.id, null).then((state) => { if (mounted) setFavorite(state.eventFavorite); }).catch(() => {});
    return () => { mounted = false; };
  }, [data?.id, account?.user?.id]);
  if (loading) return <Phone><TopBack title="Event" onBack={nav.pop} /><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Loading event details...</div></Phone>;
  if (!ev) return <Phone><TopBack title="Event" onBack={nav.pop} /><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>{error || "This event is unavailable or has not been published."}</div></Phone>;
  const setEventFavorite = async () => {
    try { const next = !favorite; await toggleEventFavorite(account?.user?.id, ev.id, next); setFavorite(next); } catch (toggleError) { setError(toggleError.message || "Unable to update favorite."); }
  };
  const shareEvent = async () => {
    const url = `${window.location.origin}/events/${encodeURIComponent(ev.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: ev.title, text: `Join ${ev.title} on Atizzy`, url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setError("Event link copied."); }
      else setError(url);
    } catch (shareError) {
      if (shareError?.name !== "AbortError") setError("Unable to share this event.");
    }
  };
  return (
    <Phone>
      <div style={{ height: 240, ...imageStyle(ev.img, `linear-gradient(145deg, ${C.wood}, ${C.green})`) }} className="relative flex-shrink-0">
        <div className="flex items-center justify-between px-5 mt-2">
          <button onClick={nav.pop} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><ChevronLeft size={18} color="#fff" /></button>
          <div className="flex gap-2">
            <button onClick={setEventFavorite} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><Heart size={16} color="#fff" fill={favorite ? "#fff" : "none"} /></button>
            <button onClick={shareEvent} aria-label="Share event" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><Share2 size={16} color="#fff" /></button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pt-5" style={{ background: C.bg }}>
        <h1 className="ev-display text-[22px] mb-2" style={{ color: C.ivory }}>{ev.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-[12.5px]" style={{ color: C.muted }}>
          <span className="flex items-center gap-1"><Calendar size={12} />{ev.date}</span>
          <span className="flex items-center gap-1"><Clock size={12} />{ev.time}</span>
          <span className="flex items-center gap-1"><MapPin size={12} />{ev.venue}</span>
        </div>
        <div className="flex items-center gap-1 mb-4">
          <Star size={13} color={C.gold} fill={C.gold} />
          <span className="text-[13px] font-semibold" style={{ color: C.ivory }}>{ev.rating}</span>
          <span className="text-[12px]" style={{ color: C.muted }}>({ev.reviews} reviews)</span>
        </div>
        <p className="text-[13px] leading-relaxed mb-5" style={{ color: C.muted }}>{ev.description || "Event description will be published by the organizer."}</p>
        {error && <AuthMessage error={error} />}

        <p className="text-[13px] font-semibold mb-3" style={{ color: C.ivory }}>Performing Artists</p>
        <div className="flex gap-4 mb-5">
          {artists.slice(0, 3).map((a) => (
            <div key={a.id} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full" style={{ background: a.img }} />
              <span className="text-[10.5px]" style={{ color: C.muted }}>{a.name}</span>
            </div>
          ))}
          {artists.length > 3 && <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full self-start" style={{ background: C.card, color: C.muted }}>
            <span className="text-[11px]">+{artists.length - 3}</span>
          </div>}
        </div>

        <p className="text-[13px] font-semibold mb-2" style={{ color: C.ivory }}>About Venue</p>
        <div className="flex items-center gap-3 rounded-2xl p-3 mb-6" style={{ background: C.card }}>
          <div className="w-14 h-14 rounded-xl" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.blue})` }} />
          <div className="flex-1">
            <p className="text-[12.5px] font-semibold" style={{ color: C.ivory }}>{ev.venue}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>Capacity: {ev.venueRecord?.capacity ? Number(ev.venueRecord.capacity).toLocaleString() : "Not provided"}</p>
          </div>
          <ChevronRight size={16} color={C.muted} />
        </div>
        <EngagementPanel targetType="EVENT" targetId={ev.id} account={account} />
      </div>
      <div className="px-5 py-4 flex items-center gap-4" style={{ background: C.bg, borderTop: `1px solid ${C.line}` }}>
        <div>
          <p className="text-[10.5px]" style={{ color: C.muted }}>From</p>
          <p className="text-[16px] font-semibold" style={{ color: C.goldSoft }}>{money(ev.price)}</p>
        </div>
        <div className="flex-1"><GoldButton onClick={() => nav.push("tickets", ev)}>Get Tickets</GoldButton></div>
      </div>
    </Phone>
  );
}

/* ============================== TICKET SELECTION ============================== */
function TicketSelection({ nav, data }) {
  const ev = data;
  const [types, setTypes] = useState([]);
  const [cart, setCart] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [privateAccess, setPrivateAccess] = useState({ method: "CODE", code: "", word: "" });
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadTypes = async () => {
      if (!ev?.id || typeof ev.id !== "string") {
        if (mounted) { setError("This event is not available for live ticketing yet."); setLoading(false); }
        return;
      }
      const { data: rows, error: queryError } = await supabase
        .from("ticket_types")
        .select("id,event_id,name,price,capacity,sold,reserved,maximum_per_customer,sales_start,sales_end")
        .eq("event_id", ev.id)
        .order("price");
      if (!mounted) return;
      if (queryError) setError(queryError.message);
      setTypes(rows || []);
      setLoading(false);
    };
    loadTypes();
    return () => { mounted = false; };
  }, [ev?.id]);

  if (!ev) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Ticketing is unavailable because the event data is missing.</div></Phone>;

  const qty = (id) => cart[id] || 0;
  const available = (type) => Math.max(0, Number(type.capacity || 0) - Number(type.sold || 0) - Number(type.reserved || 0));
  const setQty = (type, value) => {
    const next = Math.max(0, Math.min(value, Number(type.maximum_per_customer || available(type))));
    setCart((current) => ({ ...current, [type.id]: next }));
  };
  const count = types.reduce((sum, type) => sum + qty(type.id), 0);
  const reserve = async () => {
    if (!ev?.id || count === 0) return;
    setBusy(true); setError("");
    const items = types.filter((type) => qty(type.id) > 0).map((type) => ({ ticket_type_id: type.id, quantity: qty(type.id) }));
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `atizzy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { data: reservation, error: reservationError } = await supabase.rpc("reserve_event_tickets", {
      p_event_id: ev.id,
      p_items: items,
      p_idempotency_key: idempotencyKey,
      p_hold_minutes: 10,
    });
    setBusy(false);
    if (reservationError) return setError(reservationError.message);
    nav.push("checkout", { ev, reservation, items, types });
  };

  const unlockPrivate = async (event) => {
    event.preventDefault();
    if (!ev?.id) return;
    setUnlocking(true); setError("");
    try {
      const unlocked = await discoverPrivateTicket(ev.id, { code: privateAccess.code, word: privateAccess.word });
      setTypes((current) => current.some((type) => type.id === unlocked.id) ? current : [...current, unlocked].sort((a, b) => Number(a.price || 0) - Number(b.price || 0)));
      setPrivateAccess((current) => ({ ...current, code: "", word: "" }));
    } catch (unlockError) {
      setError(unlockError.message || "That private ticket credential could not be verified.");
    } finally { setUnlocking(false); }
  };

  return (
    <Phone>
      <TopBack title="Select Tickets" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[13px] font-semibold mb-4" style={{ color: C.ivory }}>{ev.title}</p>
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>Private ticket access</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Enter the credential shared by the Organizer. Hidden tickets are not listed until the server verifies it.</p></div><ShieldCheck size={18} color={C.goldSoft} /></div>
          <div className="grid grid-cols-3 gap-2 mt-3"><button type="button" onClick={() => setPrivateAccess((current) => ({ ...current, method: "CODE" }))} className="rounded-xl py-2 text-[11px]" style={{ background: privateAccess.method === "CODE" ? C.gold : C.bg, color: privateAccess.method === "CODE" ? C.bg : C.muted }}>Code</button><button type="button" onClick={() => setPrivateAccess((current) => ({ ...current, method: "WORD" }))} className="rounded-xl py-2 text-[11px]" style={{ background: privateAccess.method === "WORD" ? C.gold : C.bg, color: privateAccess.method === "WORD" ? C.bg : C.muted }}>Word</button><button type="button" onClick={() => setPrivateAccess((current) => ({ ...current, method: "CODE_WORD" }))} className="rounded-xl py-2 text-[11px]" style={{ background: privateAccess.method === "CODE_WORD" ? C.gold : C.bg, color: privateAccess.method === "CODE_WORD" ? C.bg : C.muted }}>Code + word</button></div>
          <form onSubmit={unlockPrivate} className="mt-3 grid gap-2">{privateAccess.method !== "WORD" && <input value={privateAccess.code} onChange={(event) => setPrivateAccess((current) => ({ ...current, code: event.target.value }))} placeholder="Private code" autoComplete="off" className="w-full rounded-xl px-3 py-2.5 text-[12px] outline-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} />}{privateAccess.method !== "CODE" && <input value={privateAccess.word} onChange={(event) => setPrivateAccess((current) => ({ ...current, word: event.target.value }))} placeholder="Private word" autoComplete="off" className="w-full rounded-xl px-3 py-2.5 text-[12px] outline-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} />}<GoldButton disabled={unlocking}>{unlocking ? "Verifying securely..." : "Unlock private tickets"}</GoldButton></form>
        </div>
        {loading && <p className="text-[13px] py-6 text-center" style={{ color: C.muted }}>Loading live ticket availability...</p>}
        {!loading && !types.length && <p className="text-[13px] py-6 text-center" style={{ color: C.muted }}>{error || "No ticket types are currently available."}</p>}
        {types.map((type) => {
          const currentQty = qty(type.id);
          const remaining = available(type);
          return (
            <div key={type.id} className="rounded-2xl p-4 mb-3" style={{ background: currentQty > 0 ? `linear-gradient(135deg, ${C.woodLight}33, ${C.card})` : C.card, border: `1px solid ${currentQty > 0 ? C.gold + "77" : C.line}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{type.name}</p>
                  <p className="text-[13px] font-semibold mt-0.5" style={{ color: C.goldSoft }}>{money(type.price)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{remaining} available · max {type.maximum_per_customer} per customer</p>
                </div>
                <div className="flex items-center gap-3">
                  <button disabled={currentQty === 0 || busy} onClick={() => setQty(type, currentQty - 1)} className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: C.bg, border: `1px solid ${C.line}` }}><Minus size={13} color={C.ivory} /></button>
                  <span className="w-4 text-center text-[14px] font-semibold" style={{ color: C.ivory }}>{currentQty}</span>
                  <button disabled={busy || currentQty >= remaining || currentQty >= Number(type.maximum_per_customer || remaining)} onClick={() => setQty(type, currentQty + 1)} className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: C.gold }}><Plus size={13} color="#1A1408" /></button>
                </div>
              </div>
            </div>
          );
        })}
        <AuthMessage error={error} />
      </div>
      <div className="px-5 py-4 flex items-center gap-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <div>
          <p className="text-[10.5px]" style={{ color: C.muted }}>{count} Ticket{count !== 1 ? "s" : ""}</p>
          <p className="text-[12px]" style={{ color: C.muted }}>Price confirmed on server</p>
        </div>
        <div className="flex-1"><GoldButton disabled={busy || loading || count === 0 || !types.length} onClick={reserve}>{busy ? "Holding tickets..." : "Continue"}</GoldButton></div>
      </div>
    </Phone>
  );
}

/* ============================== CHECKOUT ============================== */
function Checkout({ nav, data }) {
  const { ev, reservation, items = [], types = [] } = data || {};
  if (!ev) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Checkout is unavailable because the event data is missing.</div></Phone>;
  const typeById = Object.fromEntries(types.map((type) => [type.id, type]));
  const expiresAt = reservation?.expires_at ? new Date(reservation.expires_at) : null;
  const remainingMinutes = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000)) : 0;
  return (
    <Phone>
      <TopBack title="Checkout" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>ORDER SUMMARY</p>
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
          <p className="text-[13px] font-semibold mb-3" style={{ color: C.ivory }}>{ev.title}</p>
          {items.map((item) => {
            const type = typeById[item.ticket_type_id];
            return <div key={item.ticket_type_id} className="flex justify-between text-[12.5px] py-1" style={{ color: C.muted }}><span>{type?.name || "Ticket"} ×{item.quantity}</span><span style={{ color: C.ivory }}>Server priced</span></div>;
          })}
        </div>
        <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>SERVER TOTAL</p>
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
          <div className="flex justify-between text-[12.5px] py-1" style={{ color: C.muted }}><span>Subtotal</span><span style={{ color: C.ivory }}>{money(reservation?.subtotal)}</span></div>
          <div className="flex justify-between text-[12.5px] py-1" style={{ color: C.muted }}><span>Service fee</span><span style={{ color: C.ivory }}>{money(reservation?.service_fee)}</span></div>
          <div className="flex justify-between text-[14px] font-semibold pt-2 mt-2" style={{ color: C.goldSoft, borderTop: `1px solid ${C.line}` }}><span>Total</span><span>{money(reservation?.total)}</span></div>
        </div>
        <div className="rounded-2xl p-4 mb-6" style={{ background: `${C.wood}55`, border: `1px solid ${C.gold}55` }}>
          <p className="text-[12px] font-semibold" style={{ color: C.goldSoft }}>Tickets held for {remainingMinutes} minute{remainingMinutes === 1 ? "" : "s"}</p>
          <p className="text-[11px] mt-1" style={{ color: C.muted }}>Inventory and pricing were confirmed by Atizzy before checkout.</p>
        </div>
        <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>BUYER INFORMATION</p>
        <div className="flex items-center gap-3 rounded-2xl p-4 mb-6" style={{ background: C.card }}><div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.wood }}><User size={16} color={C.goldSoft} /></div><div><p className="text-[12.5px] font-semibold" style={{ color: C.ivory }}>Signed-in attendee</p><p className="text-[11px]" style={{ color: C.muted }}>Order ownership is enforced by Supabase.</p></div></div>
      </div>
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="flex justify-between items-center mb-3"><span className="text-[13px]" style={{ color: C.muted }}>Total</span><span className="text-[19px] font-semibold" style={{ color: C.goldSoft }}>{money(reservation?.total)}</span></div>
        <GoldButton disabled={!reservation?.order_id || reservation?.status !== "ACTIVE"} onClick={() => nav.push("payment", { ev, reservation, items, types })}>Continue to Payment</GoldButton>
      </div>
    </Phone>
  );
}

/* ============================== PAYMENT ============================== */
function Payment({ nav, data }) {
  const { ev, reservation } = data || {};
  const [method, setMethod] = useState("paystack");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `atizzy-attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const [error, setError] = useState("");
  const methods = [
    { id: "paystack", label: "Paystack (Card, Bank, USSD)", sub: "Recommended" },
    { id: "card", label: "Card", sub: "Visa, Mastercard, Verve" },
    { id: "bank", label: "Bank Transfer", sub: "Manual Transfer" },
    { id: "ussd", label: "USSD", sub: "" },
  ];
  if (!ev) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Payment is unavailable because the reservation is missing.</div></Phone>;
  const initializePayment = async () => {
    if (!reservation?.order_id) return;
    if (method !== "paystack") return setError("Paystack is the only live payment provider currently enabled.");
    setBusy(true); setError("");
    try {
      // The authenticated session already contains the user email. Avoid a second
      // getUser() network round trip; the server still re-authorizes the order and
      // recalculates the payable amount before contacting Paystack.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const user = session?.user;
      if (sessionError) throw sessionError;
      if (!session?.access_token || !user?.email) throw new Error("A verified account email is required to start payment.");
      const callbackUrl = `${window.location.origin}/?payment=callback`;
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: reservation.order_id, email: user.email, callbackUrl, idempotencyKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to initialize Paystack payment.");
      const pendingPayment = { ev, reservation, payment: { payment_id: payload.paymentId, order_id: payload.orderId, status: "PROVIDER_PENDING", amount: payload.amount, currency: payload.currency, reference: payload.reference, transactionReference: payload.transactionReference || payload.reference, idempotencyKey }, items: data.items, types: data.types };
      window.localStorage.setItem("atizzy:pending-payment", JSON.stringify(pendingPayment));
      nav.push("processing", pendingPayment);
      window.location.assign(payload.authorizationUrl);
    } catch (paymentError) {
      setError(paymentError.message || "Unable to initialize payment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Phone>
      <TopBack title="Payment" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[12px] font-semibold mb-3" style={{ color: C.muted }}>CHOOSE A PAYMENT METHOD</p>
        {methods.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} className="w-full flex items-center justify-between rounded-2xl p-4 mb-3" style={{ background: method === m.id ? `${C.wood}55` : C.card, border: `1.5px solid ${method === m.id ? C.gold : C.line}` }}><div className="text-left"><p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>{m.label}</p>{m.sub && <p className="text-[11px]" style={{ color: C.gold }}>{m.sub}</p>}</div><div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${method === m.id ? C.gold : C.line}` }}>{method === m.id && <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.gold }} />}</div></button>)}
        <AuthMessage error={error} />
        <div className="rounded-2xl p-4 mt-2" style={{ background: `${C.wood}44`, border: `1px solid ${C.gold}44` }}><p className="text-[12px] font-semibold" style={{ color: C.goldSoft }}>Secure payment handoff</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Atizzy creates a server-side payment attempt first. The order is not marked paid from this screen.</p></div>
      </div>
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.line}` }}><GoldButton disabled={busy || !reservation?.order_id} onClick={initializePayment}>{busy ? "Initializing..." : `Pay ${money(reservation?.total)}`}</GoldButton></div>
    </Phone>
  );
}

function Processing({ nav, data }) {
  const [status, setStatus] = useState(data?.payment?.status || "INITIALIZED");
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    let attempts = 0;
    const poll = async () => {
      if (!data?.payment?.payment_id) return;
      const { data: payment, error: paymentError } = await supabase.from("payments").select("id,order_id,status,provider,amount,currency,verified_at").eq("id", data.payment.payment_id).maybeSingle();
      if (!mounted) return;
      if (paymentError) { setError(paymentError.message); return; }
      if (payment) setStatus(payment.status);
      if (payment?.status === "VERIFIED_SUCCESS") {
        const { data: ticket } = await supabase.from("tickets").select("id,order_id,ticket_type_id,status,checked_in_at,created_at,ticket_types(name,events(id,title,city,starts_at,cover_url,venues(name)))").eq("order_id", payment.order_id).order("created_at", { ascending: true }).maybeSingle();
        if (mounted) nav.replace("success", { ...data, payment, order: { id: payment.order_id, total: payment.amount }, ticket });
        return;
      }
      if (["FAILED", "EXPIRED", "REFUNDED"].includes(payment?.status)) return;
      attempts += 1;
      if (attempts < 30) setTimeout(poll, 2000);
    };
    const verifyReturnedPayment = async () => {
      const paymentId = data?.payment?.payment_id;
      const reference = data?.payment?.providerReference || data?.payment?.reference || data?.payment?.transactionReference;
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (paymentId && reference && session?.access_token) {
          const response = await fetch("/api/paystack/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ paymentId, reference }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok && mounted) setError(payload.error || "Payment verification is still pending.");
        }
      } catch (verificationError) {
        if (mounted) setError(verificationError.message || "Payment verification is still pending.");
      }
      if (mounted) await poll();
    };
    void verifyReturnedPayment();
    return () => { mounted = false; };
  }, [data?.payment?.payment_id, data?.payment?.providerReference, data?.payment?.reference]);
  const terminal = ["FAILED", "EXPIRED", "REFUNDED"].includes(status);
  return <Phone><div className="flex-1 flex flex-col items-center justify-center px-8"><div className="w-24 h-24 rounded-full flex items-center justify-center mb-8" style={{ background: terminal ? `${C.red}33` : `${C.gold}22`, border: `1px solid ${terminal ? C.red : C.gold}66` }}><Loader2 size={38} color={terminal ? C.red : C.gold} className={terminal ? "" : "animate-spin"} /></div><p className="text-[16px] font-semibold mb-2" style={{ color: C.ivory }}>{terminal ? `Payment ${status.toLowerCase()}` : "Waiting for payment verification"}</p><p className="text-[13px] text-center" style={{ color: C.muted }}>{error || (terminal ? "No ticket was issued for this payment attempt." : "Atizzy will issue tickets only after the provider or webhook confirms payment.")}</p>{terminal && <button onClick={nav.pop} className="mt-6 text-[13px] font-semibold" style={{ color: C.goldSoft }}>Return to payment</button>}</div></Phone>;
}

function PaymentSuccess({ nav, data }) {
  const { ev, reservation, order } = data || {};
  if (!ev) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Order details are unavailable.</div></Phone>;
  const total = reservation?.total ?? order?.total;
  return (
    <Phone>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: `${C.greenLight}` }}><Check size={36} color={C.gold} strokeWidth={2.5} /></div>
        <p className="text-[19px] font-semibold mb-1" style={{ color: C.ivory }}>Payment Successful!</p>
        <p className="text-[13px] text-center mb-6" style={{ color: C.muted }}>Your verified order is ready for ticket issuance.</p>
        <div className="w-full rounded-2xl p-5 mb-6" style={{ background: C.card }}>
          <Row label="Total Paid" value={money(total)} big />
          <Row label="Order ID" value={order?.id || reservation?.order_id || "Pending"} />
          <Row label="Event" value={ev.title} last />
        </div>
        <GoldButton disabled={!data?.ticket} onClick={() => nav.push("digitalTicket", data.ticket)}>View Ticket</GoldButton>
        <button onClick={() => nav.reset("home")} className="w-full text-center py-4 text-[13.5px] font-medium" style={{ color: C.muted }}>Back to Home</button>
      </div>
    </Phone>
  );
}

function Row({ label, value, big, last }) {
  return (
    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: last ? "none" : `1px solid ${C.line}`, marginBottom: last ? 0 : 6, paddingBottom: last ? 6 : 10 }}>
      <span className="text-[12px]" style={{ color: C.muted }}>{label}</span>
      <span style={{ color: big ? C.goldSoft : C.ivory, fontWeight: 600, fontSize: big ? 18 : 13 }}>{value}</span>
    </div>
  );
}

/* ============================== DIGITAL TICKET ============================== */
function DigitalTicket({ nav, data }) {
  const ticket = data;
  const event = ticket?.ticket_types?.events || ticket?.event || {};
  const typeName = ticket?.ticket_types?.name || ticket?.typeName || "Ticket";
  const start = event.starts_at ? new Date(event.starts_at) : null;
  const ticketId = ticket?.id || "Ticket pending";
  const [qrImage, setQrImage] = useState("");
  const [qrError, setQrError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!ticket?.id || !["ISSUED", "ACTIVE", "CHECKED_IN"].includes(ticket.status)) return undefined;
    issueTicketQrToken(ticket.id)
      .then((payload) => {
        const qrToken = String(payload?.qr_token || "").trim();
        if (!qrToken) throw new Error("The secure ticket QR payload was empty.");
        return QRCode.toDataURL(qrToken, {
          width: 512,
          margin: 4,
          errorCorrectionLevel: "H",
          color: { dark: "#0B0A08", light: "#F3EEE3" },
        });
      })
      .then((url) => { if (mounted) setQrImage(url); })
      .catch((error) => { if (mounted) setQrError(error.message || "Unable to prepare the secure ticket QR."); });
    return () => { mounted = false; };
  }, [ticket?.id, ticket?.status]);

  return (
    <Phone>
      <TopBack title={event.title || "Digital Ticket"} onBack={nav.pop} />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full rounded-3xl overflow-hidden" style={{ background: `linear-gradient(160deg, ${C.wood}, ${C.card2})`, border: `1px solid ${C.gold}44` }}>
          <div className="p-5 pb-4" style={{ background: "#00000030" }}><div className="flex justify-between items-start mb-1"><span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: C.gold, color: "#1A1408" }}>{typeName}</span><QrCode size={16} color={C.goldSoft} /></div><p className="ev-display text-[17px] mt-2" style={{ color: C.ivory }}>{event.title || "Atizzy ticket"}</p><p className="text-[11.5px]" style={{ color: C.muted }}>Issued by Atizzy · {ticket?.status || "PENDING"}</p></div>
          <div className="flex items-center justify-center py-6" style={{ borderTop: `1px dashed ${C.gold}55`, borderBottom: `1px dashed ${C.gold}55` }}><div className="w-64 h-64 rounded-xl flex items-center justify-center p-4" style={{ background: "#F3EEE3" }}>{qrImage ? <img src={qrImage} alt="Secure ticket QR code" width="512" height="512" className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} /> : <div className="flex flex-col items-center gap-2 text-center px-3" style={{ color: C.bg }}><QrCode size={96} strokeWidth={1.2} /><span className="text-[9px] font-semibold tracking-widest">{qrError ? "QR UNAVAILABLE" : "PREPARING QR"}</span></div>}</div></div>
          <div className="p-5 grid grid-cols-2 gap-4"><Ticket2 label="Ticket ID" value={ticketId} /><Ticket2 label="Order ID" value={ticket?.order_id || "Pending"} /><Ticket2 label="Date" value={start ? start.toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Pending"} /><Ticket2 label="Time" value={start ? start.toLocaleTimeString("en-NG", { timeStyle: "short" }) : "Pending"} /><Ticket2 label="Venue" value={event.venues?.name || event.city || "Pending"} /><Ticket2 label="Entry" value={ticket?.checked_in_at ? "Checked in" : "Valid"} /><Ticket2 label="Order status" value={ticket?.orders?.status || "Pending"} /><Ticket2 label="Paid" value={ticket?.orders?.total != null ? `${ticket.orders.currency || "NGN"} ${Number(ticket.orders.total).toLocaleString("en-NG")}` : "Pending"} /></div>
          <div className="px-5 pb-5"><p className="text-[11px]" style={{ color: C.muted }}>{qrError || "This QR is issued for the ticket owner and validated server-side at entry."}</p></div>
        </div>
      </div>
    </Phone>
  );
}
function Ticket2({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</p>
      <p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>{value}</p>
    </div>
  );
}

/* ============================== MY TICKETS ============================== */
function MyTickets({ nav, player }) {
  const [tab, setTab] = useState("Upcoming");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadTickets = async () => {
      const { data, error: queryError } = await supabase
        .from("tickets")
        .select("id,order_id,ticket_type_id,status,checked_in_at,created_at,ticket_types(name,events(id,title,city,starts_at,cover_url,venues(name))),orders(id,status,currency,subtotal,service_fee,discount,total,created_at,payments(provider,provider_reference,status,amount,currency,verified_at))")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (queryError) setError(queryError.message);
      setTickets((data || []).map((ticket) => ({
        ...ticket,
        typeName: ticket.ticket_types?.name || "Ticket",
        event: ticket.ticket_types?.events || null,
      })));
      setLoading(false);
    };
    loadTickets();
    return () => { mounted = false; };
  }, []);

  const filtered = tickets.filter((ticket) => {
    const eventDate = ticket.event?.starts_at ? new Date(ticket.event.starts_at).getTime() : 0;
    if (tab === "Cancelled") return ["CANCELLED", "REFUNDED", "EXPIRED"].includes(ticket.status);
    if (tab === "Past") return eventDate > 0 && eventDate < Date.now() && !["CANCELLED", "REFUNDED", "EXPIRED"].includes(ticket.status);
    return (eventDate === 0 || eventDate >= Date.now()) && !["CANCELLED", "REFUNDED", "EXPIRED"].includes(ticket.status);
  });

  return (
    <Phone>
      <div className="px-5 pt-1 pb-3"><h1 className="ev-display text-[22px] mb-3" style={{ color: C.ivory }}>My Tickets</h1><div className="flex gap-2">{["Upcoming", "Past", "Cancelled"].map((t) => <Pill key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Pill>)}</div></div>
      <div className="flex-1 overflow-y-auto px-5">
        {loading && <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>Loading your tickets...</p>}
        {!loading && error && <AuthMessage error={error} />}
        {!loading && !error && !filtered.length && <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>No {tab.toLowerCase()} tickets yet.</p>}
        {filtered.map((ticket) => {
          const event = ticket.event || {};
          const start = event.starts_at ? new Date(event.starts_at) : null;
          return <button key={ticket.id} onClick={() => nav.push("digitalTicket", ticket)} className="w-full flex gap-3 rounded-2xl p-3 mb-3 text-left" style={{ background: C.card }}><div className="w-16 h-16 rounded-xl flex-shrink-0" style={{ ...imageStyle(event.cover_url, `linear-gradient(160deg, ${C.wood}, ${C.green})`) }} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{event.title || "Atizzy ticket"}</p><p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{start ? start.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date pending"}</p><p className="text-[11px]" style={{ color: C.muted }}>{event.venues?.name || event.city || "Venue pending"}</p><p className="text-[11px] mt-1" style={{ color: C.goldSoft }}>{ticket.typeName} · {ticket.status}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{ticket.orders?.status || "Order pending"} · {ticket.orders?.total != null ? `${ticket.orders.currency || "NGN"} ${Number(ticket.orders.total).toLocaleString("en-NG")}` : "Amount pending"}</p></div><span className="self-center text-[11px] font-semibold" style={{ color: C.gold }}>View</span></button>;
        })}
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onPrevious={player.previous} onNext={player.next} onOpen={() => nav.push("musicPlayer")} /><BottomNav current="tickets" go={nav.tab} />
    </Phone>
  );
}

/* ============================== ARTIST WORKSPACE ============================== */
function ArtistWorkspace({ nav, account, catalog }) {
  const hasArtistRole = hasEffectiveRole(account, "ARTIST");
  const isSuperAdmin = hasEffectiveRole(account, "SUPER_ADMIN");
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState("Dashboard");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", image_url: "", background_url: "" });
  const [artistImageFile, setArtistImageFile] = useState(null);
  const [artistBackgroundFile, setArtistBackgroundFile] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [songCoverFile, setSongCoverFile] = useState(null);
  const [songAudioFile, setSongAudioFile] = useState(null);
  const [songMusicVideoFile, setSongMusicVideoFile] = useState(null);
  const [creatorContent, setCreatorContent] = useState({ albums: [], musicVideos: [] });
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [editingMusicVideo, setEditingMusicVideo] = useState(null);
  const [albumCoverFile, setAlbumCoverFile] = useState(null);
  const [videoThumbnailFile, setVideoThumbnailFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  const refresh = async () => {
    if (!account?.user?.id) return;
    setError("");
    try {
      const next = await loadArtistWorkspace(account.user.id);
      setWorkspace(next);
      if (next.artist) {
        setProfileForm({ name: next.artist.name || "", bio: next.artist.bio || "", image_url: next.artist.image_url || "", background_url: next.artist.background_url || "" });
        try { setCreatorContent(await loadArtistCreatorContent(next.artist.id, account.user.id)); } catch (creatorError) { setError(creatorError.message || "Unable to load artist-owned content."); }
      }
    } catch (loadError) { setError(loadError.message || "Unable to load artist workspace."); }
  };
  useEffect(() => { refresh(); }, [account?.user?.id]);

  const artist = workspace?.artist;
  const songs = workspace?.songs || [];
  if (!hasArtistRole) return <Phone><TopBack title="Artist Workspace" onBack={nav.pop} /><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Artist Workspace is available after a verified Artist role and linked Artist profile are activated.</div></Phone>;
  const events = workspace?.events || [];
  const bookings = workspace?.bookings || [];
  const albums = creatorContent.albums || [];
  const musicVideos = creatorContent.musicVideos || [];
  const upcomingEvents = events.filter((event) => event?.starts_at && new Date(event.starts_at) >= new Date());
  const recentSongs = songs.slice(0, 4);
  const bookingNeedsReview = bookings.filter((booking) => ["SUBMITTED", "REVIEWING", "NEGOTIATING"].includes(booking.status));

  const saveArtistProfile = async (event) => {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try { const image = artistImageFile ? await uploadMediaFile(account.user.id, artistImageFile, "ARTIST_AVATAR", "artists", artist.id) : null; const background = artistBackgroundFile ? await uploadMediaFile(account.user.id, artistBackgroundFile, "ARTIST_BACKGROUND", "artists", artist.id) : null; const updated = await updateArtistProfile(artist.id, account.user.id, { ...profileForm, image_url: image?.public_url || profileForm.image_url, background_url: background?.public_url || profileForm.background_url }); setWorkspace((current) => ({ ...current, artist: updated })); setArtistImageFile(null); setArtistBackgroundFile(null); setEditingProfile(false); setMessage("Artist profile saved."); } catch (saveError) { setError(saveError.message || "Unable to save artist profile."); } finally { setBusy(false); }
  };
  const saveSong = async (event) => {
    event.preventDefault(); if (!editingSong) return; setBusy(true); setMessage(""); setError("");
    try {
      const cover = songCoverFile ? await uploadMediaFile(account.user.id, songCoverFile, "MUSIC_COVER", "songs", editingSong.id || null) : null;
      const audio = songAudioFile ? await uploadMediaFile(account.user.id, songAudioFile, "AUDIO", "songs", editingSong.id || null) : null;
      const musicVideo = songMusicVideoFile ? await uploadMediaFile(account.user.id, songMusicVideoFile, "MUSIC_VIDEO", "songs", editingSong.id || null) : null;
      const payload = { ...editingSong, cover_url: cover?.public_url || editingSong.cover_url, audio_url: audio?.public_url || editingSong.audio_url, music_video_url: musicVideo?.public_url || editingSong.music_video_url, lyrics_text: editingSong.lyrics_text || null };
      const saved = editingSong.id ? await updateArtistSong(editingSong.id, artist.id, payload) : await createArtistSong(artist.id, account.user.id, payload);
      setWorkspace((current) => ({ ...current, songs: editingSong.id ? current.songs.map((song) => song.id === saved.id ? saved : song) : [saved, ...current.songs] }));
      setSongCoverFile(null); setSongAudioFile(null); setSongMusicVideoFile(null); setEditingSong(null); setMessage(editingSong.id ? "Song details saved." : "Song saved as a draft.");
    } catch (saveError) { setError(saveError.message || "Unable to save song details."); } finally { setBusy(false); }
  };
  const saveAlbum = async (event) => {
    event.preventDefault(); if (!editingAlbum) return; setBusy(true); setMessage(""); setError("");
    try {
      const cover = albumCoverFile ? await uploadMediaFile(account.user.id, albumCoverFile, "ALBUM_COVER", "albums", editingAlbum.id || null) : null;
      const payload = { ...editingAlbum, cover_url: cover?.public_url || editingAlbum.cover_url };
      const saved = editingAlbum.id ? await updateArtistAlbum(editingAlbum.id, artist.id, payload) : await createArtistAlbum(artist.id, account.user.id, payload);
      setCreatorContent((current) => ({ ...current, albums: editingAlbum.id ? current.albums.map((item) => item.id === saved.id ? saved : item) : [saved, ...current.albums] })); setEditingAlbum(null); setAlbumCoverFile(null); setMessage("Album saved as a draft.");
    } catch (saveError) { setError(saveError.message || "Unable to save album."); } finally { setBusy(false); }
  };
  const saveMusicVideo = async (event) => {
    event.preventDefault(); if (!editingMusicVideo) return; setBusy(true); setMessage(""); setError("");
    try {
      const thumbnail = videoThumbnailFile ? await uploadMediaFile(account.user.id, videoThumbnailFile, "MUSIC_VIDEO_THUMBNAIL", "music_videos", editingMusicVideo.id || null) : null;
      const video = videoFile ? await uploadMediaFile(account.user.id, videoFile, "MUSIC_VIDEO", "music_videos", editingMusicVideo.id || null) : null;
      const payload = { ...editingMusicVideo, thumbnail_url: thumbnail?.public_url || editingMusicVideo.thumbnail_url, video_url: video?.public_url || editingMusicVideo.video_url };
      const saved = editingMusicVideo.id ? await updateArtistMusicVideo(editingMusicVideo.id, artist.id, payload) : await createArtistMusicVideo(artist.id, account.user.id, payload);
      setCreatorContent((current) => ({ ...current, musicVideos: editingMusicVideo.id ? current.musicVideos.map((item) => item.id === saved.id ? saved : item) : [saved, ...current.musicVideos] })); setEditingMusicVideo(null); setVideoThumbnailFile(null); setVideoFile(null); setMessage("Music video saved as a draft.");
    } catch (saveError) { setError(saveError.message || "Unable to save music video."); } finally { setBusy(false); }
  };
  const publishAlbum = async (album) => { setBusy(true); setError(""); try { const updated = await setArtistAlbumStatus(album.id, "PUBLISHED"); setCreatorContent((current) => ({ ...current, albums: current.albums.map((item) => item.id === album.id ? { ...item, ...(Array.isArray(updated) ? updated[0] : updated), status: "PUBLISHED" } : item) })); } catch (publishError) { setError(publishError.message || "Unable to publish album."); } finally { setBusy(false); } };
  const publishMusicVideo = async (video) => { setBusy(true); setError(""); try { const updated = await setArtistMusicVideoStatus(video.id, "PUBLISHED"); setCreatorContent((current) => ({ ...current, musicVideos: current.musicVideos.map((item) => item.id === video.id ? { ...item, ...(Array.isArray(updated) ? updated[0] : updated), status: "PUBLISHED" } : item) })); } catch (publishError) { setError(publishError.message || "Unable to publish music video."); } finally { setBusy(false); } };
  const archiveSong = async (song) => { if (busy) return; if (!window.confirm(`Delete “${song.title || "this song"}” permanently? This removes the song and its owner-owned media.`)) return; setBusy(true); setMessage(""); setError(""); try { await deleteArtistSong(song.id); setWorkspace((current) => ({ ...current, songs: current.songs.filter((item) => item.id !== song.id) })); setMessage("Song deleted permanently."); } catch (deleteError) { setError(deleteError.message || "Unable to delete this song. No changes were made."); } finally { setBusy(false); } };
  const publishSong = async (song) => { setBusy(true); setError(""); try { const updated = await setArtistSongStatus(song.id, "PUBLISHED"); setWorkspace((current) => ({ ...current, songs: current.songs.map((item) => item.id === song.id ? { ...item, ...updated, status: "PUBLISHED" } : item) })); setMessage("Song published to the live catalog."); } catch (publishError) { setError(publishError.message || "Unable to publish song."); } finally { setBusy(false); } };

  const updateBooking = async (bookingId, status) => {
    setBusy(true); setMessage(""); setError("");
    try { const updated = await artistUpdateBookingStatus(bookingId, status); setWorkspace((current) => ({ ...current, bookings: current.bookings.map((booking) => booking.id === bookingId ? { ...booking, ...(Array.isArray(updated) ? updated[0] : updated) } : booking) })); setMessage(`Booking ${status.toLowerCase()}.`); } catch (statusError) { setError(statusError.message || "Unable to update booking status."); } finally { setBusy(false); }
  };

  if (!artist && workspace && !error && isSuperAdmin) return <Phone><TopBack title="Artist Workspace" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pb-8"><div className="rounded-2xl p-4 mt-2" style={{ background: C.card, border: `1px solid ${C.gold}55` }}><p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Super Admin universal access</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>Artist operations</h1><p className="text-[12px] leading-5 mt-2" style={{ color: C.muted }}>Your Super Admin identity can inspect the live Artist workspace even when it does not own a separate Artist profile. Artist-owned editing remains restricted to the linked Artist account.</p></div><section className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Live artist directory</p><span className="text-[10px] uppercase" style={{ color: C.goldSoft }}>{catalog?.artists?.length || 0} records</span></div>{catalog?.artists?.length ? catalog.artists.map((row) => <button type="button" key={row.id} onClick={() => nav.push("artist", { id: row.id })} className="w-full flex items-center justify-between gap-3 py-3 text-left border-b last:border-b-0" style={{ borderColor: C.line }}><div><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{row.name || row.stage_name || "Artist"}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{row.follower_count || 0} followers · live catalog record</p></div><span className="text-[11px] font-semibold" style={{ color: C.goldSoft }}>Open</span></button>) : <EmptyResourceCard label="No artist profiles available" description="The live Artist directory is empty. Create or approve an Artist profile to populate this workspace." />}</section></div></Phone>;
  return <Phone>
    <TopBack title="Artist Workspace" onBack={nav.pop} />
    <div className="px-5 pt-2 pb-3"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Artist workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>{artist?.name || "Artist profile"}</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>Manage your profile, music, events, and booking requests.</p></div>
    <div className="flex gap-4 px-5 pb-3 overflow-x-auto no-scrollbar">{["Dashboard", "Profile", "Music", "Albums", "Music Videos", "Events", "Bookings"].map((item) => <button key={item} onClick={() => setTab(item)} className="text-[12px] pb-2 whitespace-nowrap" style={{ color: tab === item ? C.gold : C.muted, borderBottom: tab === item ? `2px solid ${C.gold}` : "2px solid transparent" }}>{item}</button>)}</div>
    <div className="flex-1 overflow-y-auto px-5 pb-6">
      {error && <AuthMessage error={error} />}{message && <p className="text-[11px] mb-3" style={{ color: C.green }}>{message}</p>}{!workspace && !error && <p className="py-8 text-center" style={{ color: C.muted }}>Loading artist workspace...</p>}
      {workspace && tab === "Dashboard" && <><div className="grid grid-cols-2 gap-3 mb-4">{[["Followers", artist?.follower_count || 0, "People following you"], ["Songs", songs.length, "Published records"], ["Events", events.length, "Event participations"], ["Bookings", bookings.length, "Requests received"]].map(([label, value, hint]) => <div key={label} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[24px] font-semibold" style={{ color: C.goldSoft }}>{value}</p><p className="text-[12px] font-semibold mt-1" style={{ color: C.ivory }}>{label}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{hint}</p></div>)}</div><div className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-3"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Booking requests</p><button onClick={() => setTab("Bookings")} className="text-[11px]" style={{ color: C.gold }}>View all</button></div>{bookingNeedsReview.slice(0, 3).map((booking) => <div key={booking.id} className="py-2 border-b" style={{ borderColor: C.line }}><p className="text-[12px]" style={{ color: C.ivory }}>{booking.event_name}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{booking.event_date} · {booking.status}</p></div>)}{!bookingNeedsReview.length && <EmptyResourceCard label="No booking requests yet" description="New requests will appear here when someone books you." />}</div><div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold mb-3" style={{ color: C.ivory }}>Upcoming events</p>{upcomingEvents.slice(0, 3).map((event) => <div key={event.id} className="py-2 border-b" style={{ borderColor: C.line }}><p className="text-[12px]" style={{ color: C.ivory }}>{event.title}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{new Date(event.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })} · {event.city || "Location pending"}</p></div>)}{!upcomingEvents.length && <EmptyResourceCard label="No upcoming events" description="Your event participation will appear here." />}</div></>}
      {workspace && tab === "Profile" && <><div className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center gap-3"><div className="w-16 h-16 rounded-full" style={imageStyle(artist?.image_url, `linear-gradient(135deg, ${C.wood}, ${C.green})`)} /><div><p className="text-[16px] font-semibold" style={{ color: C.ivory }}>{artist?.name}</p><p className="text-[11px]" style={{ color: C.muted }}>{artist?.verified ? "Verified artist" : "Artist profile"} · {artist?.follower_count || 0} followers</p></div></div><p className="text-[12px] mt-4 leading-5" style={{ color: C.muted }}>{artist?.bio || "Add a bio so attendees can discover your story."}</p></div><button onClick={() => setEditingProfile((value) => !value)} className="w-full py-3 rounded-2xl text-[12px] font-semibold" style={{ background: C.gold, color: C.bg }}>{editingProfile ? "Close editor" : "Edit artist profile"}</button>{editingProfile && <form onSubmit={saveArtistProfile} className="rounded-2xl p-4 mt-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><Field label="Artist name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} /><Field label="Bio" value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} /><p className="text-[11px] uppercase tracking-[0.14em] mb-3" style={{ color: C.gold }}>Profile media</p><MediaUploadField label="Artist image" accept="image/png,image/jpeg,image/webp" value={artistImageFile} existingUrl={artist?.image_url || ""} onChange={setArtistImageFile} hint="Shown in the circular frame on your public profile · PNG, JPG, or WebP · max 5 MB" /><MediaUploadField label="Artist background image" accept="image/png,image/jpeg,image/webp" value={artistBackgroundFile} existingUrl={artist?.background_url || ""} onChange={setArtistBackgroundFile} hint="Shown behind your public profile · PNG, JPG, or WebP · max 8 MB" /><p className="text-[11px] mb-3" style={{ color: C.muted }}>Choose either image, then tap Publish profile media to make it live on your public artist page.</p><GoldButton disabled={busy}>{busy ? "Publishing..." : "Publish profile media"}</GoldButton></form>}</>}
      {workspace && tab === "Music" && <><div className="mb-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Your music</p><span className="text-[11px]" style={{ color: C.muted }}>{songs.length} songs</span></div><button type="button" onClick={() => { setSongCoverFile(null); setSongAudioFile(null); setSongMusicVideoFile(null); setEditingSong({ title: "", duration_seconds: 180, cover_url: "", audio_url: "", music_video_url: "", lyrics_text: "" }); }} className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold" style={{ color: C.bg, background: C.gold }}>New song</button></div></div>{editingSong && !editingSong.id && <form onSubmit={saveSong} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><Field label="Title" value={editingSong.title} onChange={(event) => setEditingSong((current) => ({ ...current, title: event.target.value }))} /><Field label="Duration (seconds)" type="number" value={editingSong.duration_seconds} onChange={(event) => setEditingSong((current) => ({ ...current, duration_seconds: event.target.value }))} /><MediaUploadField label="Song cover" accept="image/png,image/jpeg,image/webp" value={songCoverFile} onChange={setSongCoverFile} hint="PNG, JPG, or WebP · max 5 MB" /><MediaUploadField label="Audio file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/x-m4a" value={songAudioFile} onChange={setSongAudioFile} hint="MP3, M4A, WAV, or OGG · max 50 MB" /><MediaUploadField label="Music video (optional)" accept="video/mp4,video/webm" value={songMusicVideoFile} onChange={setSongMusicVideoFile} hint="MP4 or WebM · max 50 MB" /><label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>Lyrics (optional)</label><textarea value={editingSong.lyrics_text || ""} onChange={(event) => setEditingSong((current) => ({ ...current, lyrics_text: event.target.value }))} rows={5} placeholder="Paste lyrics here" className="w-full rounded-xl px-4 py-3.5 text-[14px] outline-none resize-none mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="flex gap-2"><GoldButton disabled={busy}>{busy ? "Saving..." : "Save draft"}</GoldButton><button type="button" onClick={() => setEditingSong(null)} className="px-4 rounded-xl text-[11px]" style={{ color: C.muted }}>Cancel</button></div></form>}{songs.map((song) => <div key={song.id} className="rounded-2xl p-3 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl" style={imageStyle(song.cover_url, `linear-gradient(135deg, ${C.wood}, ${C.green})`)} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{song.title}</p><p className="text-[11px]" style={{ color: C.muted }}>{song.play_count || 0} plays · {song.duration_seconds ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, "0")}` : "Duration pending"} · {song.status || "DRAFT"}</p></div><button onClick={() => { setSongCoverFile(null); setSongAudioFile(null); setSongMusicVideoFile(null); setEditingSong({ id: song.id, title: song.title, duration_seconds: song.duration_seconds, cover_url: song.cover_url || "", audio_url: song.audio_url || "", music_video_url: song.music_video_url || "", lyrics_text: song.lyrics_text || "" }); }} className="text-[11px]" style={{ color: C.gold }}>Edit</button><button type="button" disabled={busy} onClick={() => archiveSong(song)} className="text-[11px]" style={{ color: C.red }}>Delete</button></div>{editingSong?.id === song.id && <form onSubmit={saveSong} className="mt-3 pt-3 border-t" style={{ borderColor: C.line }}><Field label="Title" value={editingSong.title} onChange={(event) => setEditingSong((current) => ({ ...current, title: event.target.value }))} /><Field label="Duration (seconds)" type="number" value={editingSong.duration_seconds} onChange={(event) => setEditingSong((current) => ({ ...current, duration_seconds: event.target.value }))} /><MediaUploadField label="Song cover" accept="image/png,image/jpeg,image/webp" value={songCoverFile} onChange={setSongCoverFile} hint="PNG, JPG, or WebP · max 5 MB" /><MediaUploadField label="Audio file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/x-m4a" value={songAudioFile} onChange={setSongAudioFile} hint="MP3, M4A, WAV, or OGG · max 50 MB" /><MediaUploadField label="Music video (optional)" accept="video/mp4,video/webm" value={songMusicVideoFile} onChange={setSongMusicVideoFile} hint="MP4 or WebM · max 50 MB" /><label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>Lyrics (optional)</label><textarea value={editingSong.lyrics_text || ""} onChange={(event) => setEditingSong((current) => ({ ...current, lyrics_text: event.target.value }))} rows={5} placeholder="Paste lyrics here" className="w-full rounded-xl px-4 py-3.5 text-[14px] outline-none resize-none mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="flex gap-2"><GoldButton disabled={busy}>{busy ? "Saving..." : "Save song"}</GoldButton>{song.status !== "PUBLISHED" && <button type="button" disabled={busy} onClick={() => publishSong(song)} className="px-3 rounded-xl text-[11px] font-semibold" style={{ background: C.green, color: C.goldSoft }}>Publish</button>}<button type="button" disabled={busy} onClick={() => archiveSong(song)} className="px-3 rounded-xl text-[11px] font-semibold" style={{ color: C.red, border: `1px solid ${C.red}66` }}>Delete</button></div></form>}</div>)}{!songs.length && <EmptyResourceCard label="No songs yet" description="Your music library will appear here when songs are provisioned." />}</>}
      {workspace && tab === "Albums" && <><div className="flex items-center justify-between mb-3"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Albums</p><button onClick={() => { setAlbumCoverFile(null); setEditingAlbum({ title: "", description: "", cover_url: "", release_date: "" }); }} className="text-[11px]" style={{ color: C.gold }}>New album</button></div>{editingAlbum && <form onSubmit={saveAlbum} className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><Field label="Album title" value={editingAlbum.title} onChange={(event) => setEditingAlbum((current) => ({ ...current, title: event.target.value }))} /><Field label="Description" value={editingAlbum.description || ""} onChange={(event) => setEditingAlbum((current) => ({ ...current, description: event.target.value }))} /><MediaUploadField label="Album artwork" accept="image/png,image/jpeg,image/webp" value={albumCoverFile} onChange={setAlbumCoverFile} hint="PNG, JPG, or WebP" /><GoldButton disabled={busy}>{busy ? "Saving..." : "Save album"}</GoldButton></form>}{albums.map((album) => <div key={album.id} className="rounded-2xl p-3 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl" style={imageStyle(album.cover_url, `linear-gradient(135deg, ${C.wood}, ${C.green})`)} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{album.title}</p><p className="text-[10px] uppercase" style={{ color: C.muted }}>{album.status || "DRAFT"}</p></div><button onClick={() => { setAlbumCoverFile(null); setEditingAlbum({ ...album }); }} className="text-[11px]" style={{ color: C.gold }}>Edit</button></div>{album.status !== "PUBLISHED" && <button disabled={busy} onClick={() => publishAlbum(album)} className="mt-3 px-3 py-2 rounded-xl text-[11px]" style={{ background: C.gold, color: C.bg }}>Publish</button>}</div>)}{!albums.length && !editingAlbum && <EmptyResourceCard label="No albums yet" description="Create an album to manage releases and artwork from the live Artist workspace." />}</>}
      {workspace && tab === "Music Videos" && <><div className="flex items-center justify-between mb-3"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Music videos</p><button onClick={() => { setVideoThumbnailFile(null); setVideoFile(null); setEditingMusicVideo({ title: "", description: "", thumbnail_url: "", video_url: "" }); }} className="text-[11px]" style={{ color: C.gold }}>New video</button></div>{editingMusicVideo && <form onSubmit={saveMusicVideo} className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><Field label="Video title" value={editingMusicVideo.title} onChange={(event) => setEditingMusicVideo((current) => ({ ...current, title: event.target.value }))} /><Field label="Description" value={editingMusicVideo.description || ""} onChange={(event) => setEditingMusicVideo((current) => ({ ...current, description: event.target.value }))} /><MediaUploadField label="Thumbnail" accept="image/png,image/jpeg,image/webp" value={videoThumbnailFile} onChange={setVideoThumbnailFile} hint="PNG, JPG, or WebP" /><MediaUploadField label="Video file" accept="video/mp4,video/webm" value={videoFile} onChange={setVideoFile} hint="MP4 or WebM" /><GoldButton disabled={busy}>{busy ? "Saving..." : "Save music video"}</GoldButton></form>}{musicVideos.map((video) => <div key={video.id} className="rounded-2xl p-3 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center gap-3"><div className="w-16 h-10 rounded-lg" style={imageStyle(video.thumbnail_url, `linear-gradient(135deg, ${C.wood}, ${C.green})`)} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{video.title}</p><p className="text-[10px] uppercase" style={{ color: C.muted }}>{video.status || "DRAFT"}</p></div><button onClick={() => { setVideoThumbnailFile(null); setVideoFile(null); setEditingMusicVideo({ ...video }); }} className="text-[11px]" style={{ color: C.gold }}>Edit</button></div>{video.status !== "PUBLISHED" && <button disabled={busy} onClick={() => publishMusicVideo(video)} className="mt-3 px-3 py-2 rounded-xl text-[11px]" style={{ background: C.gold, color: C.bg }}>Publish</button>}</div>)}{!musicVideos.length && !editingMusicVideo && <EmptyResourceCard label="No music videos yet" description="Create a music video to manage thumbnails, video media, and publishing state." />}</>}
      {workspace && tab === "Events" && <>{events.map((event) => <div key={event.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{event.title}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{event.starts_at ? new Date(event.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date pending"} · {event.city || "Location pending"}</p><p className="text-[11px] mt-2" style={{ color: C.muted }}>{event.venues?.name || "Venue pending"} · {event.status || "Status pending"}</p></div>)}{!events.length && <EmptyResourceCard label="No event participation yet" description="Events where you are listed will appear here." />}</>}
      {workspace && tab === "Bookings" && <>{bookings.map((booking) => <div key={booking.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-start justify-between gap-3"><div><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{booking.event_name}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{booking.event_type} · {booking.event_date}</p></div><span className="text-[10px] uppercase" style={{ color: C.goldSoft }}>{booking.status}</span></div><p className="text-[11px] mt-3" style={{ color: C.muted }}>{booking.message}</p><p className="text-[11px] mt-2" style={{ color: C.muted }}>Audience {booking.expected_audience || "—"} · Budget {booking.budget || "—"}</p>{["SUBMITTED", "REVIEWING", "NEGOTIATING"].includes(booking.status) && <div className="flex gap-2 mt-3"><button disabled={busy} onClick={() => updateBooking(booking.id, "ACCEPTED")} className="flex-1 py-2 rounded-xl text-[11px] font-semibold" style={{ background: C.gold, color: C.bg }}>Accept</button><button disabled={busy} onClick={() => updateBooking(booking.id, "REJECTED")} className="flex-1 py-2 rounded-xl text-[11px]" style={{ background: C.bg, color: "#E98979", border: `1px solid ${C.line}` }}>Decline</button><button disabled={busy} onClick={() => updateBooking(booking.id, "REVIEWING")} className="flex-1 py-2 rounded-xl text-[11px]" style={{ background: C.bg, color: C.goldSoft, border: `1px solid ${C.line}` }}>Review</button></div>}</div>)}{!bookings.length && <EmptyResourceCard label="No booking requests" description="Booking requests sent to your artist profile will appear here." />}</>}
    </div>
  </Phone>;
}

/* ============================== SUPER ADMIN ARTIST SETTINGS ============================== */
// Compatibility route: the existing entry point now renders the one canonical
// role-policy surface; all fee/question writes use live governance RPCs.
function ArtistAdminSettings({ nav }) {
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("" );
  const [message, setMessage] = useState("" );
  const refresh = async () => { setError(""); try { setSnapshot(await loadRoleGovernanceSnapshot()); } catch (loadError) { setError(loadError.message || "Unable to load role governance policies."); } };
  useEffect(() => { refresh(); }, []);
  const onAct = async (operation, successMessage) => { setBusy(true); setError(""); setMessage(""); try { await operation(); await refresh(); setMessage(successMessage); } catch (actionError) { setError(actionError.message || "Governance action failed."); } finally { setBusy(false); } };
  return <Phone><TopBack title="Role Policies" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pt-2 pb-8"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Canonical Super Admin controls</p><h1 className="ev-display text-[25px] mt-1" style={{ color: C.ivory }}>Role verification policies</h1><p className="text-[12px] leading-5 mt-2" style={{ color: C.muted }}>Artist, Organizer, and Venue Manager onboarding fees and questions are configured here. This is the only authoritative role-onboarding policy surface; legacy Artist pricing is retained only as a compatibility ledger.</p>{error && <AuthMessage error={error} />}{message && <p className="text-[11px] mt-3" style={{ color: C.green }}>{message}</p>}{!snapshot && !error ? <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Loading live role policies...</p> : <AdvancedGovernancePanels snapshot={snapshot} C={C} money={money} busy={busy} onAct={onAct} />}</div></Phone>;
}

/* ============================== ROLE CENTER ============================== */
function SystemHealthPanel() {
  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  const hasPaystack = Boolean(import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);
  const browserCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const browserLocation = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
  const checks = [
    ["Supabase", hasSupabase ? "Connected" : "Configuration needed", hasSupabase ? "green" : "red", hasSupabase ? "" : "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"],
    ["Google Auth", "Configured", "green", "Provider redirect and session routing are managed by Supabase Auth"],
    ["Spotify Auth", "Configured", "green", "Provider callback and session routing are managed by Supabase Auth"],
    ["Storage", hasSupabase ? "Configured" : "Configuration needed", hasSupabase ? "green" : "red", hasSupabase ? "Uploads use the authenticated atizzy-media bucket" : "Connect Supabase before testing uploads"],
    ["Push Notifications", "Configuration needed", "yellow", "Configure a push provider and device token delivery"],
    ["Notification permission", "User-dependent", "yellow", "Request permission contextually from a signed-in device"],
    ["Camera", browserCamera ? "Device-dependent" : "Unavailable in this browser", browserCamera ? "yellow" : "red", browserCamera ? "Permission is requested when scanning starts" : "Use a camera-capable browser or device"],
    ["Location", browserLocation ? "Device-dependent" : "Unavailable in this browser", browserLocation ? "yellow" : "red", browserLocation ? "Permission is requested when nearby events are used" : "Use a device/browser with geolocation support"],
    ["QR Scanner", "Implemented", "green", "Open Security / Check-in on a camera-capable device to validate tickets server-side"],
    ["Payments", hasPaystack ? "Configured" : "Provider pending", hasPaystack ? "green" : "yellow", hasPaystack ? "Paystack initialization and webhook verification are server-authoritative" : "Add Paystack public configuration; never enter credentials in the client"],
    ["Email", "Configuration needed", "yellow", "Configure the production email provider and template delivery"],
  ];
  const colors = { green: C.green, yellow: C.goldSoft, red: C.red };
  return <div className="rounded-2xl p-4 mt-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-start justify-between gap-3"><div><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>System Requirements / Health</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Control-plane readiness for integrations, permissions, and device-dependent workflows.</p></div><ShieldCheck size={18} color={C.gold} /></div><div className="mt-4 space-y-3">{checks.map(([name, status, tone, action]) => <div key={name} className="flex items-start justify-between gap-3 py-2" style={{ borderBottom: `1px solid ${C.line}` }}><div className="min-w-0"><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>{name}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{action || "No action required."}</p></div><span className="shrink-0 text-[10px] font-semibold" style={{ color: colors[tone] }}>● {status}</span></div>)}</div></div>;
}

function DynamicPolicyPanel({ account }) {
  const [policies, setPolicies] = useState([]); const [busyKey, setBusyKey] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const refresh = async () => { try { setError(""); setPolicies(await loadPolicySettings()); } catch (loadError) { setError(loadError.message || "Unable to load policy settings."); } };
  useEffect(() => { if (account?.effectiveRoles?.includes("SUPER_ADMIN") || account?.roles?.some((role) => (typeof role === "string" ? role : role.code) === "SUPER_ADMIN")) refresh(); }, [account]);
  const update = async (policy, nextValue) => { try { setBusyKey(policy.key); setError(""); setMessage(""); const updated = await updatePolicySetting(policy.key, nextValue); setPolicies((current) => current.map((item) => item.key === policy.key ? updated : item)); setMessage(`${policy.key.replaceAll("_", " ")} updated.`); } catch (updateError) { setError(updateError.message || "Unable to update policy."); } finally { setBusyKey(""); } };
  const displayValue = (policy) => { try { return JSON.parse(policy.value); } catch { return policy.value; } };
  return <div className="rounded-2xl p-4 mt-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-start justify-between gap-3"><div><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Dynamic business policies</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Only whitelisted policies can change. Every update is validated server-side and written to the audit log.</p></div><ShieldCheck size={18} color={C.gold} /></div>{error && <p className="text-[11px] mt-3" style={{ color: C.red }}>{error}</p>}{message && <p className="text-[11px] mt-3" style={{ color: C.green }}>{message}</p>}<div className="mt-4 space-y-3">{policies.map((policy) => { const value = displayValue(policy); return <div key={policy.key} className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>{policy.key.replaceAll("_", " ")}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{policy.description}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>Last changed {policy.updated_at ? new Date(policy.updated_at).toLocaleString() : "not recorded"}</p></div>{policy.value_type === "boolean" ? <button type="button" disabled={busyKey === policy.key} onClick={() => update(policy, !value)} className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold" style={{ background: value ? C.gold : C.line, color: value ? C.bg : C.muted }}>{busyKey === policy.key ? "…" : value ? "Enabled" : "Disabled"}</button> : policy.value_type === "enum" ? <select disabled={busyKey === policy.key} value={value} onChange={(event) => update(policy, event.target.value)} className="shrink-0 rounded-xl px-2 py-2 text-[10px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}>{(policy.allowed_values || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <span className="text-[10px]" style={{ color: C.goldSoft }}>{String(value)}</span>}</div></div>; })}{!policies.length && <p className="text-[11px]" style={{ color: C.muted }}>Loading protected policy settings…</p>}</div></div>;
}

function GovernanceDashboard({ nav, account, onAccountUpdated }) {
  const [snapshot, setSnapshot] = useState(null);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [question, setQuestion] = useState({ roleCode: "ORGANIZER", prompt: "", questionType: "SHORT_TEXT", required: true });
  const [fee, setFee] = useState(null);
  const [events, setEvents] = useState([]);
  const [roleHistory, setRoleHistory] = useState([]);
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleCode, setRoleCode] = useState("ARTIST");
  const [roleAction, setRoleAction] = useState("ASSIGN");
  const [roleReason, setRoleReason] = useState("");
  const refresh = async () => { setBusy(true); try { const [data, eventRows, historyRows] = await Promise.all([loadRoleGovernanceSnapshot(), loadGovernanceEvents(), loadRoleAssignmentHistory()]); setSnapshot(data); setEvents(eventRows); setRoleHistory(historyRows); setFee(data.fees?.[0] || null); } catch (error) { setNotice(error.message || "Unable to load governance data."); } finally { setBusy(false); } };
  useEffect(() => { refresh(); }, []);
  const act = async (fn, success) => { setBusy(true); setNotice(""); try { await fn(); setNotice(success); await refresh(); } catch (error) { setNotice(error.message || "Action failed."); } finally { setBusy(false); } };
  const applyRoleAction = (targetUserId, roleCode, action, reason) => act(async () => { await superAdminSetRole(targetUserId, roleCode, action, reason); await onAccountUpdated?.(); }, `Role action ${action.toLowerCase()} completed and audit logged.`);
  const submitDirectoryRoleAction = async () => { if (!roleTarget) return; await applyRoleAction(roleTarget.id, roleCode, roleAction, roleReason); setRoleTarget(null); setRoleReason(""); };
  const users = (snapshot?.users || []).filter((user) => roleFilter === "ALL" || (user.roles || []).includes(roleFilter));
  const applications = snapshot?.applications || [];
  const analytics = snapshot?.analytics || {};
  return <Phone><TopBack title="Super Admin Control Center" onBack={() => nav("roleCenter")} right={<ShieldCheck size={17} color={C.goldSoft} />} /><div className="flex-1 overflow-y-auto px-5 pb-10"><div className="mb-4 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.card})`, border: `1px solid ${C.gold}55` }}><p className="text-[11px] uppercase tracking-[.18em]" style={{ color: C.goldSoft }}>Universal authority</p><h1 className="ev-display text-2xl mt-1" style={{ color: C.ivory }}>Govern every workspace from one place</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>Every action remains server-authorized and audit logged.</p></div>{notice && <div className="mb-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: C.green, color: C.goldSoft }}>{notice}</div>}<div className="grid grid-cols-2 gap-2 mb-5">{[["Authenticated users", snapshot?.users?.length || 0],["Pending applications", applications.filter((a) => a.status === "PENDING").length],["Wallet credits", money(snapshot?.wallets?.reduce((sum, w) => sum + Number(w.balance || 0), 0))],["Engagement signals", Number(analytics.likes || 0) + Number(analytics.ratings || 0) + Number(analytics.comments || 0)]].map(([label, value]) => <div key={label} className="rounded-xl p-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[10px]" style={{ color: C.muted }}>{label}</p><p className="text-lg font-semibold mt-1" style={{ color: C.goldSoft }}>{value}</p></div>)}</div><SuperAdminModuleRegistry snapshot={snapshot} events={events} C={C} money={money} onSuspend={(userId, suspend) => act(() => adminSuspendUser(userId, suspend), suspend ? "User suspended." : "User restored.")} onReview={(applicationId, status, reason) => act(() => reviewRoleApplication(applicationId, status, reason), status === "APPROVED" ? "Application approved." : "Application rejected.")} onEventStatus={(eventId, status) => act(() => adminSetEventStatus(eventId, status, status === "CANCELLED" ? "Stopped by Super Admin" : "Activated by Super Admin"), status === "CANCELLED" ? "Event cancelled and eligible buyers credited." : "Event activated.")} onRoleAction={applyRoleAction} roleHistory={roleHistory} /> <AdvancedGovernancePanels snapshot={snapshot} C={C} money={money} busy={busy} onAct={act} /> <div className="flex gap-2 overflow-x-auto mb-4">{["ALL","ARTIST","ORGANIZER","VENUE_MANAGER","EVENT_STAFF","ADMIN"].map((role) => <Pill key={role} active={roleFilter === role} onClick={() => setRoleFilter(role)}>{role.replaceAll("_", " ")}</Pill>)}</div><section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: "1px solid " + C.line }}><div className="flex items-center justify-between mb-2"><h2 className="font-semibold" style={{ color: C.ivory }}>User directory</h2><span className="text-[11px]" style={{ color: C.muted }}>{users.length} users</span></div>{users.slice(0, 30).map((user) => <div key={user.id} className="py-3 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between gap-3"><div><p className="text-[12px]" style={{ color: C.ivory }}>{user.full_name || user.email || "Authenticated user"}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{(user.roles || []).join(" · ") || "ATTENDEE"}</p></div><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => act(() => adminSuspendUser(user.id, true), "User suspended.")} className="text-[10px]" style={{ color: C.red }}>Block</button><button type="button" onClick={() => act(() => adminSuspendUser(user.id, false), "User restored.")} className="text-[10px]" style={{ color: C.goldSoft }}>Restore</button><button type="button" onClick={() => { setRoleTarget(user); setRoleCode("ARTIST"); setRoleAction("ASSIGN"); setRoleReason(""); }} className="rounded-lg px-2 py-1 text-[10px] font-semibold" style={{ background: C.gold, color: C.bg }}>Manage roles</button></div></div>{roleTarget?.id === user.id && <div className="mt-2 rounded-xl p-3" style={{ background: C.card2, border: "1px solid " + C.line }}><p className="text-[10px] font-semibold" style={{ color: C.ivory }}>Manual assignment bypasses onboarding and payment</p><div className="grid grid-cols-2 gap-2 mt-2"><select value={roleCode} onChange={(event) => setRoleCode(event.target.value)} className="rounded-lg px-2 py-2 text-[10px]" style={{ background: C.card, color: C.ivory, border: "1px solid " + C.line }}>{["ARTIST", "ORGANIZER", "VENUE_MANAGER", "EVENT_STAFF", "ADMIN", "SUPER_ADMIN", "ATTENDEE"].map((code) => <option key={code} value={code}>{code}</option>)}</select><select value={roleAction} onChange={(event) => setRoleAction(event.target.value)} className="rounded-lg px-2 py-2 text-[10px]" style={{ background: C.card, color: C.ivory, border: "1px solid " + C.line }}>{["ASSIGN", "REMOVE", "REVOKE", "RESTORE", "SUSPEND", "REACTIVATE", "ACTIVATE", "DEACTIVATE", "VERIFY", "UNVERIFY", "STATUS_CHANGE"].map((action) => <option key={action} value={action}>{action}</option>)}</select></div><input value={roleReason} onChange={(event) => setRoleReason(event.target.value)} placeholder="Reason for audit log" className="w-full rounded-lg px-2 py-2 mt-2 text-[10px]" style={{ background: C.card, color: C.ivory, border: "1px solid " + C.line }} /><div className="flex gap-2 mt-2"><button type="button" onClick={submitDirectoryRoleAction} disabled={busy} className="rounded-lg px-3 py-2 text-[10px] font-semibold" style={{ background: C.gold, color: C.bg }}>Apply role</button><button type="button" onClick={() => setRoleTarget(null)} className="rounded-lg px-3 py-2 text-[10px]" style={{ color: C.muted, border: "1px solid " + C.line }}>Cancel</button></div></div>}</div>)}{!users.length && <EmptyResourceCard label="No users in this role" description="Role assignments will appear here when available." />}</section><section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-2"><h2 className="font-semibold" style={{ color: C.ivory }}>Verification & onboarding queue</h2><span className="text-[11px]" style={{ color: C.muted }}>{applications.length} applications</span></div>{applications.slice(0, 20).map((application) => <div key={application.id} className="py-3 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between"><div><p className="text-[12px]" style={{ color: C.ivory }}>{application.role_code} · {application.email || application.user_id}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{application.status} · submitted {application.created_at ? new Date(application.created_at).toLocaleDateString("en-NG") : "recently"}</p></div><div className="flex gap-2"><button type="button" onClick={() => act(() => reviewRoleApplication(application.id, "APPROVED"), "Application approved.")} className="text-[10px]" style={{ color: C.goldSoft }}>Approve</button><button type="button" onClick={() => act(() => reviewRoleApplication(application.id, "REJECTED", "Review required"), "Application rejected.")} className="text-[10px]" style={{ color: C.red }}>Reject</button></div></div></div>)}</section><section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Configurable verification policy</h2><div className="grid grid-cols-2 gap-2 mb-3"><select value={fee?.role_code || "ORGANIZER"} onChange={(event) => setFee((snapshot?.fees || []).find((item) => item.role_code === event.target.value) || { role_code: event.target.value, amount: 0, enabled: true, currency: "NGN", organizer_review_hours: 24 })} className="rounded-xl px-3 py-3 text-[12px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}>{["ARTIST","ORGANIZER","VENUE_MANAGER"].map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select><input value={fee?.amount || 0} onChange={(event) => setFee({ ...fee, amount: event.target.value })} type="number" min="0" className="rounded-xl px-3 py-3 text-[12px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} placeholder="Fee" /></div><GoldButton disabled={busy || !fee} onClick={() => act(() => setRoleFeePolicy(fee.role_code, fee.enabled !== false, fee.amount, fee.currency || "NGN", fee.organizer_review_hours || 24), "Fee policy saved.")}>Save fee policy</GoldButton><div className="mt-4"><textarea value={question.prompt} onChange={(event) => setQuestion({ ...question, prompt: event.target.value })} placeholder="Add a required onboarding question" rows={2} className="w-full rounded-xl px-3 py-3 text-[12px] resize-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="mt-2"><GoldButton disabled={busy || !question.prompt.trim()} onClick={() => act(() => saveOnboardingQuestion({ ...question, prompt: question.prompt.trim(), sortOrder: (snapshot?.questions || []).length + 1 }), "Onboarding question saved.")}>Add question for {question.roleCode}</GoldButton></div></div></section><section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-2"><h2 className="font-semibold" style={{ color: C.ivory }}>Event lifecycle controls</h2><span className="text-[11px]" style={{ color: C.muted }}>{events.length} visible events</span></div><p className="text-[11px] leading-5 mb-3" style={{ color: C.muted }}>Super Admin actions are executed through protected RPCs. Cancelling an event credits eligible ticket purchases to each buyer wallet exactly once and marks tickets refunded.</p>{events.slice(0, 30).map((event) => <div key={event.id} className="py-3 border-b" style={{ borderColor: C.line }}><div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>{event.title || "Untitled event"}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{event.city || "Location pending"} · {event.starts_at ? new Date(event.starts_at).toLocaleString("en-NG") : "Date pending"}</p></div><span className="text-[10px] uppercase" style={{ color: event.status === "CANCELLED" ? C.red : C.goldSoft }}>{event.status}</span></div><div className="grid grid-cols-3 gap-2 mt-3"><button type="button" disabled={busy || event.status === "CANCELLED"} onClick={() => act(() => adminSetEventStatus(event.id, "CANCELLED", "Stopped by Super Admin"), "Event cancelled and eligible buyers credited.")} className="rounded-xl py-2 text-[10px] font-semibold" style={{ background: C.red + "22", color: C.red, border: `1px solid ${C.red}44` }}>Stop / refund</button><button type="button" disabled={busy || event.status === "LIVE"} onClick={() => act(() => adminSetEventStatus(event.id, "LIVE", "Activated by Super Admin"), "Event activated.")} className="rounded-xl py-2 text-[10px] font-semibold" style={{ background: C.green, color: C.goldSoft }}>Activate</button><button type="button" disabled={busy || event.status !== "CANCELLED"} onClick={() => act(() => adminSetEventStatus(event.id, "DRAFT", "Restored by Super Admin"), "Event restored to draft.")} className="rounded-xl py-2 text-[10px] font-semibold" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}>Restore</button></div></div>)}{!events.length && <EmptyResourceCard label="No events available" description="Events will appear here when organizers create them." />}</section><section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Analytics & accounting</h2><div className="grid grid-cols-2 gap-3 text-[12px]" style={{ color: C.muted }}>{Object.entries(analytics).slice(0, 8).map(([key, value]) => <div key={key}><span className="capitalize">{key.replaceAll("_", " ")}</span><strong className="block text-lg" style={{ color: C.goldSoft }}>{value}</strong></div>)}</div><p className="text-[11px] mt-3" style={{ color: C.muted }}>Wallet credits, ticket lifecycle totals, likes, ratings, and comments are sourced from live governance RPCs.</p></section></div></Phone>;
}

function AdminControlCenter({ nav, account }) {
  const [open, setOpen] = useState("SYSTEM");
  const [previewRole, setPreviewRole] = useState("");
  const groups = [
    { name: "SYSTEM", items: [["Overview", "adminWorkspace"], ["Role capability matrix", "roleCapabilities"], ["System health", "adminWorkspace"], ["Audit logs", "adminWorkspace"]] },
    { name: "USERS & AUTHORITY", items: [["All users", "adminWorkspace"], ["Roles and permissions", "roleCapabilities"], ["Admin authority", "roleCapabilities"], ["Security", "security"]] },
    { name: "ARTISTS & MUSIC", items: [["Artists", "artistWorkspace"], ["Artist verification", "artistVerification"], ["Music workspace", "artistLibrary"], ["Posts and content", "userExperience"]] },
    { name: "ORGANIZERS & EVENTS", items: [["Organizers", "organizerEvents"], ["Events", "organizerEvents"], ["Tickets and private access", "organizerEvents"], ["Event staff", "eventStaff"]] },
    { name: "VENUES & TICKETS", items: [["Venues", "venueManager"], ["Bookings", "venueManager"], ["Orders and payments", "adminWorkspace"], ["Check-in and QR scanner", "checkIn"]] },
    { name: "USER EXPERIENCE", items: [["Notifications", "notifications"], ["Preferences", "userExperience"], ["Support requests", "userExperience"], ["Profile security", "security"]] },
  ];
  const previewOptions = ["ATTENDEE", "ARTIST", "ORGANIZER", "VENUE_MANAGER", "EVENT_STAFF", "ADMIN"];
  const liveModules = [
    ["Users", "All authenticated users and account actions", "adminWorkspace"],
    ["Artists", "Artist directory and workspace records", "artistWorkspace"],
    ["Organizers", "Organizer applications and owned events", "organizerEvents"],
    ["Venue Managers", "Venue ownership and bookings", "venueManager"],
    ["Event Staff", "Assignment-scoped operations and check-in", "eventStaff"],
    ["Admins", "Delegated admin authority and capability grants", "roleCapabilities"],
    ["Applications", "Role onboarding and verification queue", "governanceDashboard"],
    ["Verification", "Configurable questions, fees, and approvals", "governanceDashboard"],
    ["Events", "Lifecycle controls, cancellation, and restore", "governanceDashboard"],
    ["Tickets", "Ticket lifecycle and private access", "adminWorkspace"],
    ["Payments", "Payment support and transaction review", "adminWorkspace"],
    ["Wallets", "Refund credits and accounting visibility", "governanceDashboard"],
    ["Analytics", "Engagement, commerce, and role analytics", "governanceDashboard"],
    ["Moderation", "Block, suspend, stop, delete, and restore", "governanceDashboard"],
    ["Support", "User support requests and operational follow-up", "userExperience"],
    ["Settings", "System health, fees, policy, and security", "adminWorkspace"],
    ["Audit Logs", "Server-authoritative administrative history", "adminWorkspace"],
  ];
  if (!hasEffectiveRole(account, "SUPER_ADMIN")) return <Phone><TopBack title="Admin Controls" onBack={nav.pop} /><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Super Admin access is required.</div></Phone>;
  return <Phone><TopBack title="Admin Controls" onBack={nav.pop} right={<Menu size={17} color={C.gold} />} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="pt-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Super Admin control center</p><h1 className="ev-display mt-1 text-[25px]" style={{ color: C.ivory }}>Operate Atizzy from one place</h1><p className="mt-2 text-[12px] leading-5" style={{ color: C.muted }}>Every destination below opens an existing live workflow. Your authenticated identity remains Super Admin.</p><div className="mt-5 rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between gap-3"><div><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>View workspace as</p><p className="mt-1 text-[11px]" style={{ color: C.muted }}>Preview role navigation without changing authorization.</p></div><ShieldCheck size={18} color={C.gold} /></div><div className="mt-3 flex gap-2"><select value={previewRole} onChange={(event) => setPreviewRole(event.target.value)} className="min-w-0 flex-1 rounded-xl px-3 py-2 text-[12px]" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }}><option value="">Choose a role</option>{previewOptions.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select><GhostButton full={false} disabled={!previewRole} onClick={() => nav.push("roleCenter", { previewRole })}>Preview</GhostButton></div>{previewRole && <p className="mt-3 rounded-xl p-3 text-[11px]" style={{ color: C.goldSoft, background: `${C.gold}12` }}>SUPER ADMIN PREVIEW · Viewing as: {previewRole.replaceAll("_", " ")}. Backend identity and permissions are unchanged.</p>}</div><section className="mt-5 rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between gap-3 mb-3"><div><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Control modules</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Every required Super Admin surface is visible below and opens a live authorized workflow.</p></div><ShieldCheck size={17} color={C.gold} /></div><div className="grid grid-cols-2 gap-2">{liveModules.map(([label, description, screen]) => <button type="button" key={label} onClick={() => nav.push(screen, { adminModule: label })} className="rounded-xl p-3 text-left" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><span className="block text-[12px] font-semibold">{label}</span><span className="block mt-1 text-[10px] leading-4" style={{ color: C.muted }}>{description}</span><span className="block mt-2 text-[10px] font-semibold" style={{ color: C.goldSoft }}>Open live workflow →</span></button>)}</div></section><div className="mt-5 space-y-3">{groups.map((group) => <div key={group.name} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><button type="button" onClick={() => setOpen(open === group.name ? "" : group.name)} className="flex w-full items-center justify-between"><span className="text-[12px] font-semibold tracking-[0.12em]" style={{ color: C.goldSoft }}>{group.name}</span><ChevronDown size={16} color={C.muted} style={{ transform: open === group.name ? "rotate(180deg)" : "none" }} /></button>{open === group.name && <div className="mt-3 grid grid-cols-1 gap-2">{group.items.map(([label, screen]) => <button type="button" key={label} onClick={() => nav.push(screen)} className="flex items-center justify-between rounded-xl px-3 py-3 text-left" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><span className="text-[12px]">{label}</span><ChevronRight size={15} color={C.gold} /></button>)}</div>}</div>)}</div></div></Phone>;
}
function AdminWorkspace({ nav, account }) {
  const [dashboard, setDashboard] = useState(null); const [users, setUsers] = useState([]); const [payments, setPayments] = useState(null); const [audit, setAudit] = useState([]); const [search, setSearch] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const refresh = async (term = search) => { setBusy(true); setError(""); try { const [snapshot, userRows, paymentRows, auditRows] = await Promise.all([loadAdminDashboardSnapshot(), adminListUsers(term), loadAdminPaymentSupport(), loadAdminAuditLogs()]); setDashboard(snapshot); setUsers(userRows); setPayments(paymentRows); setAudit(auditRows); } catch (loadError) { setError(loadError.message || "Unable to load Admin operations."); } finally { setBusy(false); } };
  useEffect(() => { if (hasEffectiveRole(account, "ADMIN")) refresh(""); }, [account?.effectiveRoles, account?.roles]);
  const suspend = async (user) => { setBusy(true); setError(""); try { await adminSuspendUser(user.user_id, true, "Admin operations review"); await refresh(); } catch (actionError) { setError(actionError.message || "Unable to suspend user."); } finally { setBusy(false); } };
  if (!hasEffectiveRole(account, "ADMIN")) return <Phone><TopBack title="Admin Operations" onBack={nav.pop} /><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Admin access is required. Super Admin platform settings remain separate.</div></Phone>;
  return <Phone><TopBack title="Admin Operations" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="text-[11px] uppercase tracking-[0.16em] pt-2" style={{ color: C.gold }}>Operations control</p><h1 className="ev-display text-[28px] mt-1" style={{ color: C.ivory }}>Keep Atizzy safe and moving</h1><p className="text-[13px] leading-6 mt-2" style={{ color: C.muted }}>Admin handles moderation, support, and operational oversight. Super Admin platform pricing and configuration stay protected.</p><SystemHealthPanel />{hasEffectiveRole(account, "SUPER_ADMIN") && <DynamicPolicyPanel account={account} />}{error && <AuthMessage error={error} />}{dashboard && <div className="grid grid-cols-2 gap-2 mt-5">{[["Users",dashboard.users],["Pending review",dashboard.events_pending_review],["Open reports",dashboard.open_reports],["Checked in",dashboard.checked_in],["Ticket revenue",`₦${Number(dashboard.ticket_revenue || 0).toLocaleString()}`],["Venue revenue",`₦${Number(dashboard.venue_revenue || 0).toLocaleString()}`]].map(([label,value]) => <div key={label} className="rounded-2xl p-3" style={{ background:C.card,border:`1px solid ${C.line}` }}><p className="text-[20px] font-semibold" style={{color:C.goldSoft}}>{value}</p><p className="text-[10px] mt-1" style={{color:C.muted}}>{label}</p></div>)}</div>}<div className="rounded-2xl p-4 mt-5" style={{background:C.card,border:`1px solid ${C.line}`}}><p className="text-[14px] font-semibold mb-3" style={{color:C.ivory}}>User management</p><div className="flex gap-2"><input value={search} onChange={(event)=>setSearch(event.target.value)} onKeyDown={(event)=>event.key === "Enter" && refresh()} placeholder="Search name or email" className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none" style={{background:C.card2,color:C.ivory,border:`1px solid ${C.line}`}} /><button onClick={()=>refresh()} className="rounded-xl px-3 text-[11px]" style={{background:C.gold,color:C.bg}}>{busy ? "…" : "Search"}</button></div><div className="mt-3 space-y-2">{users.slice(0,8).map((user)=><div key={user.user_id} className="flex items-center justify-between gap-3 py-2" style={{borderBottom:`1px solid ${C.line}`}}><div><p className="text-[12px]" style={{color:C.ivory}}>{user.full_name || user.email || "Unnamed user"}</p><p className="text-[10px]" style={{color:C.muted}}>{user.roles?.join(", ") || "ATTENDEE"}</p></div><button disabled={busy} onClick={()=>suspend(user)} className="text-[10px] px-2 py-1 rounded-lg" style={{background:C.red,color:C.bg}}>Suspend</button></div>)}{!users.length && <p className="text-[12px]" style={{color:C.muted}}>No users match this search.</p>}</div></div><div className="rounded-2xl p-4 mt-4" style={{background:C.card,border:`1px solid ${C.line}`}}><p className="text-[14px] font-semibold" style={{color:C.ivory}}>Payment support</p><p className="text-[11px] mt-2" style={{color:C.muted}}>{payments?.ticket_payments?.length || 0} recent ticket payments · {payments?.venue_payments?.length || 0} recent venue payments</p><p className="text-[11px] mt-2" style={{color:C.muted}}>Admins can inspect operational payment state; refunds and platform configuration remain server-restricted workflows.</p></div><div className="rounded-2xl p-4 mt-4" style={{background:C.card,border:`1px solid ${C.line}`}}><div className="flex items-center justify-between gap-3"><p className="text-[14px] font-semibold" style={{color:C.ivory}}>Audit & moderation oversight</p><button type="button" onClick={() => nav.push("roleCapabilities")} className="text-[11px] font-semibold" style={{color:C.goldSoft}}>Role capability matrix</button>{hasEffectiveRole(account, "SUPER_ADMIN") && <button type="button" onClick={() => nav.push("governanceDashboard")} className="text-[11px] font-semibold ml-3" style={{color:C.goldSoft}}>Governance dashboard</button>}</div><p className="text-[11px] mt-2" style={{color:C.muted}}>{audit.length} recent privileged actions are available to this Admin account.</p><p className="text-[11px] mt-2" style={{color:C.muted}}>Event review, reports, and resolutions are recorded through protected RPCs and immutable audit entries.</p></div></div></Phone>;
}

function RoleCapabilities({ nav, account }) {
  const [matrix, setMatrix] = useState([]); const [admins, setAdmins] = useState([]); const [grants, setGrants] = useState([]); const [selectedAdmin, setSelectedAdmin] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const superAdmin = hasEffectiveRole(account, "SUPER_ADMIN");
  useEffect(() => { loadRoleCapabilityMatrix().then(setMatrix).catch((loadError) => setError(loadError.message || "Unable to load role capabilities.")); if (superAdmin) adminListUsers().then((rows) => { const adminRows = (rows || []).filter((row) => (row.roles || []).includes("ADMIN")); setAdmins(adminRows); setSelectedAdmin(adminRows[0]?.user_id || ""); }).catch((loadError) => setError(loadError.message || "Unable to load Admin accounts.")); }, [superAdmin]);
  useEffect(() => { if (superAdmin && selectedAdmin) loadAdminPermissionGrants(selectedAdmin).then(setGrants).catch((loadError) => setError(loadError.message || "Unable to load Admin permissions.")); }, [superAdmin, selectedAdmin]);
  const permissions = [...new Set(matrix.flatMap((role) => role.permissions || []))].sort();
  const active = new Set((grants || []).filter((grant) => !grant.revoked_at && (!grant.expires_at || new Date(grant.expires_at) > new Date())).map((grant) => grant.permission_code));
  const toggle = async (code) => { setBusy(true); setError(""); try { await setAdminPermission(selectedAdmin, code, !active.has(code)); setGrants(await loadAdminPermissionGrants(selectedAdmin)); } catch (toggleError) { setError(toggleError.message || "Unable to update Admin permission."); } finally { setBusy(false); } };
  return <Phone><TopBack title="Role capabilities" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="text-[12px] uppercase tracking-[0.16em] pt-2" style={{ color: C.gold }}>Security model</p><h1 className="ev-display text-[26px] mt-1" style={{ color: C.ivory }}>Who can do what</h1><p className="text-[12px] leading-5 mt-2" style={{ color: C.muted }}>Every role is shown from the live permission catalog. Ownership, assignment scope, RLS, and server RPC checks remain authoritative.</p>{error && <AuthMessage error={error} />}<div className="mt-5">{matrix.map((role) => <div key={role.role} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{String(role.label || role.role)}</p><ShieldCheck size={16} color={C.gold} /></div><div className="flex flex-wrap gap-2 mt-3">{(role.permissions || []).length ? role.permissions.map((permission) => <span key={permission} className="rounded-full px-2.5 py-1 text-[10px]" style={{ background: C.green, color: C.goldSoft }}>{permission}</span>) : <span className="text-[11px]" style={{ color: C.muted }}>No baseline permission rows; workflow-specific RPC authorization still applies.</span>}</div></div>)}</div>{superAdmin && <div className="rounded-2xl p-4 mt-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Delegate Admin permissions</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Only Super Admin can grant or revoke Admin capabilities. Empty grants mean an Admin has no delegated administrative authority.</p><select value={selectedAdmin} onChange={(event) => setSelectedAdmin(event.target.value)} className="w-full rounded-xl px-3 py-3 mt-4" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="">Select Admin</option>{admins.map((admin) => <option key={admin.user_id} value={admin.user_id}>{admin.full_name || admin.email || admin.user_id}</option>)}</select><div className="mt-4">{permissions.map((permission) => <label key={permission} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[12px]" style={{ color: C.ivory }}>{permission}</span><input type="checkbox" checked={active.has(permission)} disabled={busy || !selectedAdmin} onChange={() => toggle(permission)} /></label>)}</div></div>}</div></Phone>;
}
function RoleCenter({ nav, account, data }) {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (account?.user?.id) loadRoleDashboard(account.user.id, effectiveRoleCodes(account)).then(setDashboard).catch((loadError) => setError(loadError.message || "Unable to load your workspace.")); }, [account?.user?.id, account?.effectiveRoles, account?.roles]);
  useEffect(() => { if (hasEffectiveRole(account, "SUPER_ADMIN")) loadSuperAdminAnalytics().then(setAnalytics).catch((loadError) => setError(loadError.message || "Unable to load Super Admin analytics.")); }, [account?.effectiveRoles, account?.roles]);
  const roles = effectiveRoleCodes(account);
  if (!roles.length) return <Phone><TopBack title="Workspace" onBack={nav.pop} /><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>No operational role is assigned to this account.</div></Phone>;
  const metrics = [{ label: "Events", value: dashboard?.events?.length || 0, visible: roles.some((role) => ["ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(role)) }, { label: "Bookings", value: dashboard?.bookings?.length || 0, visible: roles.some((role) => ["ARTIST", "ADMIN", "SUPER_ADMIN"].includes(role)) }, { label: "Venues", value: dashboard?.venues?.length || 0, visible: roles.some((role) => ["VENUE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) }, { label: "Songs", value: dashboard?.songs?.length || 0, visible: roles.some((role) => ["ARTIST", "ADMIN", "SUPER_ADMIN"].includes(role)) }].filter((metric) => metric.visible);
  return <Phone><TopBack title="Workspace" onBack={nav.pop} /><div className="px-5 pt-2 pb-3"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Protected workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>Your Atizzy operations</h1>{data?.previewRole && <div className="mt-3 rounded-xl p-3" style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}44` }}><p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: C.gold }}>Preview mode</p><p className="mt-1 text-[12px]" style={{ color: C.goldSoft }}>Viewing the {String(data.previewRole).replaceAll("_", " ")} workspace. Backend authorization remains Super Admin.</p></div>}<p className="text-[12px] mt-2" style={{ color: C.muted }}>{roles.map((role) => role.replaceAll("_", " ")).join(" · ")}</p></div><div className="flex-1 overflow-y-auto px-5">{error && <AuthMessage error={error} />}{!dashboard && !error && <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Loading workspace data...</p>}<div className="grid grid-cols-2 gap-3 mb-5">{metrics.map((metric) => <div key={metric.label} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[24px] font-semibold" style={{ color: C.goldSoft }}>{metric.value}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{metric.label} visible to you</p></div>)}</div>{roles.includes("SUPER_ADMIN") && analytics && <div className="rounded-2xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-3"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Live platform analytics</p><span className="text-[10px]" style={{ color: C.muted }}>{analytics.currency || "NGN"}</span></div><div className="grid grid-cols-2 gap-3"><div><p className="text-[18px] font-semibold" style={{ color: C.goldSoft }}>{money(Number(analytics.ticket_revenue || 0) + Number(analytics.venue_revenue || 0))}</p><p className="text-[10px]" style={{ color: C.muted }}>Verified revenue</p></div><div><p className="text-[18px] font-semibold" style={{ color: C.goldSoft }}>{analytics.tickets_issued || 0}</p><p className="text-[10px]" style={{ color: C.muted }}>Tickets issued</p></div><div><p className="text-[18px] font-semibold" style={{ color: C.goldSoft }}>{analytics.tickets_checked_in || 0}</p><p className="text-[10px]" style={{ color: C.muted }}>Checked in</p></div><div><p className="text-[18px] font-semibold" style={{ color: C.goldSoft }}>{analytics.events_published || 0}</p><p className="text-[10px]" style={{ color: C.muted }}>Published events</p></div></div></div>}<div className="rounded-2xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between gap-3 mb-3"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Role capabilities</p><button type="button" onClick={() => nav.push("roleCapabilities")} className="text-[11px] font-semibold" style={{ color: C.goldSoft }}>View full matrix</button></div>{roles.map((role) => <div key={role} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[12px]" style={{ color: C.ivory }}>{role.replaceAll("_", " ")}</span><ShieldCheck size={15} color={C.gold} /></div>)}</div><div className="rounded-2xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold mb-1" style={{ color: C.ivory }}>Workspace navigation</p><p className="text-[11px] mb-3" style={{ color: C.muted }}>Choose a workspace to view. Your primary account role and backend authorization never change.</p>{roles.includes("SUPER_ADMIN") && <div className="mb-2"><GoldButton onClick={() => nav.push(hasEffectiveRole(account, "SUPER_ADMIN") ? "adminControlCenter" : "adminWorkspace")}>Super Admin / Admin Operations</GoldButton></div>}{roles.includes("ARTIST") && <div className="mb-2"><GhostButton onClick={() => nav.push("artistWorkspace")}>Artist Workspace</GhostButton></div>}{roles.includes("ORGANIZER") && <div className="mb-2"><GhostButton onClick={() => nav.push("organizerEvents")}>Organizer Workspace</GhostButton></div>}{roles.includes("VENUE_MANAGER") && <div className="mb-2"><GhostButton onClick={() => nav.push("venueManager")}>Venue Workspace</GhostButton></div>}{roles.includes("EVENT_STAFF") && <div className="mb-2"><GhostButton onClick={() => nav.push("eventStaff")}>Event Staff Workspace</GhostButton></div>}<GhostButton onClick={() => nav.push("userExperience")}>User Experience</GhostButton></div>{roles.includes("ADMIN") && <><GoldButton onClick={() => nav.push("adminWorkspace")}>Open Admin Operations</GoldButton><div className="mt-3"><GhostButton onClick={() => nav.push("checkIn")}>Check in a ticket</GhostButton></div></>}{roles.includes("SUPER_ADMIN") && <><GoldButton onClick={() => nav.push("artistAdminSettings")}>Manage artist pricing</GoldButton><div className="mt-3"><GhostButton onClick={() => nav.push("organizerEvents")}>Manage my events</GhostButton></div></>}{roles.includes("ORGANIZER") && !roles.includes("SUPER_ADMIN") && <GoldButton onClick={() => nav.push("organizerEvents")}>Manage my events</GoldButton>}{!roles.some((role) => ["ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(role)) && <div className="mt-3"><GhostButton onClick={() => nav.push("organizerOnboarding")}>Become an Organizer</GhostButton></div>}{roles.includes("ARTIST") && <><div className="mt-3"><GoldButton onClick={() => nav.push("artistWorkspace")}>Open Artist Workspace</GoldButton></div><div className="mt-3"><GhostButton onClick={() => nav.push("artistVerification")}>Get Verified</GhostButton></div><div className="mt-3"><GhostButton onClick={() => nav.push("artistLibrary")}>Manage music library</GhostButton></div></>}{roles.includes("VENUE_MANAGER") && <div className="mt-3"><GhostButton onClick={() => nav.push("venueManager")}>Manage venues</GhostButton></div>}{roles.some((role) => ["EVENT_STAFF", "VENUE_MANAGER", "ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(role)) && <div className="mt-3"><GhostButton onClick={() => nav.push("checkIn")}>Check in a ticket</GhostButton></div>}</div></Phone>;
}

function RoleOnboarding({ nav, account, roleCode, title, eyebrow, heading, description, workspaceRoute }) {
  const [questions, setQuestions] = useState([]); const [answers, setAnswers] = useState({}); const [application, setApplication] = useState(null); const [fee, setFee] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { let mounted = true; Promise.all([loadPublicRoleOnboardingConfig(roleCode), loadRoleApplication(account?.user?.id, roleCode)]).then(([config, existing]) => { if (!mounted) return; setQuestions(config?.questions || []); setFee(config?.fee || null); setApplication(existing); if (existing?.answers) setAnswers(existing.answers); }).catch((loadError) => mounted && setError(loadError.message || "Unable to load live onboarding configuration.")).finally(() => mounted && setLoading(false)); return () => { mounted = false; }; }, [roleCode, account?.user?.id]);
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(""); setMessage(""); try { const required = questions.filter((item) => item.required); const missing = required.find((item) => !String(answers[item.id] ?? "").trim()); if (missing) throw new Error(`Complete required question: ${missing.prompt}`); const next = await submitRoleApplication(roleCode, answers); setApplication(next); setMessage("Questionnaire submitted. Your application is now PENDING_REVIEW. The verification fee will remain hidden until a Super Admin approves it."); } catch (submitError) { setError(submitError.message || "Unable to submit role application."); } finally { setBusy(false); } };
  const startPayment = async () => { setBusy(true); setError(""); try { const result = await initializeRoleApplicationPayment(application.id, `role-${application.id}`, account.user.email, `${window.location.origin}/?role-payment=callback`); if (!result.authorizationUrl) throw new Error("Paystack authorization was not returned."); window.location.assign(result.authorizationUrl); } catch (paymentError) { setError(paymentError.message || "Unable to initialize verification payment."); } finally { setBusy(false); } };
  const approved = application?.status === "APPROVED" || application?.status === "PENDING_PAYMENT"; const active = application?.status === "ACTIVE";
  return <Phone><TopBack title={title} onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pt-2 pb-8"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>{eyebrow}</p><h1 className="ev-display text-[25px] mt-1" style={{ color: C.ivory }}>{heading}</h1><p className="text-[12px] leading-5 mt-2" style={{ color: C.muted }}>{description}</p>{error && <AuthMessage error={error} />}{message && <p className="text-[11px] mt-3" style={{ color: C.green }}>{message}</p>}{loading ? <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Loading live questions and verification policy...</p> : active ? <div className="rounded-2xl p-4 mt-5" style={{ background: C.green, border: `1px solid ${C.gold}55` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{roleCode.replaceAll("_", " ")} access is active</p><p className="text-[11px] mt-2" style={{ color: C.muted }}>The role was activated by the server after approved review and verified payment.</p><GoldButton onClick={() => nav.push(workspaceRoute)} style={{ marginTop: 16 }}>Open workspace</GoldButton></div> : <div className="rounded-2xl p-4 mt-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[13px] font-semibold mb-3" style={{ color: C.ivory }}>Step 1 · Live onboarding questionnaire</p>{application && !approved && <div className="rounded-xl p-3 mb-4" style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}55` }}><p className="text-[12px] font-semibold" style={{ color: C.goldSoft }}>Application status: {application.status.replaceAll("_", " ")}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{application.status === "PENDING_REVIEW" ? "A Super Admin must review your answers before any fee is shown." : application.rejection_reason || "Update the required answers and resubmit."}</p></div>}{approved && <div className="rounded-xl p-3 mb-4" style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}55` }}><p className="text-[12px] font-semibold" style={{ color: C.goldSoft }}>Step 2 · Verification fee unlocked after approval</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{application.fee_currency || fee?.currency || "NGN"} {Number(application.fee_amount ?? fee?.amount ?? 0).toLocaleString()} · configured by Super Admin.</p><GoldButton disabled={busy} onClick={startPayment} style={{ marginTop: 12 }}>{busy ? "Opening payment..." : "Pay verification fee"}</GoldButton></div>}{!questions.length && <EmptyResourceCard label="Onboarding is not configured" description="A Super Admin must publish questions before this role can be requested." />}{!approved && questions.map((question) => <div key={question.id} className="mb-4"><label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>{question.prompt}{question.required ? " *" : ""}</label>{question.question_type === "LONG_TEXT" ? <textarea required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} rows={4} className="w-full rounded-xl px-4 py-3.5 text-[14px] outline-none resize-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /> : question.question_type === "SINGLE_SELECT" ? <select required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="w-full rounded-xl px-4 py-3.5 text-[14px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="">Select an answer</option>{(question.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="w-full rounded-xl px-4 py-3.5 text-[14px] outline-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} />}</div>)}{!approved && <GoldButton disabled={busy || !questions.length} onClick={submit}>{busy ? "Submitting..." : application?.status === "PENDING_REVIEW" ? "Resubmit updated answers" : "Submit application for review"}</GoldButton>}</div>}</div></Phone>;
}
function OrganizerOnboarding({ nav, account }) { return <RoleOnboarding nav={nav} account={account} roleCode="ORGANIZER" title="Become an Organizer" eyebrow="Organizer onboarding" heading="Build your next event" description="Complete the live questionnaire first. Your configured fee appears only after the questionnaire is accepted, followed by server-side review and activation." workspaceRoute="organizerEvents" />; }

function OrganizerEvents({ nav, account }) {
  const [events, setEvents] = useState([]); const [selected, setSelected] = useState(null); const [dashboard, setDashboard] = useState(null); const [mode, setMode] = useState("list"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [availableVenues, setAvailableVenues] = useState([]); const [venueLoading, setVenueLoading] = useState(false);
  const blank = { title: "", description: "", event_type: "", city: "", starts_at: "", ends_at: "", cover_url: "", venue_id: "", expected_attendance: "", additional_requirements: "" }; const [form, setForm] = useState(blank); const [coverFile, setCoverFile] = useState(null); const [ticket, setTicket] = useState({ name: "", price: "", capacity: "", sales_start: "", sales_end: "", maximum_per_customer: "4", visibility: "PUBLIC", access_method: "CODE", code: "", word: "", access_credential_hint: "", maximum_redemptions: "", maximum_purchases_per_user: "" }); const [artistId, setArtistId] = useState(""); const [artistQuery, setArtistQuery] = useState(""); const [artistMatches, setArtistMatches] = useState([]); const [staff, setStaff] = useState([]); const [staffQuery, setStaffQuery] = useState(""); const [staffMatches, setStaffMatches] = useState([]); const [staffResponsibility, setStaffResponsibility] = useState("GENERAL"); const [staffInstructions, setStaffInstructions] = useState(""); const [staffShiftStartsAt, setStaffShiftStartsAt] = useState(""); const [staffShiftEndsAt, setStaffShiftEndsAt] = useState(""); const [staffShiftNote, setStaffShiftNote] = useState("");
  const refresh = async () => { try { setError(""); const next = await loadOrganizerEvents(account.user.id); setEvents(next); if (selected) setSelected(next.find((item) => item.id === selected.id) || null); } catch (loadError) { setError(loadError.message || "Unable to load Organizer events."); } };
  useEffect(() => { if (account?.user?.id) refresh(); }, [account?.user?.id]);
  useEffect(() => { let mounted = true; if (!form.starts_at || !form.ends_at || new Date(form.ends_at) <= new Date(form.starts_at)) { setAvailableVenues([]); return undefined; } setVenueLoading(true); loadAvailableVenues(form.starts_at, form.ends_at).then((venues) => { if (mounted) setAvailableVenues(venues); }).catch(() => { if (mounted) setAvailableVenues([]); }).finally(() => mounted && setVenueLoading(false)); return () => { mounted = false; }; }, [form.starts_at, form.ends_at]);
  useEffect(() => { let mounted = true; if (artistQuery.trim().length < 2) { setArtistMatches([]); return undefined; } const timer = setTimeout(() => { searchOrganizerArtists(artistQuery).then((artists) => mounted && setArtistMatches(artists)).catch(() => mounted && setArtistMatches([])); }, 250); return () => { mounted = false; clearTimeout(timer); }; }, [artistQuery]);
  useEffect(() => { let mounted = true; if (staffQuery.trim().length < 2) { setStaffMatches([]); return undefined; } const timer = setTimeout(() => { searchEventStaffUsers(staffQuery).then((users) => mounted && setStaffMatches(users)).catch(() => mounted && setStaffMatches([])); }, 250); return () => { mounted = false; clearTimeout(timer); }; }, [staffQuery]);
  const choose = async (event) => { setSelected(event); setForm({ title: event.title || "", description: event.description || "", event_type: event.event_type || "", city: event.city || "", starts_at: event.starts_at ? event.starts_at.slice(0, 16) : "", ends_at: event.ends_at ? event.ends_at.slice(0, 16) : "", cover_url: event.cover_url || "", venue_id: event.venue_id || "", expected_attendance: "", additional_requirements: "" }); setMode("detail"); try { const [nextDashboard, nextStaff] = await Promise.all([loadOrganizerEventDashboard(event.id), loadEventStaffForOrganizer(event.id)]); setDashboard(nextDashboard); setStaff(nextStaff); } catch (loadError) { setError(loadError.message || "Unable to load event analytics."); } };
  const saveEvent = async (event) => { event.preventDefault(); setBusy(true); setError(""); try { const cover = coverFile ? await uploadMediaFile(account.user.id, coverFile, "EVENT_POSTER", "events", selected?.id || null) : null; const payload = { ...form, cover_url: cover?.public_url || form.cover_url }; const next = selected ? await updateOrganizerEvent(selected.id, account.user.id, payload) : await createOrganizerEvent(account.user.id, payload); if (!selected && form.venue_id) { if (!form.ends_at || !form.expected_attendance) throw new Error("Add an end time and expected attendance before requesting a venue."); await requestVenueBooking(account.user.id, { venue_id: form.venue_id, event_id: next.id, event_name: next.title, starts_at: form.starts_at, ends_at: form.ends_at, expected_attendance: form.expected_attendance, additional_requirements: form.additional_requirements }); } setMessage(selected ? "Event draft saved." : form.venue_id ? "Draft created; venue request is pending manager approval." : "Draft event created."); await refresh(); setSelected(next); setMode("detail"); } catch (saveError) { setError(saveError.message || "Unable to save event or request venue."); } finally { setBusy(false); } };
  const addTicket = async (event) => { event.preventDefault(); if (!selected) return; setBusy(true); setError(""); try { await addOrganizerTicketType(selected.id, account.user.id, ticket); setTicket({ name: "", price: "", capacity: "", sales_start: "", sales_end: "", maximum_per_customer: "4", visibility: "PUBLIC", access_method: "CODE", code: "", word: "", access_credential_hint: "", maximum_redemptions: "", maximum_purchases_per_user: "" }); await refresh(); setMessage("Ticket type added with server-side inventory."); } catch (ticketError) { setError(ticketError.message || "Unable to add ticket type."); } finally { setBusy(false); } };
  const publish = async () => { if (!selected) return; setBusy(true); setError(""); try { const next = await publishOrganizerEvent(selected.id); setMessage("Event published after server validation."); await refresh(); setSelected(next); } catch (publishError) { setError(publishError.message || "Event cannot be published yet."); } finally { setBusy(false); } };
  const cancel = async () => { if (!selected) return; setBusy(true); setError(""); try { const next = await cancelOrganizerEvent(selected.id); setMessage("Event cancelled and retained in history."); await refresh(); setSelected(next); } catch (cancelError) { setError(cancelError.message || "Unable to cancel event."); } finally { setBusy(false); } };
  const linkArtist = async (event) => { event.preventDefault(); if (!selected || !artistId.trim()) return; setBusy(true); setError(""); try { await linkOrganizerArtist(selected.id, account.user.id, artistId.trim()); setArtistId(""); setMessage("Artist associated with this event."); } catch (linkError) { setError(linkError.message || "Unable to associate Artist."); } finally { setBusy(false); } };
  const addStaff = async (event) => { event.preventDefault(); if (!selected || !staffQuery.trim()) return; const match = staffMatches.find((user) => user.full_name === staffQuery || user.email === staffQuery); if (!match) { setError("Choose a staff user from the search results."); return; } setBusy(true); setError(""); try { const assignment = await assignEventStaff(selected.id, match.id, staffResponsibility, staffInstructions); if (staffShiftStartsAt || staffShiftEndsAt || staffShiftNote) await updateEventStaffShift(assignment.id, staffShiftStartsAt || null, staffShiftEndsAt || null, staffShiftNote); setStaffQuery(""); setStaffMatches([]); setStaffInstructions(""); setStaffShiftStartsAt(""); setStaffShiftEndsAt(""); setStaffShiftNote(""); setStaff(await loadEventStaffForOrganizer(selected.id)); setMessage("Event Staff assignment created and is pending acceptance."); } catch (staffError) { setError(staffError.message || "Unable to assign Event Staff."); } finally { setBusy(false); } };
  const removeStaff = async (assignmentId) => { setBusy(true); setError(""); try { await revokeEventStaffAssignment(assignmentId); setStaff(await loadEventStaffForOrganizer(selected.id)); setMessage("Event Staff assignment revoked."); } catch (staffError) { setError(staffError.message || "Unable to revoke Event Staff assignment."); } finally { setBusy(false); } };
  if (mode === "create") return <Phone><TopBack title="Create Event" onBack={() => setMode("list")} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="text-[12px] uppercase tracking-[0.16em] pt-2" style={{ color: C.gold }}>Draft event</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>Create an event</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>Venue selection creates a pending request; it never auto-confirms a booking.</p>{error && <AuthMessage error={error} />}<form onSubmit={saveEvent} className="mt-5">{[["Title","title"],["Description","description"],["Event type","event_type"],["City","city"],["Start date and time","starts_at"],["End date and time","ends_at"]].map(([label,key]) => <Field key={key} label={label} type={key.includes("at") ? "datetime-local" : "text"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />)}<MediaUploadField label="Event poster / cover image" accept="image/jpeg,image/png,image/webp,image/gif" value={coverFile} onChange={setCoverFile} /><Field label="Expected attendance" type="number" value={form.expected_attendance} onChange={(event) => setForm((current) => ({ ...current, expected_attendance: event.target.value }))} /><label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>Available venue</label><select value={form.venue_id} onChange={(event) => setForm((current) => ({ ...current, venue_id: event.target.value }))} className="w-full rounded-xl px-4 py-3.5 mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="">No venue request yet</option>{availableVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} · {venue.city} · capacity {venue.capacity}</option>)}</select>{venueLoading && <p className="text-[11px] mb-3" style={{ color: C.muted }}>Checking live venue availability...</p>}<label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>Additional venue requirements</label><textarea value={form.additional_requirements} onChange={(event) => setForm((current) => ({ ...current, additional_requirements: event.target.value }))} rows={3} className="w-full rounded-xl px-4 py-3.5 mb-3 resize-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><GoldButton disabled={busy}>{busy ? "Saving..." : form.venue_id ? "Save draft and request venue" : "Save draft"}</GoldButton></form></div></Phone>;
  if (mode === "detail" && selected) return <Phone><TopBack title="Event management" onBack={() => setMode("list")} right={<span className="text-[10px] uppercase" style={{ color: C.goldSoft }}>{selected.status}</span>} /><div className="flex-1 overflow-y-auto px-5 pb-8"><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>{selected.title}</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>{selected.city} · {selected.starts_at ? new Date(selected.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date pending"}</p>{error && <AuthMessage error={error} />}{message && <p className="text-[11px] mt-3" style={{ color: C.green }}>{message}</p>}<div className="grid grid-cols-2 gap-3 mt-5">{[["Tickets sold",dashboard?.tickets_sold || 0],["Remaining",dashboard?.tickets_remaining || 0],["Attendees",dashboard?.attendees || 0],["Check-ins",dashboard?.check_ins || 0],["Paid orders",dashboard?.successful_orders || 0],["Gross revenue",money(dashboard?.gross_revenue || 0)]].map(([label,value]) => <div key={label} className="rounded-2xl p-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[18px] font-semibold" style={{ color: C.goldSoft }}>{value}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{label}</p></div>)}</div><div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Ticket types</p>{(selected.ticket_types || []).map((item) => <div key={item.id} className="py-3 border-b" style={{ borderColor: C.line }}><div className="flex justify-between"><span className="text-[12px]" style={{ color: C.ivory }}>{item.name}</span><span className="text-[12px]" style={{ color: C.goldSoft }}>{money(item.price)}</span></div><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.sold || 0} sold · {item.reserved || 0} reserved · {item.capacity} capacity</p></div>)}{!(selected.ticket_types || []).length && <EmptyResourceCard label="No ticket types yet" description="Add a ticket type before publishing." />}<form onSubmit={addTicket} className="mt-4"><div className="grid grid-cols-2 gap-2"><Field label="Name" value={ticket.name} onChange={(event) => setTicket((current) => ({ ...current, name: event.target.value }))} /><Field label="Price (NGN)" type="number" value={ticket.price} onChange={(event) => setTicket((current) => ({ ...current, price: event.target.value }))} /><Field label="Capacity" type="number" value={ticket.capacity} onChange={(event) => setTicket((current) => ({ ...current, capacity: event.target.value }))} /><Field label="Max per customer" type="number" value={ticket.maximum_per_customer} onChange={(event) => setTicket((current) => ({ ...current, maximum_per_customer: event.target.value }))} /></div><label className="block text-[12px] mb-1.5 mt-3" style={{ color: C.muted }}>Ticket visibility</label><select value={ticket.visibility} onChange={(event) => setTicket((current) => ({ ...current, visibility: event.target.value }))} className="w-full rounded-xl px-4 py-3.5 mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="PUBLIC">Public — visible in event ticket listings</option><option value="PRIVATE">Private — hidden until unlocked</option></select>{ticket.visibility === "PRIVATE" && <div className="rounded-xl p-3 mb-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[11px] font-semibold" style={{ color: C.ivory }}>Private access protection</p><p className="text-[10px] mt-1 mb-3" style={{ color: C.muted }}>Atizzy stores only a one-way hash. The credential will not be shown again after creation.</p><select value={ticket.access_method} onChange={(event) => setTicket((current) => ({ ...current, access_method: event.target.value }))} className="w-full rounded-xl px-3 py-2.5 mb-2 text-[12px]" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }}><option value="CODE">Code</option><option value="WORD">Word</option><option value="CODE_WORD">Code + word</option></select>{ticket.access_method !== "WORD" && <Field label="Private code" value={ticket.code} onChange={(event) => setTicket((current) => ({ ...current, code: event.target.value }))} />}{ticket.access_method !== "CODE" && <Field label="Private word" value={ticket.word} onChange={(event) => setTicket((current) => ({ ...current, word: event.target.value }))} />}<Field label="Credential hint (optional)" value={ticket.access_credential_hint} onChange={(event) => setTicket((current) => ({ ...current, access_credential_hint: event.target.value }))} /><div className="grid grid-cols-2 gap-2"><Field label="Max unlocks (optional)" type="number" value={ticket.maximum_redemptions} onChange={(event) => setTicket((current) => ({ ...current, maximum_redemptions: event.target.value }))} /><Field label="Max purchases per user" type="number" value={ticket.maximum_purchases_per_user} onChange={(event) => setTicket((current) => ({ ...current, maximum_purchases_per_user: event.target.value }))} /></div></div>}<GoldButton disabled={busy}>{busy ? "Adding..." : "Add ticket type"}</GoldButton></form></div><div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Existing Artist association</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Search verified Artist profiles; Organizers cannot edit Artist profiles.</p><form onSubmit={linkArtist} className="mt-3"><Field label="Search artists" value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} />{artistMatches.length > 0 && <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>{artistMatches.map((artist) => <button type="button" key={artist.id} onClick={() => { setArtistId(artist.id); setArtistQuery(artist.stage_name); setArtistMatches([]); }} className="w-full flex items-center justify-between px-3 py-2 text-left" style={{ background: C.card2, color: C.ivory }}><span className="text-[12px]">{artist.stage_name}</span><span className="text-[10px]" style={{ color: C.goldSoft }}>{artist.verification_status || "Artist"}</span></button>)}</div>}<p className="text-[10px] mt-2" style={{ color: C.muted }}>{artistId ? `Selected Artist: ${artistQuery}` : "Choose an Artist result before associating."}</p><GoldButton disabled={busy || !artistId}>{busy ? "Linking..." : "Associate Artist"}</GoldButton></form></div><div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Event Staff</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Assign operational access to this event only. Staff must accept before they can operate it.</p><form onSubmit={addStaff} className="mt-3"><Field label="Search user by name or email" value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} />{staffMatches.length > 0 && <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>{staffMatches.map((user) => <button type="button" key={user.id} onClick={() => { setStaffQuery(user.full_name || user.email); setStaffMatches([user]); }} className="w-full flex items-center justify-between px-3 py-2 text-left" style={{ background: C.card2, color: C.ivory }}><span className="text-[12px]">{user.full_name || "Atizzy user"}</span><span className="text-[10px]" style={{ color: C.goldSoft }}>{user.email}</span></button>)}</div>}<label className="block text-[12px] mb-1.5 mt-3" style={{ color: C.muted }}>Responsibility</label><select value={staffResponsibility} onChange={(event) => setStaffResponsibility(event.target.value)} className="w-full rounded-xl px-4 py-3.5 mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="GENERAL">General staff</option><option value="CHECK_IN">Check-in staff</option><option value="SECURITY">Security staff</option><option value="REGISTRATION">Registration staff</option><option value="COORDINATOR">Event coordinator</option></select><label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>Operational instructions</label><textarea value={staffInstructions} onChange={(event) => setStaffInstructions(event.target.value)} rows={3} className="w-full rounded-xl px-4 py-3.5 mb-3 resize-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="grid grid-cols-2 gap-2"><Field label="Shift starts" type="datetime-local" value={staffShiftStartsAt} onChange={(event) => setStaffShiftStartsAt(event.target.value)} /><Field label="Shift ends" type="datetime-local" value={staffShiftEndsAt} onChange={(event) => setStaffShiftEndsAt(event.target.value)} /></div><label className="block text-[12px] mb-1.5 mt-1" style={{ color: C.muted }}>Shift note</label><textarea value={staffShiftNote} onChange={(event) => setStaffShiftNote(event.target.value)} rows={2} placeholder="Call time, handover, or access note" className="w-full rounded-xl px-4 py-3.5 mb-3 resize-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><GoldButton disabled={busy || !staffMatches.find((user) => (user.full_name || user.email) === staffQuery)}>{busy ? "Assigning..." : "Assign Event Staff"}</GoldButton></form><div className="mt-4">{staff.length ? staff.map((assignment) => <div key={assignment.id} className="flex items-center justify-between gap-3 py-3 border-b" style={{ borderColor: C.line }}><div><p className="text-[12px]" style={{ color: C.ivory }}>{assignment.full_name || "Assigned user"}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{assignment.responsibility} · {assignment.status} · {assignment.tasks || 0} open tasks</p>{assignment.shift_starts_at && <p className="text-[10px] mt-1" style={{ color: C.goldSoft }}>Shift: {new Date(assignment.shift_starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}{assignment.shift_ends_at ? ` – ${new Date(assignment.shift_ends_at).toLocaleTimeString("en-NG", { timeStyle: "short" })}` : ""}</p>}{assignment.shift_note && <p className="text-[10px] mt-1" style={{ color: C.muted }}>{assignment.shift_note}</p>}</div>{assignment.status !== "REVOKED" && <button type="button" onClick={() => removeStaff(assignment.id)} className="text-[10px]" style={{ color: C.red }}>Revoke</button>}</div>) : <EmptyResourceCard label="No Event Staff assigned" description="Assign a user to give them operational access to this event." />}</div></div><div className="mt-4"><GoldButton disabled={busy || selected.status === "PUBLISHED" || selected.status === "CANCELLED"} onClick={publish}>Publish after validation</GoldButton><div className="mt-3"><GhostButton onClick={cancel}>Cancel event</GhostButton></div></div></div></Phone>;
  return <Phone><TopBack title="My Events" onBack={nav.pop} right={<button onClick={() => { setForm(blank); setMode("create"); }} className="text-[11px]" style={{ color: C.gold }}>New event</button>} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="text-[12px] uppercase tracking-[0.16em] pt-2" style={{ color: C.gold }}>Organizer workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>Your events</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>Draft, publish, monitor, and retain the history of events you own.</p>{error && <AuthMessage error={error} />}{!events.length ? <div className="mt-5"><EmptyResourceCard label="No organizer events yet" description="Create a draft event to start configuring tickets and Artists." /><div className="mt-4"><GoldButton onClick={() => { setForm(blank); setMode("create"); }}>Create your first event</GoldButton></div></div> : <div className="mt-5">{events.map((event) => <button key={event.id} onClick={() => choose(event)} className="ev-card w-full text-left rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex justify-between gap-3"><span className="text-[14px] font-semibold" style={{ color: C.ivory }}>{event.title}</span><span className="text-[10px] uppercase" style={{ color: C.goldSoft }}>{event.status}</span></div><p className="text-[11px] mt-2" style={{ color: C.muted }}>{event.city} · {event.starts_at ? new Date(event.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date pending"}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{(event.ticket_types || []).length} ticket types</p></button>)}</div>}</div></Phone>;
}

function EventStaffWorkspace({ nav, account }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const refresh = async () => { setLoading(true); try { setItems(await loadEventStaffWorkspace()); } catch (loadError) { setError(loadError.message || "Unable to load Event Staff workspace."); } finally { setLoading(false); } };
  useEffect(() => { refresh(); }, [account?.user?.id]);
  const respond = async (assignmentId, status) => { setBusy(true); setError(""); try { await respondEventStaffAssignment(assignmentId, status); setMessage(status === "ACCEPTED" ? "Assignment accepted. Operational access is now active." : "Assignment declined."); await refresh(); } catch (responseError) { setError(responseError.message || "Unable to update assignment."); } finally { setBusy(false); } };
  const completeTask = async (taskId, status) => { setBusy(true); setError(""); try { await acknowledgeEventStaffTask(taskId, status); await refresh(); } catch (taskError) { setError(taskError.message || "Unable to update task."); } finally { setBusy(false); } };
  return <Phone><TopBack title="Event Staff" onBack={nav.pop} right={<span className="text-[10px] uppercase" style={{ color: C.goldSoft }}>Assigned events only</span>} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="text-[12px] uppercase tracking-[0.16em] pt-2" style={{ color: C.gold }}>Operations workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>Your assignments</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>Only events assigned to your account appear here. Check-in permissions activate after acceptance.</p>{error && <AuthMessage error={error} />}{message && <p className="text-[11px] mt-3" style={{ color: C.green }}>{message}</p>}{loading ? <div className="py-10 text-center text-[12px]" style={{ color: C.muted }}>Loading live assignments...</div> : !items.length ? <div className="mt-5"><EmptyResourceCard label="No Event Staff assignments" description="Organizer assignments and operational instructions will appear here." /></div> : <div className="mt-5">{items.map((item) => <div key={item.assignment_id} className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex justify-between gap-3"><div><p className="text-[15px] font-semibold" style={{ color: C.ivory }}>{item.event_title}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{item.city} · {item.venue_name || "Venue pending"}</p></div><span className="text-[10px] uppercase" style={{ color: item.assignment_status === "ACCEPTED" ? C.green : C.goldSoft }}>{item.assignment_status}</span></div><p className="text-[11px] mt-3" style={{ color: C.muted }}>{item.responsibility} · {item.starts_at ? new Date(item.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date pending"}</p>{item.shift_starts_at && <p className="text-[11px] mt-1" style={{ color: C.goldSoft }}>Shift: {new Date(item.shift_starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}{item.shift_ends_at ? ` – ${new Date(item.shift_ends_at).toLocaleTimeString("en-NG", { timeStyle: "short" })}` : ""}</p>}{item.shift_note && <p className="text-[11px] mt-1" style={{ color: C.muted }}>{item.shift_note}</p>}{item.instructions && <div className="rounded-xl p-3 mt-3" style={{ background: C.card2 }}><p className="text-[10px] uppercase tracking-wide" style={{ color: C.gold }}>Organizer instructions</p><p className="text-[12px] mt-1" style={{ color: C.ivory }}>{item.instructions}</p></div>}{item.assignment_status === "PENDING" && <div className="grid grid-cols-2 gap-2 mt-4"><GoldButton disabled={busy} onClick={() => respond(item.assignment_id, "ACCEPTED")}>Accept assignment</GoldButton><GhostButton disabled={busy} onClick={() => respond(item.assignment_id, "DECLINED")}>Decline</GhostButton></div>}{item.assignment_status === "ACCEPTED" && <><div className="grid grid-cols-3 gap-2 mt-4">{[["Check-ins", item.tickets_checked_in || 0], ["Tasks", (item.tasks || []).filter((task) => task.status !== "DONE").length], ["Unread", (item.notifications || []).filter((notice) => !notice.read_at).length]].map(([label, value]) => <div key={label} className="rounded-xl p-3" style={{ background: C.card2 }}><p className="text-[17px] font-semibold" style={{ color: C.goldSoft }}>{value}</p><p className="text-[9px]" style={{ color: C.muted }}>{label}</p></div>)}</div><div className="grid grid-cols-2 gap-2 mt-4"><GoldButton onClick={() => nav.push("checkIn", { assignmentId: item.assignment_id, eventId: item.event_id, responsibility: item.responsibility, eventTitle: item.event_title })}>Open check-in</GoldButton>{/* Existing contract: nav.push("checkIn", { responsibility: item.responsibility, eventTitle: item.event_title }) */}<GhostButton onClick={() => nav.push("eventStaffTasks", item)}>View tasks</GhostButton></div></>}{item.assignment_status === "ACCEPTED" && (item.tasks || []).length > 0 && <div className="mt-4">{item.tasks.map((task) => <div key={task.id} className="py-3 border-b" style={{ borderColor: C.line }}><div className="flex justify-between gap-3"><p className="text-[12px]" style={{ color: C.ivory }}>{task.title}</p><span className="text-[10px] uppercase" style={{ color: task.status === "DONE" ? C.green : C.goldSoft }}>{task.status}</span></div>{task.description && <p className="text-[11px] mt-1" style={{ color: C.muted }}>{task.description}</p>}{task.status !== "DONE" && <button type="button" disabled={busy} onClick={() => completeTask(task.id, "DONE")} className="text-[10px] mt-2" style={{ color: C.gold }}>Mark complete</button>}</div>)}</div>}</div>)}</div>}</div></Phone>;
}

function EventStaffTasks({ nav, data }) {
  const tasks = data?.tasks || []; return <Phone><TopBack title="Assigned tasks" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="text-[12px] uppercase tracking-[0.16em] pt-2" style={{ color: C.gold }}>Event Staff</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>{data?.event_title || "Event tasks"}</h1>{!tasks.length ? <div className="mt-5"><EmptyResourceCard label="No tasks assigned" description="Your Organizer will add operational tasks here when needed." /></div> : <div className="mt-5">{tasks.map((task) => <div key={task.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{task.title}</p><p className="text-[11px] mt-2" style={{ color: C.muted }}>{task.description || "No additional instructions."}</p><p className="text-[10px] mt-3 uppercase" style={{ color: C.goldSoft }}>{task.status}</p></div>)}</div>}</div></Phone>;
}

function VenueManagerOnboarding({ nav, account }) { return <RoleOnboarding nav={nav} account={account} roleCode="VENUE_MANAGER" title="Become a Venue Manager" eyebrow="Venue operations" heading="Manage spaces that bring events to life" description="Complete the live questionnaire first. Approval is server-controlled and requires the configured fee and admin review." workspaceRoute="venueManager" />; }
function VenueManagerWorkspace({ nav, account }) {
  const userId = account?.user?.id;
  const isSuperAdmin = hasEffectiveRole(account, "SUPER_ADMIN");
  const blankVenue = { name: "", city: "", address: "", capacity: "", description: "", venue_type: "", rules: "", contact_phone: "", cancellation_policy: "", pricing: "" };
  const [data, setData] = useState({ application: null, venues: [], bookings: [], availability: [], metrics: {} });
  const [form, setForm] = useState(blankVenue); const [venuePhotoFile, setVenuePhotoFile] = useState(null); const [availability, setAvailability] = useState({ venue_id: "", starts_at: "", ends_at: "", status: "BLOCKED", note: "" });
  const [editingVenue, setEditingVenue] = useState(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [paymentBusy, setPaymentBusy] = useState(false); const [error, setError] = useState("");
  const load = async () => { if (!userId) { setError("Sign in to open the Venue Manager workspace."); return; } try { setData(await loadVenueManagerWorkspace(userId)); } catch (err) { setError(err.message || "Unable to load Venue Manager data."); } };
  useEffect(() => { void load(); }, [userId]);
  const create = async (event) => { event.preventDefault(); if (!userId) { setError("Sign in to create a venue."); return; } setBusy(true); setError(""); try { const photo = venuePhotoFile ? await uploadMediaFile(userId, venuePhotoFile, "VENUE_PHOTO", "venues", null) : null; await createOwnedVenue(userId, { ...form, capacity: Number(form.capacity), pricing: form.pricing ? { base: Number(form.pricing) } : {}, image_urls: photo?.public_url ? [photo.public_url] : [] }); setVenuePhotoFile(null); setForm(blankVenue); await load(); } catch (err) { setError(err.message || "Unable to create venue."); } finally { setBusy(false); } };
  const updateVenue = async (event) => { event.preventDefault(); if (!editingVenue?.id) return; setBusy(true); setError(""); try { await updateOwnedVenue(editingVenue.id, { ...editingVenue, capacity: Number(editingVenue.capacity), pricing: editingVenue.pricing || {} }); setEditingVenue(null); await load(); } catch (err) { setError(err.message || "Unable to update venue."); } finally { setBusy(false); } };
  const archiveVenue = async (venue) => { if (busy) return; if (!window.confirm(`Delete “${venue.name || "this venue"}” permanently? Existing booking records may require archiving instead.`)) return; setBusy(true); setError(""); setMessage(""); try { await deleteOwnedVenue(venue.id); if (editingVenue?.id === venue.id) setEditingVenue(null); await load(); setMessage("Venue deleted permanently."); } catch (err) { setError(err.message || "Unable to delete venue. No changes were made."); } finally { setBusy(false); } };
  const payForBooking = async (booking) => { setPaymentBusy(true); setError(""); try { const session = (await supabase.auth.getSession()).data.session; if (!session?.access_token) throw new Error("Please sign in again before starting payment."); const response = await fetch("/api/paystack/venue-initialize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ bookingId: booking.id, email: account.user.email, idempotencyKey: `venue-${booking.id}`, callbackUrl: `${window.location.origin}/?venue-payment=callback` }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Unable to initialize venue payment."); const authorizationUrl = payload?.authorizationUrl || payload?.authorization_url || payload?.data?.authorizationUrl || payload?.data?.authorization_url; if (!authorizationUrl) throw new Error(payload?.message || "Paystack authorization was not returned."); window.location.assign(authorizationUrl); } catch (err) { setError(err.message || "Unable to initialize venue payment."); } finally { setPaymentBusy(false); } };
  const respond = async (booking, status) => { setBusy(true); setError(""); try { await respondVenueBooking(booking.id, status, status === "REJECTED" ? reason : null); setReason(""); await load(); } catch (err) { setError(err.message || "Unable to update booking."); } finally { setBusy(false); } };
  const block = async (event) => { event.preventDefault(); setBusy(true); setError(""); try { await setVenueAvailability(availability.venue_id, availability); setAvailability({ venue_id: "", starts_at: "", ends_at: "", status: "BLOCKED", note: "" }); await load(); } catch (err) { setError(err.message || "Unable to save availability."); } finally { setBusy(false); } };
  if (!userId) return <Phone><TopBack title="Venue Manager" onBack={nav.pop} /><div className="flex-1 px-5 py-10"><EmptyResourceCard label="Sign in required" description="Your authenticated session is required before the Venue Manager workspace can load." /></div></Phone>;
  if (!effectiveRoleCodes(account).some((role) => ["VENUE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role))) return <Phone><TopBack title="Venue Manager" onBack={nav.pop} /><div className="flex-1 px-5 py-10"><EmptyResourceCard label="Venue Manager access required" description="Your role is checked by the backend before venue data is shown." /></div></Phone>;
  return <Phone><TopBack title="Venue Manager" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pb-8"><p className="text-[12px] uppercase tracking-[0.16em] pt-2" style={{ color: C.gold }}>Venue operations</p><h1 className="ev-display text-[27px] mt-1" style={{ color: C.ivory }}>Your venue dashboard</h1><p className="text-[13px] mt-2" style={{ color: C.muted }}>Own spaces, review requests, and protect availability with live server rules.</p>{error && <AuthMessage error={error} />}<div className="grid grid-cols-2 gap-2 mt-5">{[["Pending",data.metrics.pending||0],["Confirmed",data.metrics.confirmed||0],["Rejected",data.metrics.rejected||0],["Upcoming",data.metrics.upcoming||0],["Occupancy",data.metrics.occupancy||0],["Revenue",money(data.metrics.revenue||0)]].map(([label,value]) => <div key={label} className="rounded-2xl p-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[20px] font-semibold" style={{ color: C.goldSoft }}>{value}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{label}</p></div>)}</div><div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Calendar and confirmed bookings</p><span className="text-[10px] uppercase" style={{ color: C.goldSoft }}>{data.bookings.filter((booking) => booking.status === "CONFIRMED").length} confirmed</span></div>{data.bookings.filter((booking) => booking.status === "CONFIRMED").slice(0, 5).map((booking) => <div key={booking.id} className="py-3 border-b last:border-b-0" style={{ borderColor: C.line }}><div className="flex justify-between gap-3"><p className="text-[12px]" style={{ color: C.ivory }}>{booking.event_name}</p><span className="text-[10px]" style={{ color: C.goldSoft }}>{new Date(booking.starts_at).toLocaleDateString("en-NG")}</span></div><p className="text-[10px] mt-1" style={{ color: C.muted }}>{booking.expected_attendance} expected · organizer {booking.organizer_id}</p></div>)}{!data.bookings.some((booking) => booking.status === "CONFIRMED") && <EmptyResourceCard label="No confirmed bookings" description="Accepted requests will appear on the live calendar." />}</div><div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Owned venues</p>{!data.venues.length ? <EmptyResourceCard label="No owned venues" description="Create a venue below to begin managing availability and booking requests." /> : data.venues.map((venue) => <div key={venue.id} className="py-3 border-b last:border-b-0" style={{ borderColor: C.line }}><div className="flex items-center justify-between gap-3"><div><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{venue.name}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{venue.city || "City pending"} · capacity {venue.capacity || "—"}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setEditingVenue({ ...venue, pricing: venue.pricing || {} })} className="text-[11px] px-3 py-2 rounded-xl" style={{ color: C.goldSoft, border: `1px solid ${C.line}` }}>Edit</button><button type="button" disabled={busy} onClick={() => archiveVenue(venue)} className="text-[11px] px-3 py-2 rounded-xl" style={{ color: C.red, border: `1px solid ${C.red}66` }}>Delete</button></div></div>{editingVenue?.id === venue.id && <form onSubmit={updateVenue} className="mt-3"><Field label="Name" value={editingVenue.name || ""} onChange={(event) => setEditingVenue((current) => ({ ...current, name: event.target.value }))} /><div className="grid grid-cols-2 gap-2"><Field label="City" value={editingVenue.city || ""} onChange={(event) => setEditingVenue((current) => ({ ...current, city: event.target.value }))} /><Field label="Capacity" type="number" value={editingVenue.capacity || ""} onChange={(event) => setEditingVenue((current) => ({ ...current, capacity: event.target.value }))} /></div><Field label="Address" value={editingVenue.address || ""} onChange={(event) => setEditingVenue((current) => ({ ...current, address: event.target.value }))} /><Field label="Base price (NGN)" type="number" value={editingVenue.pricing?.base || ""} onChange={(event) => setEditingVenue((current) => ({ ...current, pricing: { ...(current.pricing || {}), base: Number(event.target.value) } }))} /><div className="grid grid-cols-2 gap-2"><GoldButton disabled={busy}>{busy ? "Saving..." : "Save profile"}</GoldButton><GhostButton onClick={() => setEditingVenue(null)}>Cancel</GhostButton></div></form>}</div>)}</div><div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Create owned venue</p><form onSubmit={create} className="mt-3"><Field label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><div className="grid grid-cols-2 gap-2"><Field label="City" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /><Field label="Capacity" type="number" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} /></div><Field label="Address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /><Field label="Base price (NGN)" type="number" value={form.pricing} onChange={(event) => setForm((current) => ({ ...current, pricing: event.target.value }))} /><MediaUploadField label="Venue photo" accept="image/png,image/jpeg,image/webp" value={venuePhotoFile} onChange={setVenuePhotoFile} hint="PNG, JPG, or WebP · max 5 MB" /><label className="block text-[12px] mb-1.5" style={{ color: C.muted }}>Description</label><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-xl px-4 py-3.5 text-[14px] outline-none resize-none mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><GoldButton disabled={busy}>{busy ? "Saving..." : "Create venue"}</GoldButton></form></div><div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Availability blocks</p><form onSubmit={block} className="mt-3"><select value={availability.venue_id} onChange={(event) => setAvailability((current) => ({ ...current, venue_id: event.target.value }))} className="w-full rounded-xl px-4 py-3.5 mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="">Select venue</option>{data.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><Field label="Starts" type="datetime-local" value={availability.starts_at} onChange={(event) => setAvailability((current) => ({ ...current, starts_at: event.target.value }))} /><Field label="Ends" type="datetime-local" value={availability.ends_at} onChange={(event) => setAvailability((current) => ({ ...current, ends_at: event.target.value }))} /></div><Field label="Note" value={availability.note} onChange={(event) => setAvailability((current) => ({ ...current, note: event.target.value }))} /><GhostButton onClick={block}>Block availability</GhostButton></form></div><div className="mt-4"><p className="text-[14px] font-semibold mb-3" style={{ color: C.ivory }}>Booking requests</p>{!data.bookings.length ? <EmptyResourceCard label="No booking requests" description="Organizer requests will remain visible here with a live empty state." /> : data.bookings.map((booking) => <div key={booking.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex justify-between gap-3"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{booking.event_name}</p><span className="text-[10px] uppercase" style={{ color: booking.status === "CONFIRMED" ? C.goldSoft : C.muted }}>{booking.status}</span></div><p className="text-[11px] mt-2" style={{ color: C.muted }}>{booking.venues?.name || "Venue"} · {new Date(booking.starts_at).toLocaleString("en-NG")}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{booking.expected_attendance} expected · {booking.additional_requirements || "No additional requirements"}</p>{booking.status === "PENDING" && <div className="grid grid-cols-2 gap-2 mt-3"><GoldButton disabled={busy} onClick={() => respond(booking, "CONFIRMED")}>Accept</GoldButton><GhostButton onClick={() => respond(booking, "REJECTED")}>Reject</GhostButton></div>}{booking.status === "CONFIRMED" && <button type="button" disabled={paymentBusy} onClick={() => payForBooking(booking)} className="w-full mt-3 rounded-2xl py-3.5 text-[13px] font-semibold" style={{ background: C.gold, color: C.bg }}>{paymentBusy ? "Opening secure payment..." : "Pay venue booking"}</button>}</div>)}</div></div></Phone>;
}
function ArtistMusicLibrary({ nav, account }) {
  const [workspace, setWorkspace] = useState(null); const [form, setForm] = useState({ title: "", duration_seconds: "" }); const [coverFile, setCoverFile] = useState(null); const [audioFile, setAudioFile] = useState(null); const [editingId, setEditingId] = useState(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const refresh = async () => { try { setError(""); setWorkspace(await loadArtistWorkspace(account?.user?.id)); } catch (loadError) { setError(loadError.message || "Unable to load your music workspace."); } };
  useEffect(() => { refresh(); }, [account?.user?.id]);
  const reset = () => { setForm({ title: "", duration_seconds: "" }); setCoverFile(null); setAudioFile(null); setEditingId(null); };
  const editSong = (song) => { setEditingId(song.id); setForm({ title: song.title || "", duration_seconds: String(song.duration_seconds || "") }); setMessage(""); setError(""); };
  const save = async (event) => { event.preventDefault(); if (!workspace?.artist) return; setBusy(true); setMessage(""); setError(""); try { const current = workspace.songs?.find((song) => song.id === editingId); const cover = coverFile ? await uploadMediaFile(account.user.id, coverFile, "MUSIC_COVER", "songs", editingId || null) : null; const audio = audioFile ? await uploadMediaFile(account.user.id, audioFile, "AUDIO", "songs", editingId || null) : null; const payload = { title: form.title, duration_seconds: form.duration_seconds, cover_url: cover?.public_url || current?.cover_url || null, audio_url: audio?.public_url || current?.audio_url || null }; const saved = editingId ? await updateArtistSong(editingId, workspace.artist.id, payload) : await createArtistSong(workspace.artist.id, account.user.id, payload); setWorkspace((value) => ({ ...value, songs: editingId ? value.songs.map((song) => song.id === saved.id ? saved : song) : [saved, ...(value.songs || [])] })); reset(); setMessage(editingId ? "Song draft updated." : "Song saved as a draft. Publish it when ready."); } catch (saveError) { setError(saveError.message || "Unable to save this song."); } finally { setBusy(false); } };
  const publish = async (song) => { setBusy(true); setMessage(""); setError(""); try { const updated = await setArtistSongStatus(song.id, "PUBLISHED"); setWorkspace((value) => ({ ...value, songs: value.songs.map((item) => item.id === updated.id ? updated : item) })); setMessage("Song published to the live catalog."); } catch (publishError) { setError(publishError.message || "Unable to publish this song."); } finally { setBusy(false); } };
  const archive = async (song) => { if (busy) return; if (!window.confirm(`Delete “${song.title || "this song"}” permanently? This removes the song and its owner-owned media.`)) return; setBusy(true); setMessage(""); setError(""); try { await deleteArtistSong(song.id); setWorkspace((value) => ({ ...value, songs: value.songs.filter((item) => item.id !== song.id) })); if (editingId === song.id) reset(); setMessage("Song deleted permanently."); } catch (deleteError) { setError(deleteError.message || "Unable to delete this song. No changes were made."); } finally { setBusy(false); } };
  return <Phone><TopBack title="Music Library" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pt-2 pb-8"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Artist workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>Publish music</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>Create a live song record, attach artwork and audio, save a draft, and publish it to your artist catalog.</p>{error && <AuthMessage error={error} />}{message && <p className="text-[11px] mt-3" style={{ color: C.green }}>{message}</p>}{!workspace ? <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Loading music workspace...</p> : !workspace.artist ? <EmptyResourceCard label="Artist profile unavailable" description="Your Artist role needs a linked live artist profile before music can be published." /> : <><form onSubmit={save} className="rounded-2xl p-4 mt-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{editingId ? "Edit song draft" : "New song"}</p>{editingId && <button type="button" onClick={reset} className="text-[11px]" style={{ color: C.goldSoft }}>Clear</button>}</div><Field label="Song title" placeholder="Enter the song title" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /><Field label="Duration (seconds)" type="number" placeholder="e.g. 210" value={form.duration_seconds} onChange={(event) => setForm((value) => ({ ...value, duration_seconds: event.target.value }))} /><MediaUploadField label="Song artwork" accept="image/jpeg,image/png,image/webp,image/gif" value={coverFile} onChange={setCoverFile} existingUrl={editingId ? workspace.songs.find((song) => song.id === editingId)?.cover_url || "" : ""} /><MediaUploadField label="Audio file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/x-m4a" value={audioFile} onChange={setAudioFile} existingUrl={editingId ? workspace.songs.find((song) => song.id === editingId)?.audio_url || "" : ""} hint="MP3, M4A, WAV or OGG · max 50 MB" /><GoldButton disabled={busy}>{busy ? "Saving..." : editingId ? "Save draft changes" : "Save song draft"}</GoldButton></form><div className="mt-5"><div className="flex items-center justify-between mb-3"><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Your songs</p><button type="button" onClick={refresh} className="text-[11px]" style={{ color: C.goldSoft }}>Refresh</button></div>{!(workspace.songs || []).length ? <EmptyResourceCard label="No songs yet" description="Create your first live song draft above, then publish it from the record below." /> : workspace.songs.map((song) => <div key={song.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-start justify-between gap-3"><div><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{song.title || "Untitled song"}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{song.status || "DRAFT"} · {song.duration_seconds || "—"} seconds</p></div><span className="text-[10px] uppercase" style={{ color: song.status === "PUBLISHED" ? C.green : C.goldSoft }}>{song.status || "DRAFT"}</span></div><div className="flex gap-2 mt-3"><GhostButton onClick={() => editSong(song)}>Edit</GhostButton>{song.status !== "PUBLISHED" && <GoldButton disabled={busy} onClick={() => publish(song)}>Publish</GoldButton>}<button type="button" disabled={busy} onClick={() => archiveSong(song)} className="rounded-xl px-3 py-2 text-[11px] font-semibold" style={{ color: C.red, border: `1px solid ${C.red}66` }}>Delete</button></div></div>)}</div></>}</div></Phone>;
}

function RoleResourceScreen({ nav, account, title, description, rows, emptyLabel, columns }) {
  return <Phone><TopBack title={title} onBack={nav.pop} /><div className="px-5 pt-2 pb-3"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Protected workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>{title}</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>{description}</p></div><div className="flex-1 overflow-y-auto px-5">{!rows?.length ? <EmptyResourceCard label={emptyLabel} description="This module stays available while live records are provisioned." /> : rows.map((row) => <div key={row.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{row[columns.title] || "Untitled"}</p><div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">{columns.meta.map((key) => <span key={key} className="text-[11px]" style={{ color: C.muted }}>{String(row[key] ?? "Not provided")}</span>)}</div></div>)}</div></Phone>;
}

/* ============================== ARTIST ONBOARDING ============================== */
function ArtistOnboarding({ nav, account, mode = "REGISTRATION" }) {
  if (mode === "VERIFICATION") return <RoleOnboarding nav={nav} account={account} roleCode="ARTIST" title="Artist verification" eyebrow="Artist verification" heading="Complete your verification" description="Your verification application uses the same live Super Admin review and payment controls." workspaceRoute="artistWorkspace" />;
  return <RoleOnboarding nav={nav} account={account} roleCode="ARTIST" title="Become an Artist" eyebrow="Artist registration" heading="Build your artist presence" description="Complete the live Artist questionnaire before any configured verification fee can be shown." workspaceRoute="artistWorkspace" />;
}

function ArtistPaymentProcessing({ nav, data }) {
  const [status, setStatus] = useState("PROCESSING");
  const [message, setMessage] = useState("");
  useEffect(() => { let mounted = true; let timer; const check = async () => { try { const transaction = await loadArtistFeeTransaction(data?.transactionId); if (!mounted) return; setStatus(transaction?.status || "PROCESSING"); if (transaction?.status === "VERIFIED_SUCCESS") { window.localStorage.removeItem("atizzy:pending-artist-payment"); nav.replace(data.transactionType === "REGISTRATION" ? "artistOnboarding" : "artistVerification"); return; } if (["FAILED", "CANCELLED", "EXPIRED"].includes(transaction?.status)) { setMessage("Payment was not verified. You can safely retry from the previous screen."); return; } timer = window.setTimeout(check, 2500); } catch (error) { if (mounted) { setMessage(error.message || "Unable to check payment status."); timer = window.setTimeout(check, 4000); } } }; check(); return () => { mounted = false; window.clearTimeout(timer); }; }, [data?.transactionId, data?.transactionType]);
  return <Phone><div className="flex-1 flex flex-col justify-center px-6 text-center"><div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: C.green, border: `1px solid ${C.gold}` }}><Clock size={26} color={C.gold} /></div><h1 className="ev-display text-[27px] mt-5" style={{ color: C.ivory }}>Confirming your payment</h1><p className="text-[13px] leading-6 mt-3" style={{ color: C.muted }}>{status === "VERIFIED_SUCCESS" ? "Payment verified. Restoring your artist status..." : "Do not close this page. Atizzy waits for the signed Paystack webhook before activating your account."}</p>{message && <p className="text-[12px] mt-4" style={{ color: C.red }}>{message}</p>}<div className="mt-6"><GhostButton onClick={() => nav.pop()}>Back to artist status</GhostButton></div></div></Phone>;
}

/* ============================== USER EXPERIENCE ============================== */
function UserExperience({ nav, account, initialTab = "Preferences" }) {
  const [tab, setTab] = useState(initialTab);
  const [snapshot, setSnapshot] = useState({ search_history: [], notifications: [], preferences: {}, support_requests: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [support, setSupport] = useState({ category: "GENERAL", subject: "", message: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { let mounted = true; loadUserExperienceSnapshot().then((data) => { if (mounted) setSnapshot(data); }).catch((error) => { if (mounted) setMessage(error.message || "Unable to load your account preferences."); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);
  const prefs = snapshot.preferences || {};
  const savePreference = async (key, value) => { setSaving(true); setMessage(""); try { const next = { ...prefs, discovery: { ...(prefs.discovery || {}), [key]: value } }; await updateUserPreferences(next); setSnapshot((current) => ({ ...current, preferences: { ...current.preferences, discovery: next.discovery } })); setMessage("Preferences saved."); } catch (error) { setMessage(error.message || "Unable to save preferences."); } finally { setSaving(false); } };
  const submitSupport = async (event) => { event.preventDefault(); setSaving(true); setMessage(""); try { const created = await createSupportRequest(support.category, support.subject, support.message); setSnapshot((current) => ({ ...current, support_requests: [created, ...(current.support_requests || [])] })); setSupport({ category: "GENERAL", subject: "", message: "" }); setMessage("Support request submitted."); } catch (error) { setMessage(error.message || "Unable to submit support request."); } finally { setSaving(false); } };
  const markAll = async () => { try { await markAllUserNotificationsRead(); setSnapshot((current) => ({ ...current, notifications: (current.notifications || []).map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })) })); } catch (error) { setMessage(error.message || "Unable to update notifications."); } };
  return <Phone>
    <div className="flex items-center gap-3 px-5 pt-2 pb-4"><button onClick={nav.pop}><ChevronLeft size={20} color={C.ivory} /></button><h1 className="ev-display text-[22px]" style={{ color: C.ivory }}>Your Atizzy</h1></div>
    <div className="flex gap-2 px-5 pb-4 overflow-x-auto no-scrollbar">{["Preferences", "Notifications", "Search history", "Help & Support"].map((item) => <Pill key={item} active={tab === item} onClick={() => setTab(item)}>{item}</Pill>)}</div>
    <div className="flex-1 overflow-y-auto px-5 pb-4">{loading && <p className="text-[12px] py-8 text-center" style={{ color: C.muted }}>Loading your Atizzy settings...</p>}
      {!loading && tab === "Preferences" && <div className="space-y-3"><p className="text-[12px] mb-3" style={{ color: C.muted }}>Tune discovery and notification behavior for {account?.user?.email || "your account"}.</p>{[["show_recommended","Recommended events"],["notify_events","Event reminders"],["notify_tickets","Ticket updates"],["notify_music","New music from followed artists"]].map(([key,label]) => { const enabled = prefs.discovery?.[key] !== false; return <button key={key} onClick={() => savePreference(key, !enabled)} className="w-full flex items-center justify-between rounded-2xl p-4 text-left" style={{ background: C.card, border: `1px solid ${C.line}` }}><span className="text-[13px]" style={{ color: C.ivory }}>{label}</span><span className="w-10 h-6 rounded-full p-1" style={{ background: enabled ? C.gold : C.line }}><span className="block w-4 h-4 rounded-full" style={{ background: enabled ? C.bg : C.muted, marginLeft: enabled ? 16 : 0 }} /></span></button>; })}{saving && <p className="text-[11px]" style={{ color: C.muted }}>Saving...</p>}</div>}
      {!loading && tab === "Notifications" && <div><div className="flex justify-between items-center mb-3"><p className="text-[12px]" style={{ color: C.muted }}>{(snapshot.notifications || []).filter((item) => !item.read_at).length} unread</p><button onClick={markAll} className="text-[12px]" style={{ color: C.gold }}>Mark all read</button></div>{!(snapshot.notifications || []).length ? <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>No notifications yet.</p> : snapshot.notifications.map((item) => <div key={item.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${item.read_at ? C.line : `${C.gold}88`}` }}><div className="flex items-start gap-3"><Bell size={15} color={C.gold} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{item.title}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{item.message}</p></div>{!item.read_at && <button onClick={async () => { await markUserNotificationRead(item.id); setSnapshot((current) => ({ ...current, notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry) })); }} className="text-[11px]" style={{ color: C.gold }}>Read</button>}</div></div>)}</div>}
      {!loading && tab === "Search history" && <div><div className="flex justify-between items-center mb-3"><p className="text-[12px]" style={{ color: C.muted }}>Your recent searches</p><button onClick={async () => { await clearUserSearchHistory(); setSnapshot((current) => ({ ...current, search_history: [] })); }} className="text-[12px]" style={{ color: C.gold }}>Clear</button></div>{!(snapshot.search_history || []).length ? <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>No saved searches yet.</p> : snapshot.search_history.map((item) => <button key={item.id} onClick={() => nav.push("search", { query: item.query })} className="w-full flex items-center gap-3 py-3 text-left" style={{ borderBottom: `1px solid ${C.line}` }}><Search size={14} color={C.gold} /><span className="text-[13px]" style={{ color: C.ivory }}>{item.query}</span><ChevronRight size={14} color={C.muted} /></button>)}</div>}
      {!loading && tab === "Help & Support" && <div><form onSubmit={submitSupport} className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[13px] font-semibold mb-3" style={{ color: C.ivory }}>Contact Atizzy Support</p><select value={support.category} onChange={(event) => setSupport((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl px-3 py-2 mb-2 text-[12px]" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }}><option value="GENERAL">General question</option><option value="TICKET_PAYMENT">Ticket or payment</option><option value="ACCOUNT">Account</option><option value="REPORT_PROBLEM">Report a problem</option></select><input required value={support.subject} onChange={(event) => setSupport((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="w-full rounded-xl px-3 py-2 mb-2 text-[12px] outline-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /><textarea required value={support.message} onChange={(event) => setSupport((current) => ({ ...current, message: event.target.value }))} placeholder="Tell us what happened" rows={4} className="w-full rounded-xl px-3 py-2 mb-3 text-[12px] outline-none resize-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /><button disabled={saving} className="w-full py-2.5 rounded-xl text-[12px] font-semibold" style={{ background: C.gold, color: C.bg }}>{saving ? "Sending..." : "Submit request"}</button></form>{(snapshot.support_requests || []).map((item) => <div key={item.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card }}><div className="flex justify-between"><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>{item.subject}</p><span className="text-[10px]" style={{ color: C.gold }}>{item.status}</span></div><p className="text-[11px] mt-1" style={{ color: C.muted }}>{item.message}</p></div>)}</div>}
      {message && <p className="text-[11px] mt-3" style={{ color: message.includes("Unable") ? C.red : C.green }}>{message}</p>}
    </div>
  </Phone>;
}

/* ============================== PROFILE (stub, phase 1) ============================== */
function PostWorkspace({ account }) {
  const [posts, setPosts] = useState([]);
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => { try { setPosts(await loadMyPosts(account?.user?.id)); } catch (loadError) { setError(loadError.message || "Unable to load posts."); } };
  useEffect(() => { void load(); }, [account?.user?.id]);
  useEffect(() => () => { if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  const selectImage = (file) => { setImageFile(file || null); if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview); setImagePreview(file ? URL.createObjectURL(file) : ""); };
  const reset = () => { setCaption(""); selectImage(null); setEditingId(null); };
  const save = async (event) => { event.preventDefault(); setBusy(true); setError(""); setMessage(""); try { const uploaded = imageFile ? await uploadMediaFile(account.user.id, imageFile, "POST_IMAGE", "posts", editingId) : null; const imageUrl = uploaded?.public_url || imagePreview || null; const saved = editingId ? await updatePost(editingId, { caption, image_url: imageUrl }) : await createPost({ caption, image_url: imageUrl, status: "DRAFT" }); setPosts((current) => editingId ? current.map((post) => post.id === saved.id ? saved : post) : [saved, ...current]); setMessage(editingId ? "Post updated as draft." : "Draft post created."); reset(); } catch (saveError) { setError(saveError.message || "Unable to save post."); } finally { setBusy(false); } };
  const changeStatus = async (post, status) => { setBusy(true); setError(""); try { const updated = await setPostStatus(post.id, status); setPosts((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(status === "PUBLISHED" ? "Post published." : status === "ARCHIVED" ? "Post archived." : "Post restored to draft."); } catch (statusError) { setError(statusError.message || "Unable to update post state."); } finally { setBusy(false); } };
  const removePost = async (post) => { if (!window.confirm("Delete this post permanently?")) return; setBusy(true); setError(""); try { await deletePost(post.id); setPosts((current) => current.filter((item) => item.id !== post.id)); if (editingId === post.id) reset(); setMessage("Post deleted."); } catch (deleteError) { setError(deleteError.message || "Unable to delete post."); } finally { setBusy(false); } };
  const edit = (post) => { setEditingId(post.id); setCaption(post.caption || ""); setImagePreview(post.image_url || ""); setImageFile(null); setMessage(""); };
  return <div className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-3"><div><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>Posts</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Create, edit, publish, or archive live content.</p></div>{editingId && <button type="button" onClick={reset} className="text-[11px]" style={{ color: C.gold }}>New post</button>}</div>{error && <AuthMessage error={error} />}{message && <p className="text-[11px] mb-3" style={{ color: C.green }}>{message}</p>}<form onSubmit={save}><textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} placeholder="Write a caption..." className="w-full rounded-xl px-3 py-3 text-[13px] outline-none resize-none" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="mt-3"><MediaUploadField label={imagePreview ? "Replace photo" : "Select photo"} accept="image/png,image/jpeg,image/webp" value={imageFile} onChange={selectImage} hint="Optional image · PNG, JPG, or WebP · max 5 MB" /></div>{imagePreview && <div className="mt-3 relative"><img src={imagePreview} alt="Post preview" className="w-full max-h-56 rounded-xl object-cover" /><button type="button" onClick={() => { selectImage(null); setImagePreview(""); }} className="absolute top-2 right-2 rounded-full p-2" style={{ background: "rgba(11,10,8,.86)", color: C.ivory }} aria-label="Remove post image"><X size={14} /></button></div>}<button disabled={busy || (!caption.trim() && !imagePreview)} className="w-full mt-3 py-3 rounded-xl text-[12px] font-semibold disabled:opacity-40" style={{ background: C.gold, color: C.bg }}>{busy ? "Saving..." : editingId ? "Save draft changes" : "Create draft"}</button></form><div className="mt-5">{!posts.length ? <EmptyResourceCard label="No posts yet" description="Create a draft above, then publish it when ready." /> : posts.map((post) => <div key={post.id} className="py-3 border-b last:border-b-0" style={{ borderColor: C.line }}><div className="flex items-start gap-3">{post.image_url ? <img src={post.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl" style={{ background: C.card2 }} />}<div className="flex-1"><p className="text-[12px]" style={{ color: C.ivory }}>{post.caption || "Untitled post"}</p><p className="text-[10px] uppercase mt-1" style={{ color: post.status === "PUBLISHED" ? C.goldSoft : C.muted }}>{post.status}</p></div></div><div className="flex gap-2 mt-3"><button type="button" onClick={() => edit(post)} className="text-[11px]" style={{ color: C.gold }}>Edit</button>{post.status !== "PUBLISHED" && <button type="button" disabled={busy} onClick={() => changeStatus(post, "PUBLISHED")} className="text-[11px]" style={{ color: C.goldSoft }}>Publish</button>}{post.status === "PUBLISHED" && <button type="button" disabled={busy} onClick={() => changeStatus(post, "DRAFT")} className="text-[11px]" style={{ color: C.muted }}>Unpublish</button>}{post.status !== "ARCHIVED" && <button type="button" disabled={busy} onClick={() => changeStatus(post, "ARCHIVED")} className="text-[11px]" style={{ color: C.red }}>Archive</button>}<button type="button" disabled={busy} onClick={() => removePost(post)} className="text-[11px]" style={{ color: C.red }}>Delete</button></div></div>)}</div></div>;
}

function Profile({ nav, player, account, onAccountUpdated }) {
  const items = ["My Tickets", "Music Library", "Followed Artists", "Liked Music", "Recently Played", "Activity", "Preferences", "Notifications", "Security", "Help & Support"];
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ full_name: account?.profile?.full_name || "", phone: account?.profile?.phone || "", avatar_url: account?.profile?.avatar_url || "" });
  const [avatarFile, setAvatarFile] = useState(null);
  useEffect(() => { setForm({ full_name: account?.profile?.full_name || "", phone: account?.profile?.phone || "", avatar_url: account?.profile?.avatar_url || "" }); }, [account?.profile?.full_name, account?.profile?.phone, account?.profile?.avatar_url]);
  const signOut = async () => {
    setBusy(true);
    try { await supabase.auth.signOut(); nav.reset("login"); } finally { setBusy(false); }
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try { const avatar = avatarFile ? await uploadMediaFile(account?.user?.id, avatarFile, "AVATAR", "user_profiles", account?.user?.id) : null; const savedProfile = await updateProfile(account?.user?.id, { ...form, avatar_url: avatar?.public_url || form.avatar_url }); onAccountUpdated?.(savedProfile); setForm((current) => ({ ...current, ...savedProfile })); setMessage("Profile saved."); setAvatarFile(null); setEditing(false); } catch (error) { setMessage(error.message || "Unable to save profile."); } finally { setBusy(false); }
  };
  return (
    <Phone>
      <div className="px-5 pt-2 pb-4 flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-3">
          <span className="ev-display text-[22px]" style={{ color: C.ivory }}>Profile</span>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            aria-label="Log out of Atizzy"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold"
            style={{ color: busy ? C.muted : "#E98979", background: C.card, border: `1px solid ${C.line}` }}
          >
            <LogOut size={14} aria-hidden="true" />
            {busy ? "Signing out..." : "Log out"}
          </button>
        </div>
        <div className="w-20 h-20 rounded-full mb-3 overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.green})` }}>
          {account?.profile?.avatar_url && <img src={account.profile.avatar_url} alt="Profile avatar" className="w-full h-full object-cover" />}
        </div>
        <p className="text-[16px] font-semibold" style={{ color: C.ivory }}>{account?.profile?.full_name || account?.user?.email || "Atizzy member"}</p>
        <p className="text-[12px] flex items-center gap-1 mt-0.5" style={{ color: C.muted }}><MapPin size={11} />{account?.profile?.city || "Location not provided"}</p>
        <button onClick={() => { setMessage(""); setEditing((value) => !value); }} className="mt-3 px-4 py-2 rounded-xl text-[12px] font-semibold" style={{ background: C.card, color: C.goldSoft, border: `1px solid ${C.line}` }}>{editing ? "Close editor" : "Edit profile"}</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {editing && <form onSubmit={saveProfile} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <p className="text-[13px] font-semibold mb-3" style={{ color: C.ivory }}>Edit profile</p>
          {[['full_name','Name'],['phone','Phone']].map(([key, label]) => <label key={key} className="block mb-3"><span className="block text-[11px] mb-1" style={{ color: C.muted }}>{label}</span><input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-xl px-3 py-2 text-[13px] outline-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} placeholder={label} /></label>)}
          <MediaUploadField label="Profile photo" accept="image/jpeg,image/png,image/webp,image/gif" value={avatarFile} existingUrl={form.avatar_url} onChange={setAvatarFile} onRemove={() => setForm((current) => ({ ...current, avatar_url: "" }))} />
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl text-[12px] font-semibold" style={{ background: C.gold, color: C.bg }}>{busy ? "Saving..." : "Save changes"}</button>
          {message && <p className="text-[11px] mt-2" style={{ color: message === "Profile saved." ? C.green : "#E98979" }}>{message}</p>}
        </form>}
        {message && !editing && <p className="text-[11px] mb-3 text-center" style={{ color: C.green }}>{message}</p>}
        <PostWorkspace account={account} />
        {effectiveRoleCodes(account).length > 0 && <button onClick={() => nav.push("roleCenter")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Open workspace</span><ShieldCheck size={15} color={C.gold} /></button>}
        {hasEffectiveRole(account, "ARTIST") ? <button onClick={() => nav.push("artistWorkspace")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Artist Dashboard</span><ChevronRight size={15} color={C.gold} /></button> : <button onClick={() => nav.push("artistOnboarding")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Become an Artist</span><ChevronRight size={15} color={C.muted} /></button>}
        {assignedRoleCodes(account).some((role) => ["ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(role)) ? <button onClick={() => nav.push("organizerEvents")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Event Organizer Workspace</span><ChevronRight size={15} color={C.gold} /></button> : <button onClick={() => nav.push("organizerOnboarding")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Become an Event Organizer</span><ChevronRight size={15} color={C.muted} /></button>}
        {assignedRoleCodes(account).some((role) => ["VENUE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) ? <button onClick={() => nav.push("venueManager")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Venue Manager Workspace</span><ChevronRight size={15} color={C.muted} /></button> : <button onClick={() => nav.push("venueOnboarding")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Become a Venue Manager</span><ChevronRight size={15} color={C.muted} /></button>}
        {hasEffectiveRole(account, "EVENT_STAFF") && <button onClick={() => nav.push("eventStaff")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Event Staff Workspace</span><ChevronRight size={15} color={C.muted} /></button>}
        {hasEffectiveRole(account, "ARTIST") && <button aria-label="Golden verification active when verified" onClick={() => nav.push("artistVerification")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Get Verified</span><ShieldCheck size={15} color={C.gold} /></button>}
        {items.map((it) => (
          <button key={it} onClick={() => it === "My Tickets" ? nav.push("tickets") : it === "Music Library" ? nav.push("music") : ["Followed Artists", "Liked Music", "Recently Played", "Activity"].includes(it) ? nav.push("profileCollections", { initialTab: it }) : ["Preferences", "Notifications", "Help & Support"].includes(it) ? nav.push("userExperience", { initialTab: it }) : it === "Security" ? nav.push("security") : null} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}>
            <span className="text-[13.5px]" style={{ color: C.ivory }}>{it}</span>
            <ChevronRight size={15} color={C.muted} />
          </button>
        ))}
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onPrevious={player.previous} onNext={player.next} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="profile" go={nav.tab} />
    </Phone>
  );
}

/* ============================== ARTIST PROFILE ============================== */
function ArtistProfile({ nav, data, account, catalog }) {
  const [resolvedArtist, setResolvedArtist] = useState(data || null);
  const initialAvatar = data?.avatarUrl || data?.img || data?.image_url || data?.avatar_url || data?.profile_image_url || null;
  const initialBackground = data?.backgroundUrl || data?.coverUrl || data?.background_url || data?.background_image_url || data?.cover_url || null;
  const [loadingArtist, setLoadingArtist] = useState(Boolean(data?.id && !initialAvatar && !initialBackground));
  const a = resolvedArtist;
  const [following, setFollowing] = useState(false);
  useEffect(() => {
    let mounted = true;
    const knownAvatar = data?.avatarUrl || data?.img || data?.image_url || data?.avatar_url || data?.profile_image_url;
    const knownBackground = data?.backgroundUrl || data?.coverUrl || data?.background_url || data?.background_image_url || data?.cover_url;
    if (!data?.id || knownAvatar || knownBackground) { setResolvedArtist(data || null); setLoadingArtist(false); return () => { mounted = false; }; }
    setLoadingArtist(true);
    loadArtistDetail(data.id).then((artist) => { if (mounted && artist) setResolvedArtist(artist); }).catch(() => {}).finally(() => mounted && setLoadingArtist(false));
    return () => { mounted = false; };
  }, [data?.id]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Popular");
  useEffect(() => { if (a?.id && account?.user?.id) loadFavoriteState(account.user.id, null, a.id).then((state) => setFollowing(state.artistFollowing)).catch(() => {}); }, [a?.id, account?.user?.id]);
  if (loadingArtist) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Loading artist details...</div></Phone>;
  if (!a) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Artist details are unavailable.</div></Phone>;
  const avatarSource = a.avatarUrl || a.img || a.image_url || a.avatar_url || a.profile_image_url || null;
  const backgroundSource = a.backgroundUrl || a.coverUrl || a.background_url || a.background_image_url || a.cover_url || null;
  const toggleFollow = async () => { try { const next = !following; await toggleArtistFollow(account?.user?.id, a.id, next); setFollowing(next); } catch (followError) { setError(followError.message || "Unable to update follow."); } };
  return (
    <Phone>
      <div className="relative flex-shrink-0" style={{ height: 190, background: C.green, backgroundPosition: "center 35%" }}>
        {backgroundSource && <img src={backgroundSource} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #00000055 0%, #00000018 45%, #0B0A08 100%)" }} />
        <button onClick={nav.pop} className="relative z-10 w-9 h-9 mt-2 ml-5 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><ChevronLeft size={18} color="#fff" /></button>
        <div className="absolute z-10 -bottom-8 left-5 w-20 h-20 rounded-full border-4 overflow-hidden" style={{ background: C.wood, borderColor: C.bg }} aria-label={`${a.name} profile picture`}>
          {avatarSource && <img src={avatarSource} alt={`${a.name} profile picture`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
        </div>
      </div>
      <div className="px-5 pt-11">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-[19px] font-semibold" style={{ color: C.ivory }}>{a.name}</p>
          {a.verified && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: C.bg, background: C.gold }}><ShieldCheck size={12} color={C.bg} fill={C.bg} /> Verified</span>}
        </div>
        <p className="text-[12px] mb-4" style={{ color: C.muted }}>{a.followers || 0} Followers</p>
        <div className="flex gap-3 mb-5">
          <div className="flex-1"><GoldButton onClick={toggleFollow}>{following ? "Following" : "Follow"}</GoldButton></div>
          <button className="px-5 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ivory }}>Share</button>
        </div>
        {error && <AuthMessage error={error} />}
        <div className="flex gap-5 mb-4 overflow-x-auto no-scrollbar">
          {["Popular", "Songs", "Albums", "Events", "About"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className="text-[13px] pb-2 whitespace-nowrap" style={{ color: tab === t ? C.gold : C.muted, borderBottom: tab === t ? `2px solid ${C.gold}` : "2px solid transparent" }}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {songs.slice(0, 4).map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 py-2.5">
            <span className="w-4 text-[12px]" style={{ color: C.muted }}>{i + 1}</span>
            <div className="w-10 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.green})` }} />
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{s.title}</p>
              <p className="text-[11px]" style={{ color: C.muted }}>{s.plays} plays</p>
            </div>
            <span className="text-[11px]" style={{ color: C.muted }}>{s.duration}</span>
          </div>
        ))}
        <div className="pt-3 pb-6">
          <GhostButton onClick={() => nav.push("booking", a)}>Book Artist</GhostButton>
        </div>
      </div>
    </Phone>
  );
}

/* ============================== MUSIC HOME ============================== */
function MusicHome({ nav, player, catalog, account }) {
  const songs = catalog?.popularSongs || [];
  const artists = catalog?.popularArtists || [];
  const recentlyPlayed = catalog?.recentlyPlayed || [];
  const popularAlbums = catalog?.popularAlbums || [];
  const [favorites, setFavorites] = useState([]);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistMessage, setPlaylistMessage] = useState("");
  useEffect(() => { if (account?.user?.id) loadMusicFavorites(account.user.id).then(setFavorites).catch(() => {}); }, [account?.user?.id]);
  const toggleSongFavorite = async (songId) => {
    try { const next = !favorites.includes(songId); await toggleMusicFavorite(account?.user?.id, songId, next); setFavorites((current) => next ? [...current, songId] : current.filter((id) => id !== songId)); } catch (error) { setPlaylistMessage(error.message || "Sign in to save music."); }
  };
  const makePlaylist = async () => {
    try { const playlist = await createPlaylist(account?.user?.id, playlistName); setPlaylistName(""); setPlaylistMessage(`Playlist “${playlist.name}” created.`); } catch (error) { setPlaylistMessage(error.message || "Unable to create playlist."); }
  };
  return (
    <Phone>
      <div className="px-5 pt-1 pb-3">
        <h1 className="ev-display text-[22px]" style={{ color: C.ivory }}>{greeting()}</h1>
        <div className="flex gap-2 mt-3"><input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="New playlist name" className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none" style={{ background: C.card, color: C.ivory, border: `1px solid ${C.line}` }} /><button disabled={!playlistName.trim()} onClick={makePlaylist} className="rounded-xl px-3 text-[12px] disabled:opacity-40" style={{ background: C.gold, color: "#1A1408" }}>Create</button></div>
        {playlistMessage && <p className="text-[11px] mt-2" style={{ color: C.muted }}>{playlistMessage}</p>}
      </div>
      <div className="flex-1 overflow-y-auto">
        <Section title="Recently Played" nav={nav}>
          {recentlyPlayed.slice(0, 3).map((s) => (
            <button key={s.id} onClick={() => player.play(s)} className="flex-shrink-0 w-28 text-left">
              <div className="w-28 h-28 rounded-xl mb-2" style={imageStyle(s.coverUrl, `linear-gradient(135deg, ${C.wood}, ${C.green})`)} />
              <p className="text-[12px] font-semibold truncate" style={{ color: C.ivory }}>{s.title}</p>
              <p className="text-[10.5px] truncate" style={{ color: C.muted }}>{s.artist}</p>
            </button>
          ))}
          {!recentlyPlayed.length && [0, 1, 2].map((slot) => <EmptySongCard key={`recent-empty-${slot}`} />)}
        </Section>
        <div className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>Popular Songs</span>
          </div>
          <div className="px-5">
            {songs.map((s) => (
              <button key={s.id} onClick={() => player.play(s)} className="w-full flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-lg flex-shrink-0" style={imageStyle(s.coverUrl, `linear-gradient(135deg, ${C.wood}, ${C.green})`)} />
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{s.title}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>{s.artist}</p>
                </div>
                <span className="text-[11px]" style={{ color: C.muted }}>{s.duration}</span><span onClick={(event) => { event.stopPropagation(); toggleSongFavorite(s.id); }} className="px-1"><Heart size={15} color={favorites.includes(s.id) ? C.gold : C.muted} fill={favorites.includes(s.id) ? C.gold : "none"} /></span>
              </button>
            ))}
            {!songs.length && [0, 1, 2].map((slot) => <EmptySongRow key={`popular-song-empty-${slot}`} />)}
          </div>
        </div>
        <Section title="Popular Artists" nav={nav} last>
          {artists.map((a) => (
            <button key={a.id} onClick={() => nav.push("artist", a)} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
              <div className="w-16 h-16 rounded-full" style={imageStyle(a.img, C.card)} />
              <span className="text-[11px] truncate w-full text-center" style={{ color: C.ivory }}>{a.name}</span>
            </button>
          ))}
          {!artists.length && [0, 1, 2].map((slot) => <EmptyArtistCard key={`music-artist-empty-${slot}`} />)}
        </Section>
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onPrevious={player.previous} onNext={player.next} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="music" go={nav.tab} />
    </Phone>
  );
}

/* ============================== FULL MUSIC PLAYER ============================== */
function parseTimestampedLyrics(text) {
  if (!text) return [];
  return String(text).split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!match) return { text: line, time: null };
    const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
    return { text: match[4], time: Number(match[1]) * 60 + Number(match[2]) + fraction };
  });
}

function LyricsPage({ song, player }) {
  const lyrics = song?.lyricsText;
  const lines = parseTimestampedLyrics(lyrics);
  const hasTimestamps = lines.some((line) => line.time !== null);
  const activeLine = hasTimestamps ? lines.reduce((active, line, index) => line.time !== null && line.time <= Number(player.currentTime || 0) ? index : active, -1) : -1;
  return (
    <div className="h-full min-w-0 w-1/3 flex-shrink-0 flex flex-col px-6 pt-2 pb-7">
      <div className="flex-1 overflow-y-auto no-scrollbar py-5">
        <p className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: C.gold }}>Lyrics</p>
        <h2 className="text-[25px] font-semibold leading-tight" style={{ color: C.ivory }}>{song.title}</h2>
        <p className="text-[13px] mt-1 mb-8" style={{ color: C.muted }}>{song.artist}</p>
        {lyrics === undefined ? (
          <div className="flex min-h-[260px] items-center justify-center text-center px-8" style={{ color: C.muted }}>Lyrics are loading for this song.</div>
        ) : !String(lyrics || '').trim() ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center px-8">
            <div className="text-4xl mb-4">♫</div>
            <p className="text-[15px] font-medium" style={{ color: C.ivory }}>Lyrics aren&apos;t available for this song yet.</p>
            <p className="text-[12px] mt-2 leading-5" style={{ color: C.muted }}>Check back later — we&apos;re working on it.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {lines.map((line, index) => (
              <p key={`${line.time ?? 'plain'}-${index}`} className="text-[18px] leading-7 transition-colors" style={{ color: index === activeLine ? C.goldSoft : C.ivory, opacity: hasTimestamps && index !== activeLine ? 0.62 : 1, fontWeight: index === activeLine ? 700 : 500 }}>{line.text || " "}</p>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: C.line }}>
        <span className="text-[11px]" style={{ color: C.muted }}>Playing {formatPlaybackTime(player.currentTime)}</span>
        <span className="text-[11px]" style={{ color: C.muted }}>{formatPlaybackTime(player.duration)}</span>
      </div>
    </div>
  );
}

function MusicVideoPage({ song, player }) {
  const [loading, setLoading] = useState(Boolean(song?.musicVideoUrl));
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoading(Boolean(song?.musicVideoUrl)); setFailed(false); }, [song?.id, song?.musicVideoUrl]);
  const videoUrl = song?.musicVideoUrl;
  return (
    <div className="h-full min-w-0 w-1/3 flex-shrink-0 flex flex-col px-6 pt-2 pb-7">
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: C.gold }}>Music Video</p>
        <h2 className="text-[25px] font-semibold leading-tight" style={{ color: C.ivory }}>{song.title}</h2>
        <p className="text-[13px] mt-1 mb-7" style={{ color: C.muted }}>{song.artist}</p>
        {!videoUrl || failed ? (
          <div className="w-full aspect-video rounded-2xl flex flex-col items-center justify-center text-center px-8" style={{ background: `${C.card}cc`, border: `1px solid ${C.line}` }}>
            <div className="text-4xl mb-4">▣</div>
            <p className="text-[15px] font-medium" style={{ color: C.ivory }}>No music video available yet.</p>
            <p className="text-[12px] mt-2 leading-5" style={{ color: C.muted }}>We&apos;ll let you know when one is available.</p>
          </div>
        ) : (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden" style={{ background: C.card }}>
            <video src={videoUrl} controls playsInline preload="metadata" muted className="w-full h-full object-contain" onLoadStart={() => setLoading(true)} onLoadedData={() => setLoading(false)} onCanPlay={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} aria-label={`${song.title} music video`} />
            {loading && <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: `${C.card}dd`, color: C.muted }}>Loading music video…</div>}
          </div>
        )}
        <p className="text-[11px] mt-4 text-center" style={{ color: C.muted }}>Audio playback stays with the global Atizzy player.</p>
      </div>
      <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: C.line }}>
        <span className="text-[11px]" style={{ color: C.muted }}>Playing {formatPlaybackTime(player.currentTime)} independently of video controls</span>
        <span className="text-[11px]" style={{ color: C.muted }}>Use Now Playing for audio</span>
      </div>
    </div>
  );
}

function FullPlayer({ nav, player, account }) {
  const song = player.song;
  const [liked, setLiked] = useState(Boolean(song?.liked));
  const [page, setPage] = useState(0);
  const swipeStart = useRef(null);
  const totalDuration = Number(player.duration || 0);
  const progressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (Number(player.currentTime || 0) / totalDuration) * 100)) : 0;
  useEffect(() => { setLiked(Boolean(song?.liked)); }, [song?.id, song?.liked]);
  const seekFromProgress = (event) => {
    if (!totalDuration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = bounds.width ? Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) : 0;
    player.seek(ratio * totalDuration);
  };
  const seekWithKeyboard = (event) => {
    if (!totalDuration) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); player.seek(Math.max(0, Number(player.currentTime || 0) - 5)); }
    if (event.key === "ArrowRight") { event.preventDefault(); player.seek(Math.min(totalDuration, Number(player.currentTime || 0) + 5)); }
  };
  const handleSwipeStart = (event) => {
    if (event.target.closest?.("button, [role=slider], a, input, textarea, video")) { swipeStart.current = null; return; }
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const handleSwipeEnd = (event) => {
    if (!swipeStart.current || event.target.closest?.("button, [role=slider], a, input, textarea, video")) return;
    const start = swipeStart.current;
    swipeStart.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    setPage((current) => Math.max(0, Math.min(2, current + (dx < 0 ? 1 : -1))));
  };
  const toggleLike = async () => {
    if (!song?.id || !account?.user?.id) return;
    const next = !liked;
    try { await toggleMusicFavorite(account.user.id, song.id, next); setLiked(next); } catch {}
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: song?.title || "Atizzy music", text: song?.artist || "", url });
    else if (navigator.clipboard) await navigator.clipboard.writeText(url);
  };
  if (!song) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Choose a song from the live music library to start playback.</div></Phone>;
  return (
    <Phone>
      <div className="flex-1 flex flex-col px-6" style={{ background: `linear-gradient(180deg, ${C.green}, ${C.bg} 60%)` }} onPointerDown={handleSwipeStart} onPointerUp={handleSwipeEnd} onPointerCancel={() => { swipeStart.current = null; }}>
        <div className="flex items-center justify-center gap-1.5 pt-2 pb-3" aria-label="Now Playing pages">
          {["Now Playing", "Lyrics", "Music Video"].map((label, index) => <button key={label} type="button" onClick={() => setPage(index)} aria-label={`Show ${label}`} className="h-1.5 rounded-full" style={{ width: index === page ? 18 : 6, background: index === page ? C.gold : C.line }} />)}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="flex h-full transition-transform duration-300 ease-out" style={{ width: "300%", transform: `translateX(-${page * (100 / 3)}%)` }}>
            <div className="h-full min-w-0 w-1/3 flex-shrink-0 flex flex-col px-6 overflow-y-auto">
              <div className="flex items-center justify-between pt-2 pb-6">
                <button onClick={nav.pop} aria-label="Close now playing"><ChevronDown size={20} color={C.ivory} /></button>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>Now Playing</span>
                <button type="button" onClick={() => nav.push("music")} aria-label="Open music library"><ListMusic size={18} color={C.ivory} /></button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center pb-2">
              <div className="w-full aspect-square rounded-2xl mb-8" style={imageStyle(song.coverUrl, `linear-gradient(150deg, ${C.wood}, ${C.greenLight})`)} />
              <div className="w-full flex items-center justify-between mb-6">
                <div><p className="text-[19px] font-semibold" style={{ color: C.ivory }}>{song.title}</p><p className="text-[13px]" style={{ color: C.muted }}>{song.artist}</p></div>
                <button type="button" onClick={toggleLike} aria-label={liked ? "Unlike song" : "Like song"}><Heart size={20} color={liked ? C.gold : C.muted} fill={liked ? C.gold : "none"} /></button>
              </div>
              <div className="w-full mb-2">
                <div className="w-full h-1 rounded-full cursor-pointer" style={{ background: C.line }} role="slider" tabIndex={0} aria-label="Seek through song" aria-valuemin={0} aria-valuemax={Math.floor(totalDuration)} aria-valuenow={Math.floor(Number(player.currentTime || 0))} onClick={seekFromProgress} onKeyDown={seekWithKeyboard}><div className="h-1 rounded-full" style={{ width: `${progressPercent}%`, background: C.gold }} /></div>
                <div className="flex justify-between mt-1.5"><span className="text-[10.5px]" style={{ color: C.muted }}>{formatPlaybackTime(player.currentTime)}</span><span className="text-[10.5px]" style={{ color: C.muted }}>{formatPlaybackTime(totalDuration)}</span></div>
              </div>
              <div className="w-full flex items-center justify-between mt-6">
                <Shuffle size={17} color={C.muted} /><button type="button" onClick={player.previous} aria-label="Previous song"><SkipBack size={22} color={C.ivory} /></button><button disabled={!song.audioUrl} onClick={player.toggle} aria-label={player.playing ? "Pause song" : "Play song"} className="w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${C.goldSoft}, ${C.gold})` }}>{player.playing ? <Pause size={24} color="#1A1408" /> : <Play size={24} color="#1A1408" fill="#1A1408" />}</button><button type="button" onClick={player.next} aria-label="Next song"><SkipForward size={22} color={C.ivory} /></button><Repeat size={17} color={C.muted} />
              </div>
              </div>
              <div className="flex items-center justify-between pb-8 pt-4">
                <button type="button" onClick={share} aria-label="Share song"><Share2 size={17} color={C.muted} /></button>
                <button type="button" onClick={() => nav.push("music")} className="text-[11px]" style={{ color: C.muted }}>Add to Playlist</button>
                <button type="button" onClick={() => nav.push("music")} aria-label="Open playlists"><ListMusic size={17} color={C.muted} /></button>
              </div>
            </div>
            <LyricsPage song={song} player={player} />
            <MusicVideoPage song={song} player={player} />
          </div>
        </div>
      </div>
    </Phone>
  );
}

/* ============================== ARTIST BOOKING (bonus, quick) ============================== */
function Booking({ nav, data, account }) {
  const a = data;
  const [form, setForm] = useState({ event_name: "", event_type: "", event_date: "", expected_audience: "", budget: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!a) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Artist details are unavailable.</div></Phone>;
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async () => {
    setBusy(true); setError("");
    try { await submitBooking(account?.user?.id, a.id, form); nav.pop(); } catch (bookingError) { setError(bookingError.message || "Unable to submit booking request."); } finally { setBusy(false); }
  };
  return (
    <Phone>
      <TopBack title="Book Artist" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <div className="flex items-center gap-3 rounded-2xl p-4 mb-5" style={{ background: C.card }}>
          <div className="w-12 h-12 rounded-full" style={{ background: a.img }} />
          <div>
            <p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>{a.name}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>Booking requests are reviewed by the artist team.</p>
          </div>
        </div>
        <Field label="Event Name" placeholder="e.g. Company End-of-Year Party" value={form.event_name} onChange={update("event_name")} />
        <Field label="Event Type" placeholder="Corporate, Wedding, Concert..." value={form.event_type} onChange={update("event_type")} />
        <Field label="Date" placeholder="Select date" value={form.event_date} onChange={update("event_date")} />
        <Field label="Expected Audience" placeholder="e.g. 500" value={form.expected_audience} onChange={update("expected_audience")} />
        <Field label="Budget (₦)" placeholder="e.g. 1,000,000" value={form.budget} onChange={update("budget")} />
        <Field label="Message" placeholder="Tell us more about the event..." value={form.message} onChange={update("message")} />
        <AuthMessage error={error} />
      </div>
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <GoldButton disabled={busy || !form.event_name || !form.event_date} onClick={submit}>{busy ? "Sending..." : "Send Booking Request"}</GoldButton>
      </div>
    </Phone>
  );
}

/* ============================== VENUE / MUSIC / ACCOUNT DETAIL ============================== */
function VenueDetail({ nav, data }) {
  const [state, setState] = useState({ venue: data || null, events: [] });
  const [loading, setLoading] = useState(Boolean(data?.id));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!data?.id) return;
    let active = true;
    setLoading(true);
    loadVenueDetail(data.id).then((result) => { if (active) setState(result); }).catch((loadError) => { if (active) setError(loadError.message || "Unable to load venue details."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [data?.id]);
  const venue = state.venue;
  return <Phone><TopBack title="Venue" onBack={nav.pop} /> <div className="flex-1 overflow-y-auto px-5 pb-6">{loading && <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Loading venue...</p>}{error && <AuthMessage error={error} />}{venue && <><div className="rounded-2xl p-5 mb-5" style={{ ...imageStyle(venue?.imageUrl, `linear-gradient(145deg, ${C.wood}, ${C.card})`), backgroundBlendMode: "overlay" }}><MapPin size={22} color={C.gold} /><h1 className="ev-display text-2xl mt-3" style={{ color: C.ivory }}>{venue.name}</h1><p className="text-[12px] mt-1" style={{ color: C.muted }}>{venue.address || venue.city || "Location pending"}</p><p className="text-[11px] mt-3" style={{ color: C.goldSoft }}>Capacity {venue.capacity ? Number(venue.capacity).toLocaleString() : "pending"}</p></div><p className="text-[12px] font-semibold mb-3" style={{ color: C.muted }}>EVENTS AT THIS VENUE</p>{state.events.map((event) => <div key={event.id} className="mb-3"><EventCard ev={event} wide onClick={() => nav.push("eventDetail", event)} /></div>)}{!loading && !state.events.length && <p className="py-6 text-center text-[13px]" style={{ color: C.muted }}>No published events at this venue yet.</p>}</>}</div></Phone>;
}

function MusicDetail({ nav, data, player, account }) {
  const song = data;
  const [liked, setLiked] = useState(false);
  useEffect(() => { if (account?.user?.id && song?.id) loadFavoriteState(account.user.id, null, song.id).then((state) => setLiked(Boolean(state.musicFavorite))).catch(() => {}); }, [account?.user?.id, song?.id]);
  if (!song) return <Phone><div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: C.muted }}>Music details are unavailable.</div></Phone>;
  const toggleLike = async () => { if (!account?.user?.id) return nav.push("login"); const next = !liked; setLiked(next); try { await toggleMusicFavorite(account.user.id, song.id, next); } catch { setLiked(!next); } };
  return <Phone><TopBack title="Music Detail" onBack={nav.pop} right={<button onClick={toggleLike}><Heart size={18} color={liked ? C.gold : C.ivory} fill={liked ? C.gold : "none"} /></button>} /><div className="flex-1 overflow-y-auto px-5 pb-6"><div className="aspect-square rounded-3xl mb-5" style={imageStyle(song.coverUrl, `linear-gradient(145deg, ${C.green}, ${C.wood})`)} /><h1 className="ev-display text-2xl" style={{ color: C.ivory }}>{song.title}</h1><p className="text-[13px] mt-1" style={{ color: C.goldSoft }}>{song.artist}</p><p className="text-[11px] mt-2" style={{ color: C.muted }}>{song.plays || "0"} plays · {song.duration}</p><div className="mt-6"><GoldButton onClick={() => { player.play(song); recordPlay(account?.user?.id, song.id).catch(() => {}); }}> <Play size={15} fill="#1A1408" className="inline mr-2" /> Play now</GoldButton></div><div className="mt-4"><GhostButton onClick={() => nav.push("musicPlayer", song)}>Open full player</GhostButton></div><EngagementPanel targetType="SONG" targetId={song.id} account={account} /></div></Phone>;
}

function SecurityScreen({ nav, account }) {
  return <Phone><TopBack title="Security" onBack={nav.pop} /><div className="flex-1 overflow-y-auto px-5 pb-6"><div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}><div className="flex items-center gap-3"><ShieldCheck size={22} color={C.gold} /><div><p className="font-semibold text-[14px]" style={{ color: C.ivory }}>Account security</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Your session is protected by Atizzy authentication.</p></div></div></div><p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>AUTHENTICATION METHODS</p><div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}><p className="text-[13px]" style={{ color: C.ivory }}>{account?.user?.email || "Authenticated account"}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>Primary email login</p></div><p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>ACTIVE SESSION</p><div className="rounded-2xl p-4" style={{ background: C.card }}><p className="text-[13px]" style={{ color: C.ivory }}>Current device</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>This session is active and monitored.</p></div></div></Phone>;
}

function NotificationBoard({ nav, account }) {
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => { if (account?.user?.id) loadUserExperienceSnapshot().then(setSnapshot).catch(() => {}); }, [account?.user?.id]);
  const notifications = snapshot?.notifications || [];
  return <Phone><TopBack title="Notifications" onBack={nav.pop} right={<button onClick={() => markAllUserNotificationsRead().then(() => loadUserExperienceSnapshot().then(setSnapshot))}><Check size={17} color={C.gold} /></button>} /><div className="flex-1 overflow-y-auto px-5 pb-6">{notifications.map((item) => <button key={item.id} onClick={() => { markUserNotificationRead(item.id).catch(() => {}); const deepLink = item.deep_link || item.metadata?.deep_link; if (deepLink) nav.push(deepLink.screen || "userExperience", deepLink.data); }} className="ev-card w-full text-left rounded-2xl p-4 mb-3" style={{ background: item.read_at ? C.card : `linear-gradient(135deg, ${C.woodLight}55, ${C.card})`, border: `1px solid ${item.read_at ? C.line : C.gold + "55"}` }}><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{item.title || "Atizzy update"}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{item.body || item.message || "Open to view details."}</p></button>)}{!notifications.length && <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>You have no notifications.</p>}</div></Phone>;
}

/* ============================== APP SHELL / ROUTER ============================== */
function ProfileCollections({ nav, account, initialTab = "Followed Artists" }) {
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState({ followedArtists: [], likedMusic: [], recentlyPlayed: [], activity: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => { let mounted = true; loadUserCollections(account?.user?.id).then((value) => mounted && setData(value)).catch(() => mounted && setData({ followedArtists: [], likedMusic: [], recentlyPlayed: [], activity: [] })).finally(() => mounted && setLoading(false)); return () => { mounted = false; }; }, [account?.user?.id]);
  const tabs = ["Followed Artists", "Liked Music", "Recently Played", "Activity"];
  const rows = tab === "Followed Artists" ? data.followedArtists : tab === "Liked Music" ? data.likedMusic : tab === "Recently Played" ? data.recentlyPlayed : data.activity;
  return <Phone><TopBack title="Your Activity" onBack={nav.pop} /><div className="px-5 pt-2 pb-3"><div className="flex gap-2 overflow-x-auto no-scrollbar">{tabs.map((item) => <Pill key={item} active={tab === item} onClick={() => setTab(item)}>{item}</Pill>)}</div></div><div className="flex-1 overflow-y-auto px-5">{loading ? <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>Loading your activity...</p> : !rows.length ? <EmptyResourceCard label={`No ${tab.toLowerCase()} yet`} description="Your live activity will appear here as you follow artists, like music, and use Atizzy." /> : rows.map((row) => <button key={row.id || `${row.type}-${row.created_at}`} onClick={() => row.artist_id ? nav.push("artist", { id: row.artist_id }) : row.song_id ? nav.push("musicDetail", row) : row.event_id ? nav.push("eventDetail", row) : null} className="ev-card w-full text-left rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{row.name || row.title || row.label || row.action || "Activity"}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{row.name ? "Followed artist" : row.title ? "Music" : row.action || "Recent activity"}</p></button>)}</div></Phone>;
}

export default function EventVerseApp() {
  const [stack, setStack] = useState(() => {
    const completed = typeof window !== "undefined" && window.localStorage.getItem("eventverse:onboarding-complete") === "1";
    const sharedEventId = typeof window !== "undefined" ? window.location.pathname.match(/^\/events\/([^/]+)/)?.[1] : null;
    return [{ screen: sharedEventId ? "eventDetail" : (completed ? "login" : "onboarding"), data: sharedEventId ? { id: decodeURIComponent(sharedEventId) } : null }];
  });
  const [song, setSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState({ currentTime: 0, duration: 0 });
  const audioControllerRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [authReady, setAuthReady] = useState(false);
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [account, setAccount] = useState({ user: null, profile: null, roles: [] });
  const [roleDashboard, setRoleDashboard] = useState({ events: [], bookings: [], venues: [], songs: [], orders: [] });
  const refreshAccount = async () => {
    const nextAccount = await loadCurrentUser();
    setAccount(nextAccount);
    return nextAccount;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setCatalogLoading(true);
      try {
        const liveCatalog = await loadCatalog();
        let location = { latitude: null, longitude: null };
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          location = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
              () => resolve({ latitude: null, longitude: null }),
              { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 },
            );
          });
        }
        let discovery = null;
        try {
          discovery = await loadDiscoverySnapshot(location);
        } catch (discoveryError) {
          console.error("Atizzy live discovery snapshot failed", discoveryError);
          if (mounted) setCatalogError(discoveryError.message || "Unable to load live discovery.");
        }
        const merged = discovery ? {
          ...liveCatalog,
          discovery,
          events: discovery.events.length ? discovery.events : liveCatalog.events,
          artists: discovery.popularArtists.length ? discovery.popularArtists : liveCatalog.artists,
          songs: discovery.popularSongs.length ? discovery.popularSongs : liveCatalog.songs,
          venues: discovery.popularVenues.length ? discovery.popularVenues : liveCatalog.venues,
          upcomingEvents: discovery.upcomingEvents,
          popularArtists: discovery.popularArtists,
          trendingEvents: discovery.trendingEvents,
          nearbyEvents: discovery.nearbyEvents,
          popularVenues: discovery.popularVenues,
          recentlyPlayed: discovery.recentlyPlayed,
          personalMostPlayed: discovery.personalMostPlayed,
          platformMostPlayed: discovery.platformMostPlayed,
          popularSongs: discovery.popularSongs,
          popularAlbums: discovery.popularAlbums,
          mostLikedSongs: discovery.mostLikedSongs,
          mostLikedArtists: discovery.mostLikedArtists,
          mostWatchedMusicVideos: discovery.mostWatchedMusicVideos,
          privatePlaylists: discovery.privatePlaylists,
          publicPlaylists: discovery.publicPlaylists,
        } : liveCatalog;
        if (mounted) setCatalog(normalizeCatalog(merged));
      } catch (error) {
        if (mounted) setCatalogError(error.message || "Unable to load live catalog.");
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    };
    const restore = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const callbackError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) console.error("EventVerse OAuth callback exchange failed", exchangeError);
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
        }
        if (callbackError) console.error("EventVerse OAuth callback returned an error", callbackError);
        const { data } = await supabase.auth.getSession();
        const sharedEventId = url.pathname.match(/^\/events\/([^/]+)/)?.[1] ? decodeURIComponent(url.pathname.match(/^\/events\/([^/]+)/)[1]) : null;
        const paymentCallback = url.searchParams.get("payment") === "callback";
        const artistPaymentCallback = url.searchParams.get("artist-payment") === "callback";
        const callbackReference = url.searchParams.get("reference") || url.searchParams.get("trxref");
        const storedPendingPayment = paymentCallback ? JSON.parse(window.localStorage.getItem("atizzy:pending-payment") || "null") : null;
        const pendingPayment = storedPendingPayment ? { ...storedPendingPayment, payment: { ...storedPendingPayment.payment, providerReference: callbackReference || storedPendingPayment.payment?.providerReference, reference: callbackReference || storedPendingPayment.payment?.reference } } : null;
        const pendingArtistPayment = artistPaymentCallback ? JSON.parse(window.localStorage.getItem("atizzy:pending-artist-payment") || "null") : null;
        if (paymentCallback || artistPaymentCallback) {
          url.searchParams.delete("payment");
          url.searchParams.delete("artist-payment");
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
        }
        if (mounted && data.session) {
          window.localStorage.setItem("eventverse:onboarding-complete", "1");
          setStack([{ screen: pendingArtistPayment ? "artistProcessing" : (pendingPayment ? "processing" : (sharedEventId ? "eventDetail" : "home")), data: pendingArtistPayment || pendingPayment || (sharedEventId ? { id: sharedEventId } : null) }]);
          void ensureUserProfile(data.session.user);
        }
      } catch (restoreError) {
        console.error("EventVerse auth restore failed", restoreError);
      } finally {
        if (mounted) setAuthReady(true);
      }
    };
    // Subscribe before restoring the session. With implicit OAuth, Supabase can emit
    // INITIAL_SESSION/SIGNED_IN during URL-fragment processing; subscribing afterward
    // can miss the event and leave the user on Login even though the provider succeeded.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || !session) return;
      // Defer profile I/O outside Supabase's auth event callback to avoid re-entrant locks.
      setTimeout(async () => {
        await ensureUserProfile(session.user);
        const value = await loadCurrentUser().catch(() => null);
        if (mounted && value) setAccount(value);
      }, 0);
      if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event)) {
        setStack((currentStack) => {
          const active = currentStack[currentStack.length - 1]?.screen;
          return ["onboarding", "login", "signup", "verify"].includes(active) ? [{ screen: "home", data: null }] : currentStack;
        });
      }
    });
    load();
    loadCurrentUser().then((value) => { if (mounted) setAccount(value); }).catch((error) => { if (mounted) setCatalogError(error.message || "Unable to load account."); });
    restore();
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const roles = effectiveRoleCodes(account);
    if (!account?.user?.id || !roles.length) { setRoleDashboard({ events: [], bookings: [], venues: [], songs: [], orders: [] }); return; }
    loadRoleDashboard(account.user.id, roles).then(setRoleDashboard).catch((error) => setCatalogError(error.message || "Unable to load workspace data."));
  }, [account?.user?.id, account?.effectiveRoles, account?.roles]);

  const current = stack[stack.length - 1];

  const nav = {
    push: (screen, data) => setStack((s) => [...s, { screen, data }]),
    pop: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    replace: (screen, data) => setStack((s) => [...s.slice(0, -1), { screen, data }]),
    reset: (screen, data) => setStack([{ screen, data }]),
    tab: (screen) => setStack([{ screen, data: null }]),
  };

  const player = {
    song,
    playing,
    queue,
    currentTime: playback.currentTime,
    duration: playback.duration,
    play: (s, nextQueue = catalog?.popularSongs?.length ? catalog.popularSongs : catalog?.songs || []) => { setQueue(nextQueue.length ? nextQueue : [s]); setSong(s); setPlayback({ currentTime: 0, duration: 0 }); setPlaying(true); },
    toggle: () => (song ? setPlaying((p) => !p) : null),
    seek: (seconds) => audioControllerRef.current?.seekTo(seconds),
    previous: () => { const index = queue.findIndex((item) => item.id === song?.id); if (index > 0) { setSong(queue[index - 1]); setPlayback({ currentTime: 0, duration: 0 }); setPlaying(true); } },
    next: () => { const index = queue.findIndex((item) => item.id === song?.id); if (index >= 0 && index < queue.length - 1) { setSong(queue[index + 1]); setPlayback({ currentTime: 0, duration: 0 }); setPlaying(true); } },
  };

  const screens = {
    onboarding: <Onboarding nav={nav} />,
    login: <Login nav={nav} />,
    signup: <Signup nav={nav} />,
    verify: <Verify nav={nav} data={current.data} />,
    home: <AttendeeHome nav={nav} player={player} catalog={catalog} account={account} loading={catalogLoading} error={catalogError} />,
    explore: <Explore nav={nav} player={player} catalog={catalog} loading={catalogLoading} error={catalogError} />,
        search: <SearchScreen nav={nav} catalog={catalog} account={account} />,
    eventDetail: <EventDetail nav={nav} data={current.data} account={account} />,
    venueDetail: <VenueDetail nav={nav} data={current.data} />,
    musicDetail: <MusicDetail nav={nav} data={current.data} player={player} account={account} />,
    notifications: <NotificationBoard nav={nav} account={account} />,
    security: <SecurityScreen nav={nav} account={account} />,
    tickets: <TicketSelection nav={nav} data={current.data} />,
    checkout: <Checkout nav={nav} data={current.data} />,
    payment: <Payment nav={nav} data={current.data} />,
    processing: <Processing nav={nav} data={current.data} />,
    success: <PaymentSuccess nav={nav} data={current.data} />,
    checkIn: <CheckInScreen nav={nav} data={current.data} />,
    roleCenter: <RoleCenter nav={nav} account={account} data={current.data} />,    roleCapabilities: <RoleCapabilities nav={nav} account={account} />,    adminControlCenter: <GovernanceDashboard nav={nav} account={account} onAccountUpdated={refreshAccount} />,    governanceDashboard: <GovernanceDashboard nav={nav} account={account} onAccountUpdated={refreshAccount} />,    adminWorkspace: <AdminWorkspace nav={nav} account={account} />,
    artistWorkspace: <ArtistWorkspace nav={nav} account={account} catalog={catalog} />,
    artistOnboarding: <ArtistOnboarding nav={nav} account={account} mode="REGISTRATION" />,
    artistVerification: <ArtistOnboarding nav={nav} account={account} mode="VERIFICATION" />,
    artistProcessing: <ArtistPaymentProcessing nav={nav} data={current.data} />,
    artistAdminSettings: <ArtistAdminSettings nav={nav} account={account} />,
    organizerOnboarding: <OrganizerOnboarding nav={nav} account={account} />,
    organizerEvents: <OrganizerEvents nav={nav} account={account} />,
    venueOnboarding: <VenueManagerOnboarding nav={nav} account={account} />,
    venueManager: <VenueManagerWorkspace nav={nav} account={account} />,
    eventStaff: <EventStaffWorkspace nav={nav} account={account} />,
    eventStaffTasks: <EventStaffTasks nav={nav} data={current.data} />,
    artistLibrary: <ArtistMusicLibrary nav={nav} account={account} />,
    digitalTicket: <DigitalTicket nav={nav} data={current.data} />,
    myTickets: <MyTickets nav={nav} player={player} />,
    tickets_tab: null,
    profile: <Profile nav={nav} player={player} account={account} onAccountUpdated={(profile) => setAccount((current) => ({ ...current, profile: { ...current.profile, ...profile } }))} />,
    userExperience: <UserExperience nav={nav} account={account} initialTab={current.data?.initialTab || "Preferences"} />, profileCollections: <ProfileCollections nav={nav} account={account} initialTab={current.data?.initialTab || "Followed Artists"} />,
    artist: <ArtistProfile nav={nav} data={current.data} account={account} catalog={catalog} />,
    booking: <Booking nav={nav} data={current.data} account={account} />,
    music: <MusicHome nav={nav} player={player} catalog={catalog} account={account} />,
    musicPlayer: <FullPlayer nav={nav} player={player} account={account} />,
  };
  // "tickets" tab in bottom nav should show MyTickets, not ticket selector — route it explicitly.
  if (current.screen === "tickets" && !current.data) screens.tickets = <MyTickets nav={nav} player={player} />;

  if (!authReady) return <div className="ev-app-viewport flex min-h-screen items-center justify-center" style={{ background: C.bg, color: C.goldSoft }}>Loading Atizzy...</div>;

  return (
    <div className="ev-app-viewport flex min-h-screen w-full items-stretch justify-stretch overflow-hidden" style={{ background: C.bg, minHeight: "100dvh", width: "100dvw" }}>
      <style>{font}</style>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none} .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      <AudioController ref={audioControllerRef} song={song} playing={playing} setPlaying={setPlaying} userId={account?.user?.id} onProgress={setPlayback} />
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden" style={{ background: C.bg, minHeight: "100dvh", width: "100dvw" }}>
        {screens[current.screen] || screens.home}
      </div>
    </div>
  );
}
