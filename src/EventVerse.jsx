import React, { useState, useRef, useEffect } from "react";
import {
  Search, Bell, Menu, ChevronLeft, ChevronRight, Play, Pause,
  SkipBack, SkipForward, Heart, Share2, Star, MapPin, Calendar,
  Clock, Minus, Plus, Check, ShieldCheck, Home, Compass, Music2,
  Ticket, User, X, QrCode, Shuffle, Repeat, ListMusic, ChevronDown,
} from "lucide-react";
import { supabase } from "./lib/supabase";

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

/* ============================== MOCK DATA ============================== */
const EVENTS = [
  { id: 1, title: "Wizkid Live In Concert", venue: "ABC Event Centre, Ado-Ekiti", city: "Ado-Ekiti", date: "14 Sep 2025", time: "7:00 PM", price: 5000, rating: 4.8, reviews: 130, img: "linear-gradient(160deg,#3A2A1B,#16261D)", tag: "Featured" },
  { id: 2, title: "Burna Boy — The Summit", venue: "Eko Convention Centre", city: "Lagos", date: "2 Sep 2025", time: "8:00 PM", price: 7500, rating: 4.9, reviews: 340, img: "linear-gradient(160deg,#4A3624,#1E3327)", tag: "Trending" },
  { id: 3, title: "The Vibes Fest", venue: "Freedom Park", city: "Lagos", date: "10 Sep 2025", time: "3:00 PM", price: 4000, rating: 4.6, reviews: 88, img: "linear-gradient(160deg,#16261D,#0B0A08)", tag: "Weekend" },
  { id: 4, title: "Odi Aviction Live", venue: "Terra Kulture", city: "Lagos", date: "18 Sep 2025", time: "6:00 PM", price: 6000, rating: 4.5, reviews: 52, img: "linear-gradient(160deg,#3A2A1B,#12141C)", tag: "New" },
  { id: 5, title: "Ayra Starr — Solar", city: "Abuja", venue: "Julius Berger Hall", date: "22 Sep 2025", time: "7:30 PM", price: 8000, rating: 4.7, reviews: 210, img: "linear-gradient(160deg,#1E3327,#3A2A1B)", tag: "Near You" },
  { id: 6, title: "Phyno — Live In Enugu", city: "Enugu", venue: "Nike Lake Resort", date: "26 Sep 2025", time: "5:00 PM", price: 5500, rating: 4.4, reviews: 63, img: "linear-gradient(160deg,#12141C,#16261D)", tag: "Near You" },
];

const ARTISTS = [
  { id: 1, name: "Wizkid", followers: "5.3M", verified: true, img: "linear-gradient(160deg,#3A2A1B,#16261D)" },
  { id: 2, name: "Asake", followers: "3.1M", verified: true, img: "linear-gradient(160deg,#1E3327,#12141C)" },
  { id: 3, name: "Tems", followers: "4.0M", verified: true, img: "linear-gradient(160deg,#4A3624,#0B0A08)" },
  { id: 4, name: "Rema", followers: "6.1M", verified: true, img: "linear-gradient(160deg,#16261D,#3A2A1B)" },
];

const SONGS = [
  { id: 1, title: "Mood", artist: "Wizkid", duration: "3:45", plays: "12.5M" },
  { id: 2, title: "Last Last", artist: "Burna Boy", duration: "3:12", plays: "20.1M" },
  { id: 3, title: "Rush", artist: "Ayra Starr", duration: "2:58", plays: "9.3M" },
  { id: 4, title: "Calm Down", artist: "Rema", duration: "3:30", plays: "31.4M" },
  { id: 5, title: "Love Nwantiti", artist: "CKay", duration: "3:05", plays: "44.2M" },
];

const CATEGORIES = ["All", "Concerts", "Parties", "Sports", "Comedy", "Festivals"];

