import React, { useState, useRef, useEffect } from "react";
import {
  Search, Bell, Menu, ChevronLeft, ChevronRight, Play, Pause,
  SkipBack, SkipForward, Heart, Share2, Star, MapPin, Calendar,
  Clock, Minus, Plus, Check, ShieldCheck, Home, Compass, Music2,
  Ticket, User, X, QrCode, Shuffle, Repeat, ListMusic, ChevronDown,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { loadCatalog, loadEventDetail, searchCatalog, formatFollowers } from "./services/catalog";
import CheckInScreen from "./components/CheckInScreen";
import { loadCurrentUser, loadFavoriteState, toggleEventFavorite, toggleArtistFollow, toggleMusicFavorite, loadMusicFavorites, recordPlay, loadPlaylists, createPlaylist, submitBooking, loadRoleDashboard, issueTicketQrToken } from "./services/user";
import QRCode from "qrcode";

/* ============================== DESIGN TOKENS ==============================
   Black (bg)        #0B0A08  — dominant surface
   Charcoal (card)    #17140F  — cards / inputs / secondary surface
   Deep blue (panel)  #12141C  — subtle depth on select panels
   Wood (premium)     #3A2A1B  — premium / selected / ticket surfaces
   Green (music)      #16261D  — music accents, artist imagery overlay
   Gold (accent)      #CDA349  — CTAs, active states, premium markers
   Ivory (text)       #F3EEE3  — primary text
============================================================================ */
const C = {
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
};

async function ensureUserProfile(user) {
  if (!user?.id) return;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null;
  const { error } = await supabase.from("user_profiles").upsert(
    { id: user.id, full_name: fullName, avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null },
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
const EMPTY_CATALOG = { events: [], artists: [], songs: [], categories: [], venues: [] };
const categoryLabel = (category) => category?.name || category?.slug || "Uncategorized";
const imageStyle = (url, fallback = C.card) => url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: fallback };

const money = (n) => `\u20A6${Number(n || 0).toLocaleString()}`;
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; };

/* ============================== SHARED UI ============================== */
function Phone({ children }) {
  return (
    <div
      className="ev-root relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
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
      {children}
    </div>
  );
}

function TopBack({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
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
      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition"
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

function EventCard({ ev, onClick, wide }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 text-left rounded-2xl overflow-hidden" style={{ width: wide ? "100%" : 168, background: C.card }}>
      <div className="relative" style={{ height: wide ? 150 : 100, background: ev.img }}>
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
    <div className="flex-shrink-0 text-left rounded-2xl overflow-hidden" style={{ width: wide ? "100%" : 168, background: C.card, opacity: 0.78 }}>
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
    <div className="flex items-center justify-around px-2 py-2.5 border-t" style={{ background: C.bg, borderColor: C.line }}>
      {items.map((it) => {
        const active = current === it.id;
        return (
          <button key={it.id} onClick={() => go(it.id)} className="flex flex-col items-center gap-1 px-2">
            <it.icon size={19} color={active ? C.gold : C.muted} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[10px]" style={{ color: active ? C.gold : C.muted }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MiniPlayer({ song, playing, onToggle, onOpen }) {
  if (!song) return null;
  return (
    <button onClick={onOpen} className="mx-3 mb-2 rounded-2xl px-3 py-2.5 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.card})`, border: `1px solid ${C.line}` }}>
      <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${C.greenLight}, ${C.gold}55)` }} />
      <div className="flex-1 text-left min-w-0">
        <p className="text-[12.5px] font-semibold truncate" style={{ color: C.ivory }}>{song.title}</p>
        <p className="text-[11px] truncate" style={{ color: C.muted }}>{song.artist}</p>
      </div>
      <SkipBack size={15} color={C.muted} />
      <span onClick={(e) => { e.stopPropagation(); onToggle(); }} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.gold }}>
        {playing ? <Pause size={14} color="#1A1408" /> : <Play size={14} color="#1A1408" fill="#1A1408" />}
      </span>
      <SkipForward size={15} color={C.muted} />
    </button>
  );
}

function AudioController({ song, playing, setPlaying, userId }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (!song?.audioUrl) { if (audioRef.current) audioRef.current.pause(); return; }
    const audio = new Audio(song.audioUrl);
    audioRef.current = audio;
    const ended = () => { setPlaying(false); void recordPlay(userId, song.id, Number(song.duration_seconds || 0)); };
    audio.addEventListener("ended", ended);
    if (playing) audio.play().catch(() => setPlaying(false));
    return () => { audio.removeEventListener("ended", ended); audio.pause(); audioRef.current = null; };
  }, [song?.id, song?.audioUrl]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!song?.audioUrl) { setPlaying(false); return; }
    if (playing) audio.play().catch(() => setPlaying(false)); else audio.pause();
  }, [playing, song?.audioUrl]);
  return null;
}

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
  const artists = catalog?.artists || [];
  const categories = [{ name: "All" }, ...(catalog?.categories || [])];
  const displayName = account?.profile?.full_name || account?.user?.user_metadata?.full_name || account?.user?.email?.split("@")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const liveLocation = events.find((event) => event.city || event.venues?.city)?.city || events.find((event) => event.venues?.city)?.venues?.city || "Location unavailable";
  return (
    <Phone>
      <div className="flex items-center justify-between px-5 pt-1 pb-3">
        <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.card }}><Menu size={17} color={C.ivory} /></button>
        <div className="text-center">
          <p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>{greeting}, {displayName} 👋</p>
          <p className="text-[11px] flex items-center justify-center gap-1" style={{ color: C.muted }}><MapPin size={10} />{liveLocation}</p>
        </div>
        <button className="w-9 h-9 rounded-full flex items-center justify-center relative" style={{ background: C.card }}>
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
          {loading && <p className="text-[13px] py-3 text-center" style={{ color: C.muted }}>Loading live events...</p>}
          {!loading && error && <AuthMessage error={error} />}
          {events[0] ? <EventCard ev={events[0]} wide onClick={() => nav.push("eventDetail", events[0])} /> : <EmptyEventCard wide />}
          {!loading && !error && !events.length && <p className="text-[11px] mt-2 text-center" style={{ color: C.muted }}>Featured event content will appear here when published.</p>}
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
            <button className="text-[12px]" style={{ color: C.gold }}>See all</button>
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
            {(catalog?.songs || []).slice(0, 4).map((song) => <button key={song.id} onClick={() => nav.push("musicPlayer", song)} className="flex-shrink-0 w-36 rounded-2xl p-3 text-left" style={{ background: C.card, border: `1px solid ${C.line}` }}><div className="h-24 rounded-xl" style={imageStyle(song.coverUrl, C.card)} /><p className="text-[12px] font-semibold mt-2 truncate" style={{ color: C.ivory }}>{song.title}</p><p className="text-[11px] mt-1 truncate" style={{ color: C.muted }}>{song.artist}</p></button>)}
            {!(catalog?.songs || []).length && [0, 1, 2].map((slot) => <EmptySongCard key={`song-empty-${slot}`} />)}
          </div>
        </div>
      </div>

      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="home" go={nav.tab} />
    </Phone>
  );
}

/* ============================== EXPLORE ============================== */
function Explore({ nav, player, catalog }) {
  const [cat, setCat] = useState("All");
  const events = catalog?.events || [];
  const categories = [{ name: "All" }, ...(catalog?.categories || [])];
  const venues = catalog?.venues || [];
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
            {events.slice(0, 3).map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
            {!events.length && [0, 1, 2].map((slot) => <EmptyEventCard key={`trending-empty-${slot}`} />)}
        </Section>
        <Section title="Events Near You" nav={nav}>
            {events.filter((e) => e.tag === "Near You").concat(events[3] ? [events[3]] : []).map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
            {!events.length && [0, 1, 2].map((slot) => <EmptyEventCard key={`nearby-empty-${slot}`} />)}
        </Section>
        <Section title="Popular Venues" nav={nav} last>
          {venues.slice(0, 6).map((venue) => (
            <div key={venue.id} className="flex-shrink-0 w-44 rounded-2xl overflow-hidden" style={{ background: C.card }}>
              <div style={{ height: 90, background: `linear-gradient(160deg, ${C.wood}, ${C.blue})` }} />
              <div className="p-3">
                <p className="text-[12.5px] font-semibold" style={{ color: C.ivory }}>{venue.name}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>{venue.city || venue.address || "Location pending"}</p>
              </div>
            </div>
          ))}
          {!venues.length && [0, 1, 2].map((slot) => <EmptyVenueCard key={`venue-empty-${slot}`} />)}
        </Section>
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="explore" go={nav.tab} />
    </Phone>
  );
}

function Section({ title, children, last }) {
  return (
    <div className={last ? "mb-4" : "mb-6"}>
      <div className="flex items-center justify-between px-5 mb-3">
        <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>{title}</span>
        <button className="text-[12px]" style={{ color: C.gold }}>See all</button>
      </div>
      <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar">{children}</div>
    </div>
  );
}

/* ============================== SEARCH ============================== */
function SearchScreen({ nav, catalog }) {
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ events: [], artists: [], songs: [], venues: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) { setResults({ events: [], artists: [], songs: [], venues: [] }); return; }
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
        {!!songs.length && <><p className="text-[12px] font-semibold mt-4 mb-2" style={{ color: C.muted }}>SONGS</p>{songs.map((song) => <button key={song.id} onClick={() => nav.push("musicPlayer", song)} className="w-full flex items-center gap-3 py-2.5 text-left"><div className="w-11 h-11 rounded-lg" style={imageStyle(song.coverUrl, C.card)} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{song.title}</p><p className="text-[11px]" style={{ color: C.muted }}>{song.artist}</p></div><Play size={16} color={C.gold} /></button>)}</>}
        {!!events.length && <><p className="text-[12px] font-semibold mt-4 mb-2" style={{ color: C.muted }}>EVENTS</p>{events.map((event) => <button key={event.id} onClick={() => nav.push("eventDetail", event)} className="w-full flex items-center gap-3 pb-4 text-left"><div className="w-14 h-14 rounded-xl flex-shrink-0" style={imageStyle(event.img, C.card)} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{event.title}</p><p className="text-[11px]" style={{ color: C.muted }}>{event.date} · {event.venue}</p></div></button>)}</>}
        {!!venues.length && <><p className="text-[12px] font-semibold mt-4 mb-2" style={{ color: C.muted }}>VENUES</p>{venues.map((venue) => <div key={venue.id} className="flex items-center gap-3 py-2.5"><div className="w-11 h-11 rounded-lg" style={{ background: C.card }} /><div><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{venue.name}</p><p className="text-[11px]" style={{ color: C.muted }}>{venue.city || venue.address || "Location pending"}</p></div></div>)}</>}
      </div>
    </Phone>
  );
}

/* ============================== EVENT DETAIL ============================== */
function EventDetail({ nav, data, account }) {
  const [event, setEvent] = useState(data || null);
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState("");
  const ev = event;
  useEffect(() => {
    if (!data?.id) return;
    let mounted = true;
    loadEventDetail(data.id).then((detail) => { if (mounted) setEvent(detail); }).catch((loadError) => { if (mounted) setError(loadError.message || "Unable to load event details."); });
    if (account?.user?.id) loadFavoriteState(account.user.id, data.id, null).then((state) => { if (mounted) setFavorite(state.eventFavorite); }).catch(() => {});
    return () => { mounted = false; };
  }, [data?.id, account?.user?.id]);
  if (!ev) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>{error || "Event details are unavailable."}</div></Phone>;
  const setEventFavorite = async () => {
    try { const next = !favorite; await toggleEventFavorite(account?.user?.id, ev.id, next); setFavorite(next); } catch (toggleError) { setError(toggleError.message || "Unable to update favorite."); }
  };
  return (
    <Phone>
      <div style={{ height: 240, background: ev.img }} className="relative flex-shrink-0">
        <div className="flex items-center justify-between px-5 mt-2">
          <button onClick={nav.pop} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><ChevronLeft size={18} color="#fff" /></button>
          <div className="flex gap-2">
            <button onClick={setEventFavorite} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><Heart size={16} color="#fff" fill={favorite ? "#fff" : "none"} /></button>
            <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><Share2 size={16} color="#fff" /></button>
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
          {(ev.artists || []).slice(0, 3).map((a) => (
            <div key={a.id} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full" style={{ background: a.img }} />
              <span className="text-[10.5px]" style={{ color: C.muted }}>{a.name}</span>
            </div>
          ))}
          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full self-start" style={{ background: C.card, color: C.muted }}>
            <span className="text-[11px]">+2</span>
          </div>
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

  return (
    <Phone>
      <TopBack title="Select Tickets" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[13px] font-semibold mb-4" style={{ color: C.ivory }}>{ev.title}</p>
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
      const [{ data: sessionData }, { data: userData }] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);
      const session = sessionData?.session;
      const user = userData?.user;
      if (!session?.access_token || !user?.email) throw new Error("A verified account email is required to start payment.");
      const callbackUrl = `${window.location.origin}/?payment=callback`;
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: reservation.order_id, email: user.email, callbackUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to initialize Paystack payment.");
      const pendingPayment = { ev, reservation, payment: { payment_id: payload.paymentId, order_id: payload.orderId, status: "PROVIDER_PENDING", amount: payload.amount, currency: payload.currency, reference: payload.reference }, items: data.items, types: data.types };
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
        const { data: ticket } = await supabase.from("tickets").select("id,order_id,ticket_type_id,status,checked_in_at,created_at,ticket_types(name,events(id,title,city,starts_at,cover_url,venues(name)))").eq("order_id", payment.order_id).maybeSingle();
        if (mounted) nav.replace("success", { ...data, payment, order: { id: payment.order_id, total: payment.amount }, ticket });
        return;
      }
      if (["FAILED", "EXPIRED", "REFUNDED"].includes(payment?.status)) return;
      attempts += 1;
      if (attempts < 30) setTimeout(poll, 2000);
    };
    poll();
    return () => { mounted = false; };
  }, [data?.payment?.payment_id]);
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
      .then((payload) => QRCode.toDataURL(payload.qr_token, { margin: 1, width: 240, errorCorrectionLevel: "M" }).then((url) => {
        if (mounted) setQrImage(url);
      }))
      .catch((error) => { if (mounted) setQrError(error.message || "Unable to prepare the secure ticket QR."); });
    return () => { mounted = false; };
  }, [ticket?.id, ticket?.status]);

  return (
    <Phone>
      <TopBack title={event.title || "Digital Ticket"} onBack={nav.pop} />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full rounded-3xl overflow-hidden" style={{ background: `linear-gradient(160deg, ${C.wood}, ${C.card2})`, border: `1px solid ${C.gold}44` }}>
          <div className="p-5 pb-4" style={{ background: "#00000030" }}><div className="flex justify-between items-start mb-1"><span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: C.gold, color: "#1A1408" }}>{typeName}</span><QrCode size={16} color={C.goldSoft} /></div><p className="ev-display text-[17px] mt-2" style={{ color: C.ivory }}>{event.title || "Atizzy ticket"}</p><p className="text-[11.5px]" style={{ color: C.muted }}>Issued by Atizzy · {ticket?.status || "PENDING"}</p></div>
          <div className="flex items-center justify-center py-6" style={{ borderTop: `1px dashed ${C.gold}55`, borderBottom: `1px dashed ${C.gold}55` }}><div className="w-36 h-36 rounded-xl flex items-center justify-center p-2" style={{ background: "#F3EEE3" }}>{qrImage ? <img src={qrImage} alt="Secure ticket QR code" className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-center px-3" style={{ color: C.bg }}><QrCode size={72} strokeWidth={1.2} /><span className="text-[9px] font-semibold tracking-widest">{qrError ? "QR UNAVAILABLE" : "PREPARING QR"}</span></div>}</div></div>
          <div className="p-5 grid grid-cols-2 gap-4"><Ticket2 label="Ticket ID" value={ticketId} /><Ticket2 label="Order ID" value={ticket?.order_id || "Pending"} /><Ticket2 label="Date" value={start ? start.toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Pending"} /><Ticket2 label="Time" value={start ? start.toLocaleTimeString("en-NG", { timeStyle: "short" }) : "Pending"} /><Ticket2 label="Venue" value={event.venues?.name || event.city || "Pending"} /><Ticket2 label="Entry" value={ticket?.checked_in_at ? "Checked in" : "Valid"} /></div>
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
        .select("id,order_id,ticket_type_id,status,checked_in_at,created_at,ticket_types(name,events(id,title,city,starts_at,cover_url,venues(name)))")
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
          return <button key={ticket.id} onClick={() => nav.push("digitalTicket", ticket)} className="w-full flex gap-3 rounded-2xl p-3 mb-3 text-left" style={{ background: C.card }}><div className="w-16 h-16 rounded-xl flex-shrink-0" style={{ background: event.cover_url || `linear-gradient(160deg, ${C.wood}, ${C.green})` }} /><div className="flex-1"><p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{event.title || "Atizzy ticket"}</p><p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{start ? start.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date pending"}</p><p className="text-[11px]" style={{ color: C.muted }}>{event.venues?.name || event.city || "Venue pending"}</p><p className="text-[11px] mt-1" style={{ color: C.goldSoft }}>{ticket.typeName} · {ticket.status}</p></div><span className="self-center text-[11px] font-semibold" style={{ color: C.gold }}>View</span></button>;
        })}
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onOpen={() => nav.push("musicPlayer")} /><BottomNav current="tickets" go={nav.tab} />
    </Phone>
  );
}

/* ============================== ROLE CENTER ============================== */
function RoleCenter({ nav, account }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (account?.user?.id) loadRoleDashboard(account.user.id, account.roles || []).then(setDashboard).catch((loadError) => setError(loadError.message || "Unable to load your workspace.")); }, [account?.user?.id, account?.roles]);
  const roles = (account?.roles || []).map((role) => typeof role === "string" ? role : role.code).filter(Boolean);
  if (!roles.length) return <Phone><TopBack title="Workspace" onBack={nav.pop} /><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>No operational role is assigned to this account.</div></Phone>;
  const metrics = [{ label: "Events", value: dashboard?.events?.length || 0, visible: roles.some((role) => ["ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(role)) }, { label: "Bookings", value: dashboard?.bookings?.length || 0, visible: roles.some((role) => ["ARTIST", "ADMIN", "SUPER_ADMIN"].includes(role)) }, { label: "Venues", value: dashboard?.venues?.length || 0, visible: roles.some((role) => ["VENUE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) }, { label: "Songs", value: dashboard?.songs?.length || 0, visible: roles.some((role) => ["ARTIST", "ADMIN", "SUPER_ADMIN"].includes(role)) }].filter((metric) => metric.visible);
  return <Phone><TopBack title="Workspace" onBack={nav.pop} /><div className="px-5 pt-2 pb-3"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Protected workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>Your Atizzy operations</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>{roles.map((role) => role.replaceAll("_", " ")).join(" · ")}</p></div><div className="flex-1 overflow-y-auto px-5">{error && <AuthMessage error={error} />}{!dashboard && !error && <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Loading workspace data...</p>}<div className="grid grid-cols-2 gap-3 mb-5">{metrics.map((metric) => <div key={metric.label} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[24px] font-semibold" style={{ color: C.goldSoft }}>{metric.value}</p><p className="text-[11px] mt-1" style={{ color: C.muted }}>{metric.label} visible to you</p></div>)}</div><div className="rounded-2xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold mb-3" style={{ color: C.ivory }}>Role capabilities</p>{roles.map((role) => <div key={role} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[12px]" style={{ color: C.ivory }}>{role.replaceAll("_", " ")}</span><ShieldCheck size={15} color={C.gold} /></div>)}</div>{roles.includes("ORGANIZER") && <GoldButton onClick={() => nav.push("organizerEvents")}>Manage my events</GoldButton>}{roles.includes("ARTIST") && <div className="mt-3"><GhostButton onClick={() => nav.push("artistLibrary")}>Manage music library</GhostButton></div>}{roles.includes("VENUE_MANAGER") && <div className="mt-3"><GhostButton onClick={() => nav.push("venueManager")}>Manage venues</GhostButton></div>}{roles.some((role) => ["EVENT_STAFF", "VENUE_MANAGER", "ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(role)) && <div className="mt-3"><GhostButton onClick={() => nav.push("checkIn")}>Check in a ticket</GhostButton></div>}</div></Phone>;
}

function RoleResourceScreen({ nav, account, title, description, rows, emptyLabel, columns }) {
  return <Phone><TopBack title={title} onBack={nav.pop} /><div className="px-5 pt-2 pb-3"><p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Protected workspace</p><h1 className="ev-display text-[24px] mt-1" style={{ color: C.ivory }}>{title}</h1><p className="text-[12px] mt-2" style={{ color: C.muted }}>{description}</p></div><div className="flex-1 overflow-y-auto px-5">{!rows?.length ? <EmptyResourceCard label={emptyLabel} description="This module stays available while live records are provisioned." /> : rows.map((row) => <div key={row.id} className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}><p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{row[columns.title] || "Untitled"}</p><div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">{columns.meta.map((key) => <span key={key} className="text-[11px]" style={{ color: C.muted }}>{String(row[key] ?? "Not provided")}</span>)}</div></div>)}</div></Phone>;
}

/* ============================== PROFILE (stub, phase 1) ============================== */
function Profile({ nav, player, account }) {
  const items = ["My Tickets", "Music Library", "Preferences", "Notifications", "Security", "Help & Support"];
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    nav.reset("login");
  };
  return (
    <Phone>
      <div className="px-5 pt-2 pb-4 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full mb-3" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.green})` }} />
        <p className="text-[16px] font-semibold" style={{ color: C.ivory }}>{account?.profile?.full_name || account?.user?.email || "Atizzy member"}</p>
        <p className="text-[12px] flex items-center gap-1 mt-0.5" style={{ color: C.muted }}><MapPin size={11} />{account?.profile?.city || "Location not provided"}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {account?.roles?.length > 0 && <button onClick={() => nav.push("roleCenter")} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[13.5px]" style={{ color: C.goldSoft }}>Open workspace</span><ShieldCheck size={15} color={C.gold} /></button>}
        {items.map((it) => (
          <button key={it} className="w-full flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}>
            <span className="text-[13.5px]" style={{ color: C.ivory }}>{it}</span>
            <ChevronRight size={15} color={C.muted} />
          </button>
        ))}
      </div>
      <div className="px-5 pb-3">
        <button onClick={signOut} disabled={busy} className="w-full py-3 rounded-2xl text-[13px] font-semibold" style={{ background: C.card, color: busy ? C.muted : "#E98979", border: `1px solid ${C.line}` }}>{busy ? "Signing out..." : "Log out"}</button>
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="profile" go={nav.tab} />
    </Phone>
  );
}

/* ============================== ARTIST PROFILE ============================== */
function ArtistProfile({ nav, data, account, catalog }) {
  const a = data;
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Popular");
  useEffect(() => { if (a?.id && account?.user?.id) loadFavoriteState(account.user.id, null, a.id).then((state) => setFollowing(state.artistFollowing)).catch(() => {}); }, [a?.id, account?.user?.id]);
  if (!a) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Artist details are unavailable.</div></Phone>;
  const toggleFollow = async () => { try { const next = !following; await toggleArtistFollow(account?.user?.id, a.id, next); setFollowing(next); } catch (followError) { setError(followError.message || "Unable to update follow."); } };
  return (
    <Phone>
      <div style={{ height: 190, background: a.img }} className="relative flex-shrink-0">
        <button onClick={nav.pop} className="w-9 h-9 mt-2 ml-5 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><ChevronLeft size={18} color="#fff" /></button>
        <div className="absolute -bottom-8 left-5 w-20 h-20 rounded-full border-4" style={{ background: a.img, borderColor: C.bg }} />
      </div>
      <div className="px-5 pt-11">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-[19px] font-semibold" style={{ color: C.ivory }}>{a.name}</p>
          {a.verified && <ShieldCheck size={15} color={C.gold} fill={C.gold} />}
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
        {(catalog?.songs || []).slice(0, 4).map((s, i) => (
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
  const songs = catalog?.songs || [];
  const artists = catalog?.artists || [];
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
        <Section title="Recently Played">
          {songs.slice(0, 3).map((s) => (
            <button key={s.id} onClick={() => player.play(s)} className="flex-shrink-0 w-28 text-left">
              <div className="w-28 h-28 rounded-xl mb-2" style={imageStyle(s.coverUrl, `linear-gradient(135deg, ${C.wood}, ${C.green})`)} />
              <p className="text-[12px] font-semibold truncate" style={{ color: C.ivory }}>{s.title}</p>
              <p className="text-[10.5px] truncate" style={{ color: C.muted }}>{s.artist}</p>
            </button>
          ))}
          {!songs.length && [0, 1, 2].map((slot) => <EmptySongCard key={`recent-empty-${slot}`} />)}
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
        <Section title="Popular Artists" last>
          {artists.map((a) => (
            <button key={a.id} onClick={() => nav.push("artist", a)} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
              <div className="w-16 h-16 rounded-full" style={imageStyle(a.img, C.card)} />
              <span className="text-[11px] truncate w-full text-center" style={{ color: C.ivory }}>{a.name}</span>
            </button>
          ))}
          {!artists.length && [0, 1, 2].map((slot) => <EmptyArtistCard key={`music-artist-empty-${slot}`} />)}
        </Section>
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="music" go={nav.tab} />
    </Phone>
  );
}

/* ============================== FULL MUSIC PLAYER ============================== */
function FullPlayer({ nav, player, account }) {
  const song = player.song;
  if (!song) return <Phone><div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted }}>Choose a song from the live music library to start playback.</div></Phone>;
  return (
    <Phone>
      <div className="flex-1 flex flex-col px-6" style={{ background: `linear-gradient(180deg, ${C.green}, ${C.bg} 60%)` }}>
        <div className="flex items-center justify-between pt-2 pb-6">
          <button onClick={nav.pop}><ChevronDown size={20} color={C.ivory} /></button>
          <span className="text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>Now Playing</span>
          <button><ListMusic size={18} color={C.ivory} /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full aspect-square rounded-2xl mb-8" style={imageStyle(song.coverUrl, `linear-gradient(150deg, ${C.wood}, ${C.greenLight})`)} />
          <div className="w-full flex items-center justify-between mb-6">
            <div>
              <p className="text-[19px] font-semibold" style={{ color: C.ivory }}>{song.title}</p>
              <p className="text-[13px]" style={{ color: C.muted }}>{song.artist}</p>
            </div>
            <Heart size={20} color={C.gold} />
          </div>
          <div className="w-full mb-2">
            <div className="w-full h-1 rounded-full" style={{ background: C.line }}>
              <div className="h-1 rounded-full" style={{ width: "38%", background: C.gold }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10.5px]" style={{ color: C.muted }}>1:32</span>
              <span className="text-[10.5px]" style={{ color: C.muted }}>{song.duration}</span>
            </div>
          </div>
          <div className="w-full flex items-center justify-between mt-6">
            <Shuffle size={17} color={C.muted} />
            <SkipBack size={22} color={C.ivory} />
              <button disabled={!song.audioUrl} onClick={player.toggle} className="w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${C.goldSoft}, ${C.gold})` }}>
              {player.playing ? <Pause size={24} color="#1A1408" /> : <Play size={24} color="#1A1408" fill="#1A1408" />}
            </button>
            <SkipForward size={22} color={C.ivory} />
            <Repeat size={17} color={C.muted} />
          </div>
        </div>
        <div className="flex items-center justify-between pb-8 pt-4">
          <Share2 size={17} color={C.muted} />
          <span className="text-[11px]" style={{ color: C.muted }}>Add to Playlist</span>
          <ListMusic size={17} color={C.muted} />
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

/* ============================== APP SHELL / ROUTER ============================== */
export default function EventVerseApp() {
  const [stack, setStack] = useState(() => {
    const completed = typeof window !== "undefined" && window.localStorage.getItem("eventverse:onboarding-complete") === "1";
    return [{ screen: completed ? "login" : "onboarding", data: null }];
  });
  const [song, setSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [account, setAccount] = useState({ user: null, profile: null, roles: [] });
  const [roleDashboard, setRoleDashboard] = useState({ events: [], bookings: [], venues: [], songs: [], orders: [] });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setCatalogLoading(true);
      try {
        const liveCatalog = await loadCatalog();
        if (mounted) setCatalog(liveCatalog);
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
        const paymentCallback = url.searchParams.get("payment") === "callback";
        const pendingPayment = paymentCallback ? JSON.parse(window.localStorage.getItem("atizzy:pending-payment") || "null") : null;
        if (paymentCallback) {
          url.searchParams.delete("payment");
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
        }
        if (mounted && data.session) {
          window.localStorage.setItem("eventverse:onboarding-complete", "1");
          setStack([{ screen: pendingPayment ? "processing" : "home", data: pendingPayment || null }]);
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
    if (!account?.user?.id || !account?.roles?.length) { setRoleDashboard({ events: [], bookings: [], venues: [], songs: [], orders: [] }); return; }
    loadRoleDashboard(account.user.id, account.roles).then(setRoleDashboard).catch((error) => setCatalogError(error.message || "Unable to load workspace data."));
  }, [account?.user?.id, account?.roles]);

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
    play: (s) => { setSong(s); setPlaying(true); },
    toggle: () => (song ? setPlaying((p) => !p) : null),
  };

  const screens = {
    onboarding: <Onboarding nav={nav} />,
    login: <Login nav={nav} />,
    signup: <Signup nav={nav} />,
    verify: <Verify nav={nav} data={current.data} />,
    home: <AttendeeHome nav={nav} player={player} catalog={catalog} account={account} loading={catalogLoading} error={catalogError} />,
    explore: <Explore nav={nav} player={player} catalog={catalog} loading={catalogLoading} error={catalogError} />,
    search: <SearchScreen nav={nav} catalog={catalog} />,
    eventDetail: <EventDetail nav={nav} data={current.data} account={account} />,
    tickets: <TicketSelection nav={nav} data={current.data} />,
    checkout: <Checkout nav={nav} data={current.data} />,
    payment: <Payment nav={nav} data={current.data} />,
    processing: <Processing nav={nav} data={current.data} />,
    success: <PaymentSuccess nav={nav} data={current.data} />,
    checkIn: <CheckInScreen nav={nav} />,
    roleCenter: <RoleCenter nav={nav} account={account} />,
    organizerEvents: <RoleResourceScreen nav={nav} account={account} title="My Events" description="Organizer-owned event records visible through Supabase RLS." rows={roleDashboard?.events || []} emptyLabel="No organizer events are available yet." columns={{ title: "title", meta: ["status", "city", "starts_at"] }} />,
    artistLibrary: <RoleResourceScreen nav={nav} account={account} title="Music Library" description="Artist library records available to your role." rows={roleDashboard?.songs || []} emptyLabel="No songs are available for this artist workspace." columns={{ title: "title", meta: ["play_count", "audio_url"] }} />,
    venueManager: <RoleResourceScreen nav={nav} account={account} title="Venues" description="Venue records owned by this account." rows={roleDashboard?.venues || []} emptyLabel="No venues are available for this account." columns={{ title: "name", meta: ["city", "capacity"] }} />,
    digitalTicket: <DigitalTicket nav={nav} data={current.data} />,
    myTickets: <MyTickets nav={nav} player={player} />,
    tickets_tab: null,
    profile: <Profile nav={nav} player={player} account={account} />,
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
      <AudioController song={song} playing={playing} setPlaying={setPlaying} userId={account?.user?.id} />
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden" style={{ background: C.bg, minHeight: "100dvh", width: "100dvw" }}>
        {screens[current.screen] || screens.home}
      </div>
    </div>
  );
}
