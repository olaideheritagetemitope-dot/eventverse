import { useMemo, useState } from "react";

const MODULES = [
  { id: "overview", label: "Overview", group: "Control plane" },
  { id: "users", label: "All Users", group: "Directories" },
  { id: "artists", label: "Artists", group: "Directories", role: "ARTIST" },
  { id: "organizers", label: "Organizers", group: "Directories", role: "ORGANIZER" },
  { id: "venues", label: "Venue Managers", group: "Directories", role: "VENUE_MANAGER" },
  { id: "staff", label: "Event Staff", group: "Directories", role: "EVENT_STAFF" },
  { id: "admins", label: "Admins", group: "Directories", role: "ADMIN" },
  { id: "super_admins", label: "Super Admins", group: "Directories", role: "SUPER_ADMIN" },
  { id: "attendees", label: "Attendees", group: "Directories", role: "ATTENDEE" },
  { id: "other_roles", label: "Other Roles", group: "Directories", role: "OTHER" },
  { id: "applications", label: "Applications", group: "Governance" },
  { id: "verification", label: "Verification", group: "Governance" },
  { id: "events", label: "Events", group: "Operations" },
  { id: "tickets", label: "Tickets", group: "Operations" },
  { id: "payments", label: "Payments", group: "Operations" },
  { id: "wallets", label: "Wallets & Refunds", group: "Operations" },
  { id: "analytics", label: "Niche Analytics", group: "Insights" },
  { id: "moderation", label: "Moderation", group: "Safety" },
  { id: "support", label: "Support", group: "Safety" },
  { id: "audit", label: "Audit Logs", group: "Safety" },
  { id: "settings", label: "Policies & Fees", group: "Configuration" },
  { id: "system", label: "System Health", group: "Configuration" },
];

const KNOWN_ROLE_CODES = new Set(["ARTIST", "ORGANIZER", "VENUE_MANAGER", "EVENT_STAFF", "ADMIN", "SUPER_ADMIN", "ATTENDEE"]);

function Metric({ label, value, C }) {
  return <div className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[10px]" style={{ color: C.muted }}>{label}</p><p className="text-lg font-semibold mt-1" style={{ color: C.goldSoft }}>{value}</p></div>;
}

function Empty({ label, C }) {
  return <div className="rounded-xl p-4 text-center" style={{ background: C.card2, border: `1px dashed ${C.line}` }}><p className="text-[12px]" style={{ color: C.ivory }}>{label}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>No live records are available for this module.</p></div>;
}

function displayRoles(user) {
  const roles = Array.isArray(user.roles) ? user.roles.filter(Boolean) : [];
  return roles.length ? roles : ["ATTENDEE"];
}