const money = (n) => `\u20A6${Number(n || 0).toLocaleString()}`;
const formatFollowers = (n) => {
  const value = Number(n || 0);
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\\.0$/, "")}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\\.0$/, "")}K`;
  return String(value);
};

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

/* ============================== ONBOARDING ============================== */
const SLIDES = [
  { title: "EVENTVERSE", sub: "Events, Music, Experiences.\nAll in one place.", cta: "Get Started", showLogin: true, bg: `linear-gradient(180deg, transparent, ${C.bg}), radial-gradient(circle at 50% 30%, ${C.woodLight}55, transparent 60%), linear-gradient(160deg, ${C.green}, ${C.bg})` },
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
            <span className="ev-display tracking-[0.2em] text-[15px]" style={{ color: C.goldSoft }}>EVENTVERSE</span>
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
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
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
        <span className="ev-display tracking-[0.15em] text-[13px]" style={{ color: C.goldSoft }}>EVENTVERSE</span>
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
        <Field label="Full Name" placeholder="Renile Heritage" value={form.name} onChange={update("name")} />
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
function AttendeeHome({ nav, player, catalog }) {
  const [cat, setCat] = useState("All");
  const events = catalog?.events?.length ? catalog.events : EVENTS;
  const artists = catalog?.artists?.length ? catalog.artists : ARTISTS;
  return (
    <Phone>
      <div className="flex items-center justify-between px-5 pt-1 pb-3">
        <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.card }}><Menu size={17} color={C.ivory} /></button>
        <div className="text-center">
          <p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>Good evening, Renile 👋</p>
          <p className="text-[11px] flex items-center justify-center gap-1" style={{ color: C.muted }}><MapPin size={10} />Lagos, Nigeria</p>
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
          {CATEGORIES.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}
        </div>

        <div className="px-5 mb-6">
          <EventCard ev={EVENTS[0]} wide onClick={() => nav.push("eventDetail", EVENTS[0])} />
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>Upcoming Events</span>
            <button onClick={() => nav.push("explore")} className="text-[12px]" style={{ color: C.gold }}>See all</button>
          </div>
          <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar">
            {events.slice(1, 5).map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
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
                <div className="w-16 h-16 rounded-full relative" style={{ background: a.img }}>
                  {a.verified && <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: C.gold }}><Check size={9} color="#1A1408" strokeWidth={3} /></span>}
                </div>
                <span className="text-[11px] truncate w-full text-center" style={{ color: C.ivory }}>{a.name}</span>
              </button>
            ))}
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
  const events = catalog?.events?.length ? catalog.events : EVENTS;
  return (
    <Phone>
      <div className="px-5 pt-1 pb-3">
        <h1 className="ev-display text-[22px] mb-3" style={{ color: C.ivory }}>Explore</h1>
        <button onClick={() => nav.push("search")} className="w-full flex items-center gap-2 rounded-2xl px-4 py-3 mb-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <Search size={16} color={C.muted} />
          <span className="text-[13px]" style={{ color: C.muted }}>Search events, artists, venues...</span>
        </button>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section title="Trending Events" nav={nav}>
          {events.slice(0, 3).map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
        </Section>
        <Section title="Events Near You" nav={nav}>
          {events.filter((e) => e.tag === "Near You").concat(events[3] ? [events[3]] : []).map((ev) => <EventCard key={ev.id} ev={ev} onClick={() => nav.push("eventDetail", ev)} />)}
        </Section>
        <Section title="Popular Venues" nav={nav} last>
          {["ABC Event Centre, Ado-Ekiti", "Eko Convention Centre, Lagos", "Freedom Park, Lagos"].map((v, idx) => (
            <div key={idx} className="flex-shrink-0 w-44 rounded-2xl overflow-hidden" style={{ background: C.card }}>
              <div style={{ height: 90, background: `linear-gradient(160deg, ${C.wood}, ${C.blue})` }} />
              <div className="p-3">
                <p className="text-[12.5px] font-semibold" style={{ color: C.ivory }}>{v.split(",")[0]}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>{v.split(",")[1]}</p>
              </div>
            </div>
          ))}
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
  const artists = catalog?.artists?.length ? catalog.artists : ARTISTS;
  const songs = catalog?.songs?.length ? catalog.songs : SONGS;
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-1 pb-3">
        <button onClick={nav.pop}><ChevronLeft size={20} color={C.ivory} /></button>
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: C.card, border: `1px solid ${C.gold}55` }}>
          <Search size={15} color={C.gold} />
          <span className="text-[13px]" style={{ color: C.ivory }}>wizkid</span>
        </div>
      </div>
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto no-scrollbar">
        {["All", "Events", "Artists", "Songs", "Albums", "Venues"].map((t) => <Pill key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Pill>)}
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>ARTISTS</p>
        <button onClick={() => nav.push("artist", ARTISTS[0])} className="w-full flex items-center gap-3 py-2.5">
          <div className="w-11 h-11 rounded-full" style={{ background: ARTISTS[0].img }} />
          <div className="flex-1 text-left">
            <p className="text-[13px] font-semibold" style={{ color: C.ivory }}>Wizkid</p>
            <p className="text-[11px]" style={{ color: C.muted }}>5.3M Followers</p>
          </div>
        </button>

        <p className="text-[12px] font-semibold mt-4 mb-2" style={{ color: C.muted }}>SONGS</p>
        {songs.slice(0, 2).map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-2.5">
            <div className="w-11 h-11 rounded-lg" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.green})` }} />
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{s.title}</p>
              <p className="text-[11px]" style={{ color: C.muted }}>{s.artist}</p>
            </div>
            <Play size={16} color={C.gold} />
          </div>
        ))}

        <p className="text-[12px] font-semibold mt-4 mb-2 pb-6" style={{ color: C.muted }}>EVENTS</p>
        <button onClick={() => nav.push("eventDetail", EVENTS[0])} className="w-full flex items-center gap-3 pb-6">
          <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: EVENTS[0].img }} />
          <div className="flex-1 text-left">
            <p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{EVENTS[0].title}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>{EVENTS[0].date} · {EVENTS[0].venue}</p>
          </div>
        </button>
      </div>
    </Phone>
  );
}

