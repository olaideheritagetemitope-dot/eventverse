import React, { useEffect, useMemo, useState } from "react";
import { loadAdminPermissionGrants, loadPremiumAdminPlans, loadPremiumAdminMonitoring, loadRoleCapabilityMatrix, saveOnboardingQuestion, setAdminPermission, setOnboardingQuestionStatus, setPlatformFeePolicy, setRoleFeePolicy, createPremiumPlan, setPremiumPlan } from "../services/user";

const ROLE_LABELS = ["ARTIST", "ORGANIZER", "VENUE_MANAGER"];
const PREMIUM_FEATURES = [
  ["advanced_discovery", "Advanced discovery", "Category, price, and distance filters"],
  ["follow_radar", "Follow Radar", "Upcoming events from followed artists"],
  ["planner", "Personal event planner", "Saved events and held tickets"],
  ["personal_statistics", "Personal music statistics", "Private listening totals and top songs"],
  ["premium_badge", "Premium profile badge", "Show Premium on subscriber profiles"],
  ["recommendations", "Recommendations", "Personalized discovery recommendations"],
  ["premium_alerts", "Premium alerts", "Premium-only event and release alerts"],
  ["early_access", "Early access", "Premium ticket release eligibility"],
  ["advanced_playlists", "Advanced playlists", "Expanded playlist tooling"],
  ["advanced_location", "Advanced location", "Distance-aware discovery"],
  ["ticket_perks", "Ticket perks", "Premium ticket benefits"],
  ["smart_notifications", "Smart notifications", "Contextual attendee notifications"],
];
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
  const [premiumPlans, setPremiumPlans] = useState([]);
  const [premiumPlanId, setPremiumPlanId] = useState("");
  const [premiumPlanForm, setPremiumPlanForm] = useState(null);
  const [premiumPlanLoading, setPremiumPlanLoading] = useState(true);
  const [premiumPlanError, setPremiumPlanError] = useState("");
  const [premiumPlanSaving, setPremiumPlanSaving] = useState(false);
  const [premiumPlanCreating, setPremiumPlanCreating] = useState(false);
  const [premiumPlanCreateForm, setPremiumPlanCreateForm] = useState({ code: "", name: "", description: "", amount: "", currency: "NGN", interval: "MONTH", intervalCount: 1, isActive: false, features: {} });
  const [premiumPlanMessage, setPremiumPlanMessage] = useState("");
  const [premiumMonitoring, setPremiumMonitoring] = useState({ subscriptions: [], payments: [], generated_at: null });
  const [premiumMonitoringLoading, setPremiumMonitoringLoading] = useState(true);
  const [premiumMonitoringError, setPremiumMonitoringError] = useState("");
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

  useEffect(() => {
    let mounted = true;
    setPremiumMonitoringLoading(true);
    setPremiumMonitoringError("");
    loadPremiumAdminMonitoring(100)
      .then((data) => { if (mounted) setPremiumMonitoring(data || { subscriptions: [], payments: [], generated_at: null }); })
      .catch((error) => { if (mounted) setPremiumMonitoringError(error.message || "Premium monitoring is unavailable."); })
      .finally(() => { if (mounted) setPremiumMonitoringLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    setPremiumPlanLoading(true);
    setPremiumPlanError("");
    loadPremiumAdminPlans()
      .then((plans) => {
        if (!mounted) return;
        setPremiumPlans(plans || []);
        const first = plans?.[0];
        if (first) {
          setPremiumPlanId(first.id);
          setPremiumPlanForm({ ...first, features: { ...(first.features || {}) } });
        }
      })
      .catch((error) => { if (mounted) setPremiumPlanError(error.message || "Premium plan settings are unavailable."); })
      .finally(() => { if (mounted) setPremiumPlanLoading(false); });
    return () => { mounted = false; };
  }, []);

  const selectPremiumPlan = (planId) => {
    setPremiumPlanId(planId);
    const selected = premiumPlans.find((plan) => plan.id === planId);
    if (selected) setPremiumPlanForm({ ...selected, features: { ...(selected.features || {}) } });
    setPremiumPlanMessage("");
  };

  const createPremiumPlanFromForm = async () => {
    if (!premiumPlanCreateForm.code.trim() || !premiumPlanCreateForm.name.trim()) {
      setPremiumPlanError("Plan code and name are required.");
      return;
    }
    setPremiumPlanCreating(true);
    setPremiumPlanMessage("");
    setPremiumPlanError("");
    try {
      const created = await createPremiumPlan(premiumPlanCreateForm);
      const nextPlans = [...premiumPlans, created];
      setPremiumPlans(nextPlans);
      setPremiumPlanId(created.id);
      setPremiumPlanForm({ ...created, features: { ...(created.features || {}) } });
      setPremiumPlanCreateForm({ code: "", name: "", description: "", amount: "", currency: "NGN", interval: "MONTH", intervalCount: 1, isActive: false, features: {} });
      setPremiumPlanMessage("Premium plan created.");
    } catch (error) {
      setPremiumPlanError(error.message || "Unable to create Premium plan.");
    } finally {
      setPremiumPlanCreating(false);
    }
  };

  const savePremiumPlanChanges = async () => {
    if (!premiumPlanForm?.id) return;
    setPremiumPlanSaving(true);
    setPremiumPlanMessage("");
    setPremiumPlanError("");
    try {
      const saved = await setPremiumPlan(premiumPlanForm.id, {
        name: premiumPlanForm.name,
        amount: premiumPlanForm.amount,
        currency: premiumPlanForm.currency || "NGN",
        interval: premiumPlanForm.interval || "MONTH",
        features: premiumPlanForm.features || {},
        isActive: premiumPlanForm.is_active !== false,
      });
      setPremiumPlans((current) => current.map((plan) => plan.id === saved.id ? saved : plan));
      setPremiumPlanForm({ ...saved, features: { ...(saved.features || {}) } });
      setPremiumPlanMessage("Premium plan settings saved.");
    } catch (error) {
      setPremiumPlanError(error.message || "Unable to save Premium plan settings.");
    } finally {
      setPremiumPlanSaving(false);
    }
  };

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
      <div className="grid grid-cols-2 gap-2 mb-3"><select value={question.roleCode} onChange={(event) => setQuestion({ ...question, roleCode: event.target.value })} className="rounded-xl px-3 py-2 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}>{ROLE_LABELS.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select><select value={question.questionType} onChange={(event) => setQuestion({ ...question, questionType: event.target.value })} className="rounded-xl px-3 py-2 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="SHORT_TEXT">Short text</option><option value="LONG_TEXT">Long text</option><option value="YES_NO">Yes / No</option><option value="SINGLE_SELECT">Single select</option></select></div><textarea value={question.prompt} onChange={(event) => setQuestion({ ...question, prompt: event.target.value })} placeholder="Ask a verification question" rows={2} className="w-full rounded-xl px-3 py-2 text-[11px] mb-2" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><div className="flex items-center justify-between gap-2"><label className="text-[10px] flex items-center gap-1" style={{ color: C.muted }}><input type="checkbox" checked={question.required} onChange={(event) => setQuestion({ ...question, required: event.target.checked })} /> Required</label><button type="button" disabled={busy || !question.prompt.trim()} onClick={addQuestion} className="rounded-xl px-3 py-2 text-[10px] font-semibold" style={{ background: C.gold, color: C.bg }}>Add question</button></div><div className="mt-4">{questions.slice(0, 100).map((item) => { const active = item.active !== false; return <div key={item.id} className="py-2 border-b" style={{ borderColor: C.line }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px]" style={{ color: C.ivory }}>{formatRole(item.role_code)} · {item.prompt}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.question_type} · {item.required ? "Required" : "Optional"} · {active ? "Published" : "Deleted / unpublished"}</p></div><div className="flex items-center gap-1 shrink-0"><button type="button" title={active ? "Delete this onboarding question" : "Publish this onboarding question"} aria-label={active ? `Delete ${formatRole(item.role_code)} onboarding question` : `Publish ${formatRole(item.role_code)} onboarding question`} disabled={busy} onClick={() => onAct?.(() => setOnboardingQuestionStatus(item.id, active ? "DEACTIVATE" : "PUBLISH", active ? "Removed from future onboarding" : "Published again"), active ? "Question deleted from future onboarding." : "Question published again.")} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold whitespace-nowrap" style={{ minWidth: 86, background: active ? `${C.red}22` : `${C.gold}22`, color: active ? C.red : C.goldSoft, border: `1px solid ${active ? C.red : C.gold}66` }}>{active ? "Delete question" : "Publish question"}</button>{!active && <button type="button" disabled={busy} onClick={() => onAct?.(() => setOnboardingQuestionStatus(item.id, "RESTORE", "Restored by Super Admin"), "Question restored.")} className="rounded-lg px-2 py-1 text-[9px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}>Restore</button>}</div></div></div>; })}{!questions.length && <Empty label="No onboarding questions configured." C={C} />}</div>
    </section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Role capability matrix and Admin delegation</h2><p className="text-[10px] mb-3" style={{ color: C.muted }}>Permissions are read from the live capability catalog. Admin grants are server-authoritative and remain subject to Super Admin control.</p><div className="grid grid-cols-2 gap-2 mb-3">{capabilityMatrix.map((item) => <div key={item.role} className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[11px] font-semibold" style={{ color: C.ivory }}>{formatRole(item.role)}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{(item.permissions || []).length} permissions · {item.enforcement || "role scoped"}</p></div>)}{!capabilityMatrix.length && <Empty label="Capability matrix unavailable" C={C} />}</div><select value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)} className="w-full rounded-xl px-3 py-2 text-[11px] mb-2" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="">Select an Admin for delegated permissions</option>{adminUsers.map((user) => <option key={user.id} value={user.id}>{user.profile?.full_name || user.email || user.id}</option>)}</select>{selectedAdminId && <div className="grid grid-cols-2 gap-2">{permissionCodes.map((permissionCode) => { const granted = adminGrants.some((grant) => grant.permission_code === permissionCode && grant.granted !== false); return <label key={permissionCode} className="rounded-xl p-2 text-[10px] flex items-center gap-2" style={{ background: C.card2, color: C.muted, border: `1px solid ${C.line}` }}><input type="checkbox" disabled={permissionBusy} checked={granted} onChange={(event) => toggleAdminPermission(permissionCode, event.target.checked)} />{permissionCode}</label>; })}</div>}</section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-semibold" style={{ color: C.ivory }}>Premium attendee configuration</h2><p className="text-[11px] mt-1" style={{ color: C.muted }}>Manage the single canonical Premium plan used by checkout and server-side entitlement gates. Feature switches apply to the selected plan.</p></div><span className="text-[10px] uppercase" style={{ color: premiumPlanForm?.is_active === false ? C.red : C.goldSoft }}>{premiumPlanForm?.is_active === false ? "Inactive" : "Active"}</span></div>
      {premiumPlanLoading && <Empty label="Loading Premium plans..." C={C} />}
      {!premiumPlanLoading && premiumPlanError && <p className="text-[11px] py-2" style={{ color: C.red }}>{premiumPlanError}</p>}
      {!premiumPlanLoading && !premiumPlanError && !premiumPlans.length && <Empty label="No Premium plans configured." C={C} />}
      {!premiumPlanLoading && !premiumPlanError && premiumPlans.length > 0 && <>
        <select value={premiumPlanId} onChange={(event) => selectPremiumPlan(event.target.value)} className="w-full rounded-xl px-3 py-2.5 text-[11px] mb-3" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}>{premiumPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name || "Premium plan"} · {plan.currency || "NGN"} {Number(plan.amount || 0).toLocaleString()} · {plan.is_active === false ? "Inactive" : "Active"}</option>)}</select>
        {premiumPlanForm && <>
          <div className="grid grid-cols-2 gap-2 mb-2"><input value={premiumPlanForm.name || ""} onChange={(event) => setPremiumPlanForm((current) => ({ ...current, name: event.target.value }))} placeholder="Plan name" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><input type="number" min="0" value={premiumPlanForm.amount ?? 0} onChange={(event) => setPremiumPlanForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /></div>
          <div className="grid grid-cols-3 gap-2 mb-3"><input value={premiumPlanForm.currency || "NGN"} onChange={(event) => setPremiumPlanForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="Currency" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><select value={premiumPlanForm.interval || "MONTH"} onChange={(event) => setPremiumPlanForm((current) => ({ ...current, interval: event.target.value }))} className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="MONTH">Monthly</option><option value="YEAR">Yearly</option></select><label className="rounded-xl px-2 py-2.5 text-[10px] flex items-center gap-2" style={{ background: C.card2, color: C.muted }}><input type="checkbox" checked={premiumPlanForm.is_active !== false} onChange={(event) => setPremiumPlanForm((current) => ({ ...current, is_active: event.target.checked }))} /> Published</label></div>
          <p className="text-[10px] uppercase tracking-[0.14em] mb-2" style={{ color: C.muted }}>Feature switches</p>
          <div className="grid grid-cols-2 gap-2">{PREMIUM_FEATURES.map(([key, label, description]) => <label key={key} className="rounded-xl p-2.5 flex items-start gap-2" style={{ background: C.card2, border: `1px solid ${C.line}` }}><input type="checkbox" checked={premiumPlanForm.features?.[key] === true} onChange={(event) => setPremiumPlanForm((current) => ({ ...current, features: { ...(current.features || {}), [key]: event.target.checked } }))} /><span><span className="block text-[10px] font-semibold" style={{ color: C.ivory }}>{label}</span><span className="block text-[9px] mt-1" style={{ color: C.muted }}>{description}</span></span></label>)}</div>
          <div className="flex items-center justify-between gap-2 mt-3"><span className="text-[10px]" style={{ color: premiumPlanMessage ? C.green : C.red }}>{premiumPlanMessage || premiumPlanError}</span><button type="button" disabled={premiumPlanSaving} onClick={savePremiumPlanChanges} className="rounded-xl px-4 py-2 text-[11px] font-semibold" style={{ background: C.gold, color: C.bg }}>{premiumPlanSaving ? "Saving..." : "Save Premium plan"}</button></div>
        </>}
      </>}
      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
        <p className="text-[12px] font-semibold" style={{ color: C.ivory }}>Create another Premium plan</p>
        <p className="text-[10px] mt-1 mb-3" style={{ color: C.muted }}>Use a unique code for a separate monthly or yearly offer. New plans are inactive until published.</p>
        <div className="grid grid-cols-2 gap-2 mb-2"><input value={premiumPlanCreateForm.code} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Plan code" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><input value={premiumPlanCreateForm.name} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Plan name" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /></div>
        <input value={premiumPlanCreateForm.description} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description (optional)" className="w-full rounded-xl px-3 py-2.5 text-[11px] mb-2" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} />
        <div className="grid grid-cols-4 gap-2"><input type="number" min="0" value={premiumPlanCreateForm.amount} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Price" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><input value={premiumPlanCreateForm.currency} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="Currency" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /><select value={premiumPlanCreateForm.interval} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, interval: event.target.value }))} className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }}><option value="MONTH">Monthly</option><option value="YEAR">Yearly</option></select><input type="number" min="1" value={premiumPlanCreateForm.intervalCount} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, intervalCount: event.target.value }))} placeholder="Count" className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: C.card2, color: C.ivory, border: `1px solid ${C.line}` }} /></div>
        <label className="text-[10px] flex items-center gap-2 mt-3" style={{ color: C.muted }}><input type="checkbox" checked={premiumPlanCreateForm.isActive} onChange={(event) => setPremiumPlanCreateForm((current) => ({ ...current, isActive: event.target.checked }))} /> Publish immediately</label>
        <button type="button" disabled={premiumPlanCreating} onClick={createPremiumPlanFromForm} className="rounded-xl px-4 py-2 mt-3 text-[11px] font-semibold" style={{ background: C.gold, color: C.bg }}>{premiumPlanCreating ? "Creating..." : "Create Premium plan"}</button>
      </div>
    </section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-semibold" style={{ color: C.ivory }}>Premium subscribers and payments</h2><p className="text-[11px] mt-1" style={{ color: C.muted }}>Live operational visibility from the canonical Premium subscription and payment records.</p></div><span className="text-[10px] uppercase" style={{ color: C.goldSoft }}>{premiumMonitoringLoading ? "Loading" : "Live"}</span></div>
      {premiumMonitoringError && <p className="text-[11px] py-2" style={{ color: C.red }}>{premiumMonitoringError}</p>}
      {!premiumMonitoringLoading && !premiumMonitoringError && <>
        <div className="grid grid-cols-2 gap-2 mb-4"><Metric label="Subscriptions" value={(premiumMonitoring.subscriptions || []).length} C={C} /><Metric label="Payments" value={(premiumMonitoring.payments || []).length} C={C} /></div>
        <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Recent subscribers</p>
        {(premiumMonitoring.subscriptions || []).slice(0, 8).map((item) => <div key={item.id} className="py-2 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between gap-2"><p className="text-[11px]" style={{ color: C.ivory }}>{item.full_name || item.email || item.user_id}</p><span className="text-[10px]" style={{ color: item.status === "ACTIVE" ? C.green : C.goldSoft }}>{item.status}</span></div><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.current_period_end ? `Period ends ${new Date(item.current_period_end).toLocaleDateString()}` : "No period end recorded"}</p></div>)}
        {!(premiumMonitoring.subscriptions || []).length && <Empty label="No Premium subscriptions recorded yet." C={C} />}
        <p className="text-[10px] uppercase tracking-wide mt-4 mb-2" style={{ color: C.muted }}>Recent payment attempts</p>
        {(premiumMonitoring.payments || []).slice(0, 8).map((item) => <div key={item.id} className="py-2 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between gap-2"><p className="text-[11px]" style={{ color: C.ivory }}>{item.full_name || item.email || item.user_id}</p><span className="text-[10px]" style={{ color: item.status === "SUCCESS" ? C.green : item.status === "FAILED" ? C.red : C.goldSoft }}>{item.status}</span></div><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.plan_name || item.plan_code || "Premium plan"} · {item.currency || ""} {Number(item.amount || 0).toLocaleString()} · {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</p></div>)}
        {!(premiumMonitoring.payments || []).length && <Empty label="No Premium payments recorded yet." C={C} />}
      </>}
    </section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Event lifecycle and allocated tickets</h2><div className="grid grid-cols-2 gap-2 mb-3"><Metric label="Past events" value={lifecycle.past} C={C} /><Metric label="Active events" value={lifecycle.active} C={C} /><Metric label="Future events" value={lifecycle.future} C={C} /><Metric label="Cancelled events" value={lifecycle.cancelled} C={C} /></div><div className="grid grid-cols-2 gap-2"><Metric label="Capacity" value={tickets.capacity} C={C} /><Metric label="Reserved" value={tickets.reserved} C={C} /><Metric label="Sold" value={tickets.sold} C={C} /><Metric label="Issued / checked in" value={tickets.issued} C={C} /><Metric label="Cancelled / refunded" value={tickets.cancelled} C={C} /><Metric label="Wallet credits" value={money((snapshot?.wallets || []).reduce((sum, item) => sum + Number(item.balance || 0), 0))} C={C} /></div><p className="text-[10px] mt-3" style={{ color: C.muted }}>Stop, restore, ticket allocation, and wallet-credit actions remain available through the protected event controls above.</p></section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Support requests routed to governance</h2>{support.slice(0, 20).map((item) => <div key={item.id} className="py-2 border-b" style={{ borderColor: C.line }}><div className="flex items-center justify-between gap-2"><p className="text-[11px]" style={{ color: C.ivory }}>{item.subject || "Support request"}</p><span className="text-[10px]" style={{ color: C.goldSoft }}>{item.status}</span></div><p className="text-[10px] mt-1" style={{ color: C.muted }}>{item.category || "GENERAL"} · {item.message || "No message"}</p></div>)}{!support.length && <Empty label="No open support requests." C={C} />}</section>

    <section className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}><h2 className="font-semibold mb-3" style={{ color: C.ivory }}>Niche engagement analytics</h2><div className="grid grid-cols-2 gap-2">{Object.entries(engagement).map(([type, values]) => <div key={type} className="rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}><p className="text-[11px] font-semibold" style={{ color: C.ivory }}>{formatRole(type)}</p><p className="text-[10px] mt-2" style={{ color: C.muted }}>Likes {values?.likes || 0} · Ratings {values?.ratings || 0} · Comments {values?.comments || 0}</p><p className="text-[10px] mt-1" style={{ color: C.goldSoft }}>Average rating {values?.average_rating || 0}/5</p></div>)}{!Object.keys(engagement).length && <Empty label="No engagement signals have been recorded yet." C={C} />}</div><p className="text-[10px] mt-3" style={{ color: C.muted }}>These live metrics feed Super Admin analytics and the public Top/Trending summaries without generating placeholder values.</p></section>
  </div>;
}