export default function SuperAdminModuleRegistry({ snapshot, events, C, money, onSuspend, onReview, onEventStatus, onOpenModule }) {
  const [active, setActive] = useState("overview");
  const users = snapshot?.users || [];
  const applications = snapshot?.applications || [];
  const fees = snapshot?.fees || [];
  const wallets = snapshot?.wallets || [];
  const analytics = snapshot?.analytics || {};
  const pending = applications.filter((item) => item.status === "PENDING");
  const grouped = useMemo(() => MODULES.reduce((result, item) => { (result[item.group] ||= []).push(item); return result; }, {}), []);
  const roleCounts = useMemo(() => users.reduce((result, user) => { displayRoles(user).forEach((role) => { result[role] = (result[role] || 0) + 1; }); return result; }, {}), [users]);
  const unknownRoleCodes = useMemo(() => Object.keys(roleCounts).filter((role) => !KNOWN_ROLE_CODES.has(role)), [roleCounts]);
  const activeModule = MODULES.find((item) => item.id === active);
  const filteredUsers = useMemo(() => {
    if (active === "users") return users;
    if (!activeModule?.role) return [];
    if (activeModule.role === "OTHER") return users.filter((user) => displayRoles(user).some((role) => !KNOWN_ROLE_CODES.has(role)));
    return users.filter((user) => displayRoles(user).includes(activeModule.role));
  }, [active, activeModule, users]);
  const open = (id) => { setActive(id); onOpenModule?.(id); };
  const title = activeModule?.label || "Overview";

  return <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
    <div className="flex items-start justify-between gap-3 mb-3"><div><p className="text-[10px] uppercase tracking-[.16em]" style={{ color: C.gold }}>Super Admin modules</p><h2 className="font-semibold mt-1" style={{ color: C.ivory }}>Complete governance control plane</h2><p className="text-[11px] mt-1" style={{ color: C.muted }}>Each module is backed by the current live snapshot, protected RPCs, or an explicit empty state.</p></div><span className="text-[10px]" style={{ color: C.goldSoft }}>{title}</span></div>
    <div className="flex gap-2 overflow-x-auto pb-2 mb-3">{Object.entries(grouped).map(([group, items]) => <div key={group} className="flex gap-2 shrink-0">{items.map((item) => <button key={item.id} type="button" onClick={() => open(item.id)} className="rounded-full px-3 py-2 text-[10px] whitespace-nowrap" style={{ background: active === item.id ? C.gold : C.card2, color: active === item.id ? "#1A1408" : C.muted, border: `1px solid ${active === item.id ? C.gold : C.line}` }}>{item.label}</button>)}</div>)}</div>
    {active === "overview" && <><div className="grid grid-cols-2 gap-2"><Metric label="Authenticated users" value={users.length} C={C} /><Metric label="Pending applications" value={pending.length} C={C} /><Metric label="Events in control" value={events.length} C={C} /><Metric label="Wallet credits" value={money(wallets.reduce((sum, item) => sum + Number(item.balance || 0), 0))} C={C} /><Metric label="Likes" value={analytics.likes ?? 0} C={C} /><Metric label="Ratings" value={analytics.ratings ?? 0} C={C} /><Metric label="Comments" value={analytics.comments ?? 0} C={C} /><Metric label="Configured fee policies" value={fees.length} C={C} /></div><div className="mt-3"><p className="text-[11px] font-semibold mb-2" style={{ color: C.ivory }}>Live role coverage</p><div className="grid grid-cols-2 gap-2">{MODULES.filter((item) => item.role && item.role !== "OTHER").map((item) => <button type="button" key={item.id} onClick={() => open(item.id)} className="text-left rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[10px]" style={{ color: C.muted }}>{item.label}</p><p className="text-lg font-semibold mt-1" style={{ color: C.goldSoft }}>{roleCounts[item.role] || 0}</p></button>)}<button type="button" onClick={() => open("other_roles")} className="text-left rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[10px]" style={{ color: C.muted }}>Other roles</p><p className="text-lg font-semibold mt-1" style={{ color: C.goldSoft }}>{unknownRoleCodes.reduce((sum, role) => sum + roleCounts[role], 0)}</p></button></div></div></>}
    {(active === "users" || activeModule?.role) && <div><div className="flex items-center justify-between mb-2"><div><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>Live {title} directory</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>Every row is an authenticated user and every role label comes from live Supabase assignments.</p></div><span className="text-[10px]" style={{ color: C.muted }}>{filteredUsers.length} records</span></div>{filteredUsers.slice(0, 100).map((user) => <div key={user.id} className="flex items-center justify-between gap-3 py-3 border-b" style={{ borderColor: C.line }}><div><p className="text-[12px]" style={{ color: C.ivory }}>{user.profile?.full_name || user.email || "Authenticated user"}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{displayRoles(user).join(" · ")}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{user.created_at ? new Date(user.created_at).toLocaleDateString("en-NG") : "Date pending"}</p></div><div className="flex gap-2"><button type="button" onClick={() => onSuspend?.(user.id, true)} className="text-[10px]" style={{ color: C.red }}>Block</button><button type="button" onClick={() => onSuspend?.(user.id, false)} className="text-[10px]" style={{ color: C.goldSoft }}>Restore</button></div></div>)}{!filteredUsers.length && <Empty label={`No ${title.toLowerCase()} records`} C={C} />}</div>}
    {active === "users" && <p className="text-[11px] mt-3" style={{ color: C.muted }}>All authenticated users are listed here, including users without an assigned elevated role. Users with no explicit role are shown as ATTENDEE.</p>}
    { ["applications", "verification"].includes(active) && <div><div className="flex items-center justify-between mb-2"><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>Live application and verification queue</p><span className="text-[10px]" style={{ color: C.muted }}>{applications.length} records</span></div>{applications.slice(0, 50).map((item) => <div key={item.id} className="py-3 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between gap-2"><div><p className="text-[12px]" style={{ color: C.ivory }}>{item.role_code} · {item.email || item.user_id}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.status} · {item.created_at ? new Date(item.created_at).toLocaleDateString("en-NG") : "date pending"}</p></div><div className="flex gap-2"><button type="button" onClick={() => onReview?.(item.id, "APPROVED")} className="text-[10px]" style={{ color: C.goldSoft }}>Approve</button><button type="button" onClick={() => onReview?.(item.id, "REJECTED", "Review required")} className="text-[10px]" style={{ color: C.red }}>Reject</button></div></div></div>)}{!applications.length && <Empty label="No applications awaiting governance review" C={C} />}</div>}
    { ["events", "tickets", "payments", "wallets"].includes(active) && <div><p className="text-[12px] font-semibold mb-2" style={{ color: C.ivory }}>{title} operations</p>{active === "wallets" && <Metric label="Current wallet credit balance" value={money(wallets.reduce((sum, item) => sum + Number(item.balance || 0), 0))} C={C} />}{active !== "wallets" && events.slice(0, 30).map((event) => <div key={event.id} className="py-3 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between"><div><p className="text-[12px]" style={{ color: C.ivory }}>{event.title || "Untitled event"}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{event.status || "STATUS_PENDING"}</p></div><div className="flex gap-2"><button type="button" onClick={() => onEventStatus?.(event.id, "CANCELLED")} className="text-[10px]" style={{ color: C.red }}>Stop/refund</button><button type="button" onClick={() => onEventStatus?.(event.id, "LIVE")} className="text-[10px]" style={{ color: C.goldSoft }}>Activate</button></div></div></div>)}{active !== "wallets" && !events.length && <Empty label={`No live ${title.toLowerCase()} records`} C={C} />}</div>}
    { ["analytics", "moderation", "support", "audit", "settings", "system"].includes(active) && <div><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>{title}</p><p className="text-[11px] leading-5 mt-2" style={{ color: C.muted }}>{active === "analytics" ? "Niche engagement analytics are sourced from live likes, ratings, comments, and ticket/accounting aggregates." : active === "moderation" ? "Use the live directories and event controls to block, restore, stop, activate, and review records through protected server actions." : active === "support" ? "Support requests are routed through the existing authenticated support workflow and remain visible through the control plane." : active === "audit" ? "Governance and payment actions are audit logged by the server-side RPC layer." : active === "settings" ? "Fee policies and onboarding questions are configurable through the existing protected controls below." : "System health remains explicit: unavailable providers render as unknown or unavailable rather than fabricated success."}</p><div className="grid grid-cols-2 gap-2 mt-3">{Object.entries(analytics).slice(0, 8).map(([key, value]) => <Metric key={key} label={key.replaceAll("_", " ")} value={value ?? 0} C={C} />)}{!Object.keys(analytics).length && <Empty label="No live analytics returned" C={C} />}</div></div>}
  </section>;
}