/* ============================== EVENT DETAIL ============================== */
function EventDetail({ nav, data }) {
  const ev = data || EVENTS[0];
  return (
    <Phone>
      <div style={{ height: 240, background: ev.img }} className="relative flex-shrink-0">
        <div className="flex items-center justify-between px-5 mt-2">
          <button onClick={nav.pop} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><ChevronLeft size={18} color="#fff" /></button>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#00000060" }}><Heart size={16} color="#fff" /></button>
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
        <p className="text-[13px] leading-relaxed mb-5" style={{ color: C.muted }}>
          A night of unforgettable music and unmatched energy as {ev.title.split(" ")[0]} performs live in {ev.city}. Doors open an hour before showtime — arrive early to secure the best spot.
        </p>

        <p className="text-[13px] font-semibold mb-3" style={{ color: C.ivory }}>Performing Artists</p>
        <div className="flex gap-4 mb-5">
          {ARTISTS.slice(0, 3).map((a) => (
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
            <p className="text-[11px]" style={{ color: C.muted }}>Capacity: 5,000</p>
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
function TicketSelection({ nav, data, cart, setCart }) {
  const ev = data || EVENTS[0];
  const types = [
    { id: "regular", name: "Regular", price: 5000, avail: 300 },
    { id: "vip", name: "VIP", price: 15000, avail: 120 },
    { id: "vvip", name: "VVIP", price: 30000, avail: 45 },
  ];
  const qty = (id) => cart[id] || 0;
  const setQty = (id, v) => setCart((c) => ({ ...c, [id]: Math.max(0, v) }));
  const total = types.reduce((s, t) => s + t.price * qty(t.id), 0);
  const count = types.reduce((s, t) => s + qty(t.id), 0);
  return (
    <Phone>
      <TopBack title="Select Tickets" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[13px] font-semibold mb-4" style={{ color: C.ivory }}>{ev.title}</p>
        {types.map((t) => (
          <div key={t.id} className="rounded-2xl p-4 mb-3" style={{ background: qty(t.id) > 0 ? `linear-gradient(135deg, ${C.woodLight}33, ${C.card})` : C.card, border: `1px solid ${qty(t.id) > 0 ? C.gold + "77" : C.line}` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: C.ivory }}>{t.name}</p>
                <p className="text-[13px] font-semibold mt-0.5" style={{ color: C.goldSoft }}>{money(t.price)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>Available: {t.avail}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(t.id, qty(t.id) - 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}` }}><Minus size={13} color={C.ivory} /></button>
                <span className="w-4 text-center text-[14px] font-semibold" style={{ color: C.ivory }}>{qty(t.id)}</span>
                <button onClick={() => setQty(t.id, qty(t.id) + 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.gold }}><Plus size={13} color="#1A1408" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-4 flex items-center gap-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <div>
          <p className="text-[10.5px]" style={{ color: C.muted }}>{count} Ticket{count !== 1 ? "s" : ""}</p>
          <p className="text-[16px] font-semibold" style={{ color: C.goldSoft }}>{money(total)}</p>
        </div>
        <div className="flex-1"><GoldButton disabled={count === 0} onClick={() => nav.push("checkout", ev)}>Continue</GoldButton></div>
      </div>
    </Phone>
  );
}

/* ============================== CHECKOUT ============================== */
function Checkout({ nav, data, cart }) {
  const ev = data || EVENTS[0];
  const types = { regular: { name: "Regular", price: 5000 }, vip: { name: "VIP", price: 15000 }, vvip: { name: "VVIP", price: 30000 } };
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const subtotal = lines.reduce((s, [id, q]) => s + types[id].price * q, 0);
  const fee = 1500, discount = 500;
  const total = subtotal + fee - discount;
  return (
    <Phone>
      <TopBack title="Checkout" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>ORDER SUMMARY</p>
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
          <p className="text-[13px] font-semibold mb-3" style={{ color: C.ivory }}>{ev.title}</p>
          {lines.map(([id, q]) => (
            <div key={id} className="flex justify-between text-[12.5px] py-1" style={{ color: C.muted }}>
              <span>{types[id].name} ×{q}</span>
              <span style={{ color: C.ivory }}>{money(types[id].price * q)}</span>
            </div>
          ))}
        </div>

        <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>FEES</p>
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
          <div className="flex justify-between text-[12.5px] py-1" style={{ color: C.muted }}><span>Service Fee</span><span style={{ color: C.ivory }}>{money(fee)}</span></div>
          <div className="flex justify-between text-[12.5px] py-1" style={{ color: C.goldSoft }}><span>Discount</span><span>-{money(discount)}</span></div>
        </div>

        <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>BUYER INFORMATION</p>
        <div className="flex items-center gap-3 rounded-2xl p-4 mb-6" style={{ background: C.card }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.wood }}><User size={16} color={C.goldSoft} /></div>
          <div>
            <p className="text-[12.5px] font-semibold" style={{ color: C.ivory }}>Renile Heritage</p>
            <p className="text-[11px]" style={{ color: C.muted }}>renile@example.com · +234 803 123 4567</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[13px]" style={{ color: C.muted }}>Total</span>
          <span className="text-[19px] font-semibold" style={{ color: C.goldSoft }}>{money(total)}</span>
        </div>
        <GoldButton onClick={() => nav.push("payment", { ev, total })}>Continue to Payment</GoldButton>
      </div>
    </Phone>
  );
}

/* ============================== PAYMENT ============================== */
function Payment({ nav, data }) {
  const { ev, total } = data || { ev: EVENTS[0], total: 26500 };
  const [method, setMethod] = useState("paystack");
  const methods = [
    { id: "paystack", label: "Paystack (Card, Bank, USSD)", sub: "Recommended" },
    { id: "card", label: "Card", sub: "Visa, Mastercard, Verve" },
    { id: "bank", label: "Bank Transfer", sub: "Manual Transfer" },
    { id: "ussd", label: "USSD", sub: "" },
  ];
  return (
    <Phone>
      <TopBack title="Payment" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-[12px] font-semibold mb-3" style={{ color: C.muted }}>CHOOSE A PAYMENT METHOD</p>
        {methods.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className="w-full flex items-center justify-between rounded-2xl p-4 mb-3" style={{ background: method === m.id ? `${C.wood}55` : C.card, border: `1.5px solid ${method === m.id ? C.gold : C.line}` }}>
            <div className="text-left">
              <p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>{m.label}</p>
              {m.sub && <p className="text-[11px]" style={{ color: C.gold }}>{m.sub}</p>}
            </div>
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${method === m.id ? C.gold : C.line}` }}>
              {method === m.id && <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.gold }} />}
            </div>
          </button>
        ))}
      </div>
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <GoldButton onClick={() => nav.push("processing", { ev, total })}>Pay {money(total)}</GoldButton>
      </div>
    </Phone>
  );
}

function Processing({ nav, data }) {
  const [pct, setPct] = useState(10);
  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => {
        if (p >= 100) { clearInterval(t); setTimeout(() => nav.replace("success", data), 400); return 100; }
        return p + 15;
      });
    }, 250);
    return () => clearInterval(t);
  }, []);
  return (
    <Phone>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative w-32 h-32 mb-8">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke={C.card} strokeWidth="7" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={C.gold} strokeWidth="7" strokeLinecap="round" strokeDasharray={276} strokeDashoffset={276 - (276 * pct) / 100} style={{ transition: "stroke-dashoffset 0.25s" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[20px] font-semibold" style={{ color: C.ivory }}>{pct}%</span>
          </div>
        </div>
        <p className="text-[16px] font-semibold mb-2" style={{ color: C.ivory }}>Processing Payment</p>
        <p className="text-[13px] text-center" style={{ color: C.muted }}>Please wait while we confirm your payment.</p>
      </div>
    </Phone>
  );
}

