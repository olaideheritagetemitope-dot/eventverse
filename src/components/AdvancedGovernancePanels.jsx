import React, { useEffect, useMemo, useState } from "react";
import { loadAdminPermissionGrants, loadRoleCapabilityMatrix, saveOnboardingQuestion, setAdminPermission, setPlatformFeePolicy, setRoleFeePolicy } from "../services/user";

const ROLE_LABELS = ["ARTIST", "ORGANIZER", "VENUE_MANAGER"];
const formatRole = (value) => String(value || "").replaceAll("_", " ");

function Metric({ label, value, C }) {
  return <div className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</p><p className="text-lg font-semibold mt-1" style={{ color: C.goldSoft }}>{value ?? 0}</p></div>;
}

function Empty({ label, C }) {
  return <p className="text-[11px] py-3" style={{ color: C.muted }}>{label}</p>;
}

export default function AdvancedGovernancePanels({ snapshot, C, money, busy, onAct }) {
  const [ticketFee, setTicketFee] = useState({ policy_key: "TICKET_SALE", enabled: true, fee_type: "PERCENTAGE", amount: 0, currency: "NGN" });
  const [roleFees, setRoleFees] = useState({});
  const [question, setQuestion] = useState({ roleCode: "ARTIST", prompt: "", questionType: "SHORT_TEXT", required: true, sortOrder: 0 });
  const [capabilityMatrix, setCapabilityMatrix] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [adminGrants, setAdminGrants] = useState([]);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const lifecycle = snapshot?.event_lifecycle || {};
  const tickets = snapshot?.ticket_accounting || {};
  const engagement = snapshot?.engagement_by_type || {};
  const fees = snapshot?.fees || [];
  const questions = snapshot?.questions || [];
  const support = snapshot?.support || [];
  const adminUsers = (snapshot?.users || []).filter((user) => Array.isArray(user.roles) && user.roles.includes("ADMIN"));
  const permissionCodes = useMemo(() => Array.from(new Set(capabilityMatrix.flatMap((item) => item.permissions || []))), [capabilityMatrix]);

  useEffect(() => {
    const next = snapshot?.ticket_fee_policies?.[0];
    if (next) setTicketFee(next);
    const nextRoleFees = {};
    ROLE_LABELS.forEach((role) => {
      const fee = (snapshot?.fees || []).find((item) => item.role_code === role);
      nextRoleFees[role] = { enabled: fee?.enabled !== false, amount: fee?.amount ?? 0, currency: fee?.currency || "NGN", reviewHours: fee?.organizer_review_hours || 24 };
    });
    setRoleFees(nextRoleFees);
  }, [snapshot]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadRoleCapabilityMatrix(), selectedAdminId ? loadAdminPermissionGrants(selectedAdminId) : Promise.resolve([])])
      .then(([matrix, grants]) => { if (mounted) { setCapabilityMatrix(matrix || []); setAdminGrants(grants || []); } })
      .catch(() => { if (mounted) { setCapabilityMatrix([]); setAdminGrants([]); } });
    return () => { mounted = false; };
  }, [selectedAdminId]);

  const toggleAdminPermission = async (permissionCode, granted) => {
    if (!selectedAdminId) return;
    setPermissionBusy(true);
    try {
      await setAdminPermission(selectedAdminId, permissionCode, granted);
      setAdminGrants(await loadAdminPermissionGrants(selectedAdminId));
    } finally {
      setPermissionBusy(false);
    }
  };

  const saveTicketFee = () => onAct?.(
    () => setPlatformFeePolicy("TICKET_SALE", ticketFee.enabled !== false, ticketFee.fee_type, ticketFee.amount, ticketFee.currency || "NGN"),
    "Ticket-sale fee policy saved.",
  );
  const saveRoleFee = (role) => {
    const value = roleFees[role] || {};
    return onAct?.(() => setRoleFeePolicy(role, value.enabled !== false, value.amount, value.currency || "NGN", value.reviewHours || 24), `${formatRole(role)} verification fee saved.`);
  };
  const addQuestion = () => {
    if (!question.prompt.trim()) return;
    onAct?.(() => saveOnboardingQuestion(question), "Onboarding question saved.");
    setQuestion((current) => ({ ...current, prompt: "", sortOrder: Number(current.sortOrder || 0) + 1 }));
  };
  const roleFeeRows = useMemo(() => ROLE_LABELS.map((role) => ({ role, value: roleFees[role] || { enabled: true, amount: 0, currency: "NGN", reviewHours: 24 } })), [roleFees]);

  return <div>
    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-semibold" style={{ color: C.ivory }}>Ticket-sale fee policy</h2><p className="text-[11px] mt-1" style={{ color: C.muted }}>Choose a fixed NGN charge or percentage fee. The server validates the policy before it is applied to commerce.</p></div><span className="text-[10px] uppercase" style={{ color: ticketFee.enabled === false ? C.red : C.goldSoft }}>{ticketFee.enabled === false ? "Disabled" : "Active"}</span></div>
      <div className="grid grid-cols-2 gap-2 mb-2"><select value={ticketFee.fee_type || "PERCENTAGE"} onChange={(event) => setTicketFee({ ...ticketFee, fee_type: event.target.value })} className="rounded-xl px-3 py-3 text-[12px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select><input type="number" min="0" max={ticketFee.fee_type === "PERCENTAGE" ? 100 : undefined} value={ticketFee.amount ?? 0} onChange={(event) => setTicketFee({ ...ticketFee, amount: event.target.value })} className="rounded-xl px-3 py-3 text-[12px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /></div>
      <div className="flex items-center justify-between gap-3"><label className="text-[11px] flex items-center gap-2" style={{ color: C.muted }}><input type="checkbox" checked={ticketFee.enabled !== false} onChange={(event) => setTicketFee({ ...ticketFee, enabled: event.target.checked })} /> Enable ticket-sale fee</label><button type="button" disabled={busy} onClick={saveTicketFee} className="rounded-xl px-4 py-2 text-[11px] font-semibold" style={{ background: C.gold, color: C.bg }}>Save policy</button></div>
    </section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Role verification policies</h2>
      <div className="grid gap-3">{roleFeeRows.map(({ role, value }) => <div key={role} className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><div className="flex items-center justify-between gap-2 mb-2"><p className="text-[12px]" style={{ color: C.ivory }}>{formatRole(role)}</p><label className="text-[10px] flex items-center gap-1" style={{ color: C.muted }}><input type="checkbox" checked={value.enabled !== false} onChange={(event) => setRoleFees((current) => ({ ...current, [role]: { ...value, enabled: event.target.checked } }))} /> Enabled</label></div><div className="grid grid-cols-3 gap-2"><input type="number" min="0" value={value.amount ?? 0} onChange={(event) => setRoleFees((current) => ({ ...current, [role]: { ...value, amount: event.target.value } }))} className="rounded-xl px-3 py-2 text-[11px]" placeholder="Fee" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /><input value={value.currency || "NGN"} onChange={(event) => setRoleFees((current) => ({ ...current, [role]: { ...value, currency: event.target.value.toUpperCase() } }))} className="rounded-xl px-3 py-2 text-[11px]" placeholder="Currency" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /><input type="number" min="1" max="720" value={value.reviewHours ?? 24} onChange={(event) => setRoleFees((current) => ({ ...current, [role]: { ...value, reviewHours: event.target.value } }))} className="rounded-xl px-3 py-2 text-[11px]" placeholder="Review hours" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /></div><button type="button" disabled={busy} onClick={() => saveRoleFee(role)} className="rounded-xl px-3 py-2 mt-2 text-[10px] font-semibold" style={{ background: C.gold, color: C.bg }}>Save {formatRole(role)} policy</button></div>)}</div>
    </section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Configured onboarding questions</h2>
      <div className="grid grid-cols-2 gap-2 mb-3"><select value={question.roleCode} onChange={(event) => setQuestion({ ...question, roleCode: event.target.value })} className="rounded-xl px-3 py-2 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}>{ROLE_LABELS.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select><select value={question.questionType} onChange={(event) => setQuestion({ ...question, questionType: event.target.value })} className="rounded-xl px-3 py-2 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="SHORT_TEXT">Short text</option><option value="LONG_TEXT">Long text</option><option value="YES_NO">Yes / No</option><option value="SINGLE_SELECT">Single select</option></select></div><textarea value={question.prompt} onChange={(event) => setQuestion({ ...question, prompt: event.target.value })} placeholder="Ask a verification question" rows={2} className="w-full rounded-xl px-3 py-2 text-[11px] mb-2" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="flex items-center justify-between gap-2"><label className="text-[10px] flex items-center gap-1" style={{ color: C.muted }}><input type="checkbox" checked={question.required} onChange={(event) => setQuestion({ ...question, required: event.target.checked })} /> Required</label><button type="button" disabled={busy || !question.prompt.trim()} onClick={addQuestion} className="rounded-xl px-3 py-2 text-[10px] font-semibold" style={{ background: C.gold, color: C.bg }}>Add question</button></div><div className="mt-4">{questions.slice(0, 30).map((item) => <div key={item.id} className="py-2 border-b" style={{ borderColor: C.line }}><p className="text-[11px]" style={{ color: C.ivory }}>{formatRole(item.role_code)} · {item.prompt}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.question_type} · {item.required ? "Required" : "Optional"}</p></div>)}{!questions.length && <Empty label="No active onboarding questions configured." C={C} />}</div>
    </section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Role capability matrix and Admin delegation</h2><p className="text-[10px] mb-3" style={{ color: C.muted }}>Permissions are read from the live capability catalog. Admin grants are server-authoritative and remain subject to Super Admin control.</p><div className="grid grid-cols-2 gap-2 mb-3">{capabilityMatrix.map((item) => <div key={item.role} className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[11px] font-semibold" style={{ color: C.ivory }}>{formatRole(item.role)}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{(item.permissions || []).length} permissions · {item.enforcement || "role scoped"}</p></div>)}{!capabilityMatrix.length && <Empty label="Capability matrix unavailable" C={C} />}</div><select value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)} className="w-full rounded-xl px-3 py-2 text-[11px] mb-2" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="">Select an Admin for delegated permissions</option>{adminUsers.map((user) => <option key={user.id} value={user.id}>{user.profile?.full_name || user.email || user.id}</option>)}</select>{selectedAdminId && <div className="grid grid-cols-2 gap-2">{permissionCodes.map((permissionCode) => { const granted = adminGrants.some((grant) => grant.permission_code === permissionCode && grant.granted !== false); return <label key={permissionCode} className="rounded-xl p-2 text-[10px] flex items-center gap-2" style={{ background: C.card2, color: C.muted, border: `1px solid ${C.line}` }}><input type="checkbox" disabled={permissionBusy} checked={granted} onChange={(event) => toggleAdminPermission(permissionCode, event.target.checked)} />{permissionCode}</label>; })}</div>}</section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Event lifecycle and allocated tickets</h2><div className="grid grid-cols-2 gap-2 mb-3"><Metric label="Past events" value={lifecycle.past} C={C} /><Metric label="Active events" value={lifecycle.active} C={C} /><Metric label="Future events" value={lifecycle.future} C={C} /><Metric label="Cancelled events" value={lifecycle.cancelled} C={C} /></div><div className="grid grid-cols-2 gap-2"><Metric label="Capacity" value={tickets.capacity} C={C} /><Metric label="Reserved" value={tickets.reserved} C={C} /><Metric label="Sold" value={tickets.sold} C={C} /><Metric label="Issued / checked in" value={tickets.issued} C={C} /><Metric label="Cancelled / refunded" value={tickets.cancelled} C={C} /><Metric label="Wallet credits" value={money((snapshot?.wallets || []).reduce((sum, item) => sum + Number(item.balance || 0), 0))} C={C} /></div><p className="text-[10px] mt-3" style={{ color: C.muted }}>Stop, restore, ticket allocation, and wallet-credit actions remain available through the protected event controls above.</p></section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Support requests routed to governance</h2>{support.slice(0, 20).map((item) => <div key={item.id} className="py-2 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between gap-2"><p className="text-[11px]" style={{ color: C.ivory }}>{item.subject || "Support request"}</p><span className="text-[10px]" style={{ color: C.goldSoft }}>{item.status}</span></div><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.category || "GENERAL"} · {item.message || "No message"}</p></div>)}{!support.length && <Empty label="No open support requests." C={C} />}</section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Niche engagement analytics</h2><div className="grid grid-cols-2 gap-2">{Object.entries(engagement).map(([type, values]) => <div key={type} className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[11px] font-semibold" style={{ color: C.ivory }}>{formatRole(type)}</p><p className="text-[10px] mt-2" style={{ color: C.muted }}>Likes {values?.likes || 0} · Ratings {values?.ratings || 0} · Comments {values?.comments || 0}</p><p className="text-[10px] mt-1" style={{ color: C.goldSoft }}>Average rating {values?.average_rating || 0}/5</p></div>)}{!Object.keys(engagement).length && <Empty label="No engagement signals have been recorded yet." C={C} />}</div><p className="text-[10px] mt-3" style={{ color: C.muted }}>These live metrics feed Super Admin analytics and the public Top/Trending summaries without generating placeholder values.</p></section>
  </div>;
}