function PaymentSuccess({ nav, data }) {
  const { total } = data || { total: 26500 };
  return (
    <Phone>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: `${C.greenLight}` }}>
          <Check size={36} color={C.gold} strokeWidth={2.5} />
        </div>
        <p className="text-[19px] font-semibold mb-1" style={{ color: C.ivory }}>Payment Successful!</p>
        <p className="text-[13px] text-center mb-6" style={{ color: C.muted }}>Your ticket(s) have been booked.</p>
        <div className="w-full rounded-2xl p-5 mb-6" style={{ background: C.card }}>
          <Row label="Total Paid" value={money(total)} big />
          <Row label="Order ID" value="EVT-89231" />
          <Row label="Event" value="Wizkid Live In Concert" last />
        </div>
        <GoldButton onClick={() => nav.push("digitalTicket")}>View Tickets</GoldButton>
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
function DigitalTicket({ nav }) {
  return (
    <Phone>
      <TopBack title="Wizkid Live In Concert" onBack={nav.pop} />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full rounded-3xl overflow-hidden" style={{ background: `linear-gradient(160deg, ${C.wood}, ${C.card2})`, border: `1px solid ${C.gold}44` }}>
          <div className="p-5 pb-4" style={{ background: "#00000030" }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: C.gold, color: "#1A1408" }}>VIP</span>
              <QrCode size={16} color={C.goldSoft} />
            </div>
            <p className="ev-display text-[17px] mt-2" style={{ color: C.ivory }}>Wizkid Live In Concert</p>
            <p className="text-[11.5px]" style={{ color: C.muted }}>Renile Heritage</p>
          </div>
          <div className="flex items-center justify-center py-6" style={{ borderTop: `1px dashed ${C.gold}55`, borderBottom: `1px dashed ${C.gold}55` }}>
            <div className="w-36 h-36 rounded-xl grid grid-cols-6 grid-rows-6 gap-1 p-2" style={{ background: "#F3EEE3" }}>
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} style={{ background: [3,5,7,9,12,14,18,20,22,25,27,29,31,33].includes(i) ? "#0B0A08" : "transparent" }} />
              ))}
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Ticket2 label="Ticket ID" value="EVT8231" />
            <Ticket2 label="Gate" value="A" />
            <Ticket2 label="Row" value="12" />
            <Ticket2 label="Seat" value="25" />
            <Ticket2 label="Date" value="14 Sep 2026" />
            <Ticket2 label="Time" value="7:00 PM" />
          </div>
          <div className="px-5 pb-5">
            <p className="text-[11px]" style={{ color: C.muted }}>ABC Event Centre, Ado-Ekiti, Nigeria</p>
          </div>
        </div>
      </div>
      <div className="px-6 pb-6 pt-2 text-center">
        <span className="text-[11px]" style={{ color: C.muted }}>1 of 1</span>
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
  const tickets = [
    { title: "Wizkid Live In Concert", date: "14 Sep 2026 · 7:00 PM", venue: "ABC Event Centre", type: "VIP · 1 Ticket" },
    { title: "Afrobeats Night", date: "21 Sep 2026 · 8:00 PM", venue: "Freedom Park", type: "Regular · 2 Tickets" },
    { title: "The Vibes Fest", date: "3 Oct 2026 · 2:00 PM", venue: "Freedom Park", type: "VIP · 1 Ticket" },
  ];
  return (
    <Phone>
      <div className="px-5 pt-1 pb-3">
        <h1 className="ev-display text-[22px] mb-3" style={{ color: C.ivory }}>My Tickets</h1>
        <div className="flex gap-2">
          {["Upcoming", "Past", "Cancelled"].map((t) => <Pill key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Pill>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {tickets.map((t, idx) => (
          <button key={idx} onClick={() => nav.push("digitalTicket")} className="w-full flex gap-3 rounded-2xl p-3 mb-3 text-left" style={{ background: C.card }}>
            <div className="w-16 h-16 rounded-xl flex-shrink-0" style={{ background: EVENTS[idx % EVENTS.length].img }} />
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{t.title}</p>
              <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{t.date}</p>
              <p className="text-[11px]" style={{ color: C.muted }}>{t.venue}</p>
              <p className="text-[11px] mt-1" style={{ color: C.goldSoft }}>{t.type}</p>
            </div>
            <span className="self-center text-[11px] font-semibold" style={{ color: C.gold }}>View</span>
          </button>
        ))}
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="tickets" go={nav.tab} />
    </Phone>
  );
}

/* ============================== PROFILE (stub, phase 1) ============================== */
function Profile({ nav, player }) {
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
        <p className="text-[16px] font-semibold" style={{ color: C.ivory }}>Renile Heritage</p>
        <p className="text-[12px] flex items-center gap-1 mt-0.5" style={{ color: C.muted }}><MapPin size={11} />Lagos, Nigeria</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
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
function ArtistProfile({ nav, data }) {
  const a = data || ARTISTS[0];
  const [tab, setTab] = useState("Popular");
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
        <p className="text-[12px] mb-4" style={{ color: C.muted }}>{a.followers} Followers · Monthly Listeners</p>
        <div className="flex gap-3 mb-5">
          <div className="flex-1"><GoldButton>Follow</GoldButton></div>
          <button className="px-5 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ivory }}>Share</button>
        </div>
        <div className="flex gap-5 mb-4 overflow-x-auto no-scrollbar">
          {["Popular", "Songs", "Albums", "Events", "About"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className="text-[13px] pb-2 whitespace-nowrap" style={{ color: tab === t ? C.gold : C.muted, borderBottom: tab === t ? `2px solid ${C.gold}` : "2px solid transparent" }}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {SONGS.slice(0, 4).map((s, i) => (
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
function MusicHome({ nav, player, catalog }) {
  const songs = catalog?.songs?.length ? catalog.songs : SONGS;
  const artists = catalog?.artists?.length ? catalog.artists : ARTISTS;
  return (
    <Phone>
      <div className="px-5 pt-1 pb-3">
        <h1 className="ev-display text-[22px]" style={{ color: C.ivory }}>Good evening</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Section title="Recently Played">
          {songs.slice(0, 3).map((s) => (
            <button key={s.id} onClick={() => player.play(s)} className="flex-shrink-0 w-28 text-left">
              <div className="w-28 h-28 rounded-xl mb-2" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.green})` }} />
              <p className="text-[12px] font-semibold truncate" style={{ color: C.ivory }}>{s.title}</p>
              <p className="text-[10.5px] truncate" style={{ color: C.muted }}>{s.artist}</p>
            </button>
          ))}
        </Section>
        <div className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <span className="text-[14px] font-semibold" style={{ color: C.ivory }}>Popular Songs</span>
          </div>
          <div className="px-5">
            {songs.map((s) => (
              <button key={s.id} onClick={() => player.play(s)} className="w-full flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${C.wood}, ${C.green})` }} />
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-semibold" style={{ color: C.ivory }}>{s.title}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>{s.artist}</p>
                </div>
                <span className="text-[11px]" style={{ color: C.muted }}>{s.duration}</span>
              </button>
            ))}
          </div>
        </div>
        <Section title="Popular Artists" last>
          {artists.map((a) => (
            <button key={a.id} onClick={() => nav.push("artist", a)} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
              <div className="w-16 h-16 rounded-full" style={{ background: a.img }} />
              <span className="text-[11px] truncate w-full text-center" style={{ color: C.ivory }}>{a.name}</span>
            </button>
          ))}
        </Section>
      </div>
      <MiniPlayer song={player.song} playing={player.playing} onToggle={player.toggle} onOpen={() => nav.push("musicPlayer")} />
      <BottomNav current="music" go={nav.tab} />
    </Phone>
  );
}

/* ============================== FULL MUSIC PLAYER ============================== */
function FullPlayer({ nav, player }) {
  const song = player.song || SONGS[0];
  return (
    <Phone>
      <div className="flex-1 flex flex-col px-6" style={{ background: `linear-gradient(180deg, ${C.green}, ${C.bg} 60%)` }}>
        <div className="flex items-center justify-between pt-2 pb-6">
          <button onClick={nav.pop}><ChevronDown size={20} color={C.ivory} /></button>
          <span className="text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>Now Playing</span>
          <button><ListMusic size={18} color={C.ivory} /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full aspect-square rounded-2xl mb-8" style={{ background: `linear-gradient(150deg, ${C.wood}, ${C.greenLight})`, boxShadow: `0 20px 60px -20px ${C.gold}33` }} />
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
            <button onClick={player.toggle} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.goldSoft}, ${C.gold})` }}>
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
function Booking({ nav, data }) {
  const a = data || ARTISTS[0];
  return (
    <Phone>
      <TopBack title="Book Artist" onBack={nav.pop} />
      <div className="flex-1 overflow-y-auto px-5">
        <div className="flex items-center gap-3 rounded-2xl p-4 mb-5" style={{ background: C.card }}>
          <div className="w-12 h-12 rounded-full" style={{ background: a.img }} />
          <div>
            <p className="text-[13.5px] font-semibold" style={{ color: C.ivory }}>{a.name}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>Booking fee from {money(800000)}</p>
          </div>
        </div>
        <Field label="Event Name" placeholder="e.g. Company End-of-Year Party" />
        <Field label="Event Type" placeholder="Corporate, Wedding, Concert..." />
        <Field label="Date" placeholder="Select date" />
        <Field label="Expected Audience" placeholder="e.g. 500" />
        <Field label="Budget (₦)" placeholder="e.g. 1,000,000" />
        <Field label="Message" placeholder="Tell us more about the event..." />
      </div>
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <GoldButton onClick={() => nav.pop()}>Send Booking Request</GoldButton>
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
  const [cart, setCart] = useState({});
  const [song, setSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [catalog, setCatalog] = useState({ events: EVENTS, artists: ARTISTS, songs: SONGS });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [eventResult, artistResult, songResult] = await Promise.all([
        supabase.from("events").select("*, venues(name), ticket_types(price)").in("status", ["PUBLISHED", "SOLD_OUT", "LIVE", "COMPLETED"]).order("starts_at"),
        supabase.from("artists").select("*").order("follower_count", { ascending: false }),
        supabase.from("songs").select("*, artists(name)").order("play_count", { ascending: false }),
      ]);
      if (!mounted) return;
      const events = (eventResult.data || []).map((e, index) => ({
        id: e.id, title: e.title, venue: e.venues?.name || e.city, city: e.city,
        date: new Date(e.starts_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        time: new Date(e.starts_at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }),
        price: Number(e.ticket_types?.[0]?.price || 0), rating: Number(e.rating || 0), reviews: e.review_count || 0,
        img: e.cover_url || `linear-gradient(160deg, ${C.wood}, ${C.green})`, tag: index === 0 ? "Featured" : index === 1 ? "Trending" : "Near You",
      }));
      const artists = (artistResult.data || []).map((a) => ({ id: a.id, name: a.name, followers: formatFollowers(a.follower_count), verified: a.verified, img: a.image_url || `linear-gradient(160deg, ${C.wood}, ${C.green})` }));
      const songs = (songResult.data || []).map((s) => ({ id: s.id, title: s.title, artist: s.artists?.name || "EventVerse Artist", duration: `${Math.floor(s.duration_seconds / 60)}:${String(s.duration_seconds % 60).padStart(2, "0")}`, plays: formatFollowers(s.play_count) }));
      if (events.length || artists.length || songs.length) setCatalog({ events: events.length ? events : EVENTS, artists: artists.length ? artists : ARTISTS, songs: songs.length ? songs : SONGS });
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
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
        }
        if (callbackError) console.error("EventVerse OAuth callback returned an error", callbackError);
        const { data } = await supabase.auth.getSession();
        if (mounted && data.session) {
          window.localStorage.setItem("eventverse:onboarding-complete", "1");
          await ensureUserProfile(data.session.user);
          setStack([{ screen: "home", data: null }]);
        }
      } catch (restoreError) {
        console.error("EventVerse auth restore failed", restoreError);
      } finally {
        if (mounted) setAuthReady(true);
      }
    };
    load(); restore();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || !session) return;
      // Defer profile I/O outside Supabase's auth event callback to avoid re-entrant locks.
      setTimeout(() => ensureUserProfile(session.user), 0);
      if (["SIGNED_IN", "TOKEN_REFRESHED"].includes(event)) {
        setStack((currentStack) => {
          const active = currentStack[currentStack.length - 1]?.screen;
          return ["onboarding", "login", "signup", "verify"].includes(active) ? [{ screen: "home", data: null }] : currentStack;
        });
      }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

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
    toggle: () => (song ? setPlaying((p) => !p) : (setSong(SONGS[0]), setPlaying(true))),
  };

  const screens = {
    onboarding: <Onboarding nav={nav} />,
    login: <Login nav={nav} />,
    signup: <Signup nav={nav} />,
    verify: <Verify nav={nav} data={current.data} />,
    home: <AttendeeHome nav={nav} player={player} catalog={catalog} />,
    explore: <Explore nav={nav} player={player} catalog={catalog} />,
    search: <SearchScreen nav={nav} catalog={catalog} />,
    eventDetail: <EventDetail nav={nav} data={current.data} />,
    tickets: <TicketSelection nav={nav} data={current.data} cart={cart} setCart={setCart} />,
    checkout: <Checkout nav={nav} data={current.data} cart={cart} />,
    payment: <Payment nav={nav} data={current.data} />,
    processing: <Processing nav={nav} data={current.data} />,
    success: <PaymentSuccess nav={nav} data={current.data} />,
    digitalTicket: <DigitalTicket nav={nav} />,
    myTickets: <MyTickets nav={nav} player={player} />,
    tickets_tab: null,
    profile: <Profile nav={nav} player={player} />,
    artist: <ArtistProfile nav={nav} data={current.data} />,
    booking: <Booking nav={nav} data={current.data} />,
    music: <MusicHome nav={nav} player={player} catalog={catalog} />,
    musicPlayer: <FullPlayer nav={nav} player={player} />,
  };
  // "tickets" tab in bottom nav should show MyTickets, not ticket selector — route it explicitly.
  if (current.screen === "tickets" && !current.data) screens.tickets = <MyTickets nav={nav} player={player} />;

  if (!authReady) return <div className="ev-app-viewport flex min-h-screen items-center justify-center" style={{ background: C.bg, color: C.goldSoft }}>Loading EventVerse...</div>;

  return (
    <div className="ev-app-viewport flex min-h-screen w-full items-stretch justify-stretch overflow-hidden" style={{ background: C.bg, minHeight: "100dvh", width: "100dvw" }}>
      <style>{font}</style>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none} .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden" style={{ background: C.bg, minHeight: "100dvh", width: "100dvw" }}>
        {screens[current.screen] || screens.home}
      </div>
    </div>
  );
}
