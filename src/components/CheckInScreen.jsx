import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ScanLine, Video, X, RefreshCw, Camera, ShieldAlert } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { checkInTicketWithToken, eventStaffEntryDecision } from "../services/user";

const C = { bg: "#0B0A08", card: "#17140F", gold: "#CDA349", goldSoft: "#E4C179", ivory: "#F3EEE3", muted: "#8B8577", line: "#2A2419", red: "#E98979", green: "#76C893" };

export default function CheckInScreen({ nav, data }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const [qrToken, setQrToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permissionState, setPermissionState] = useState("unknown");
  const [scanError, setScanError] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const staffMode = ["SECURITY_GATE", "CHECK_IN", "REGISTRATION"].includes(data?.responsibility);

  const stopScanner = () => {
    controlsRef.current?.stop?.();
    controlsRef.current = null;
    readerRef.current?.reset?.();
    readerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  useEffect(() => () => stopScanner(), []);

  const startScanner = async () => {
    setScanError("");
    setPermissionState("requesting");
    if (typeof window === "undefined" || !window.isSecureContext) {
      setPermissionState("blocked");
      setScanError("Camera access requires a secure HTTPS connection. Enter the ticket token manually instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState("unsupported");
      setScanError("Camera scanning is not supported by this browser. Enter the ticket token manually instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setPermissionState("granted");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      setScanning(true);
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (scanResult, scanError) => {
        if (scanResult?.getText()) {
          setQrToken(scanResult.getText());
          stopScanner();
        } else if (scanError && scanError.name !== "NotFoundException") {
          console.warn("Atizzy QR detection warning", scanError);
        }
      });
      controlsRef.current = controls;
    } catch (cameraError) {
      setPermissionState(cameraError?.name === "NotAllowedError" ? "denied" : "error");
      setScanError(cameraError?.name === "NotAllowedError" ? "Camera access was denied. You can try again or enter the ticket token manually." : cameraError?.message || "Unable to open the camera. Enter the ticket token manually instead.");
      stopScanner();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const token = qrToken.trim();
      const value = staffMode ? await eventStaffEntryDecision(token, "ACCEPT") : await checkInTicketWithToken(token);
      setResult(value);
      setQrToken("");
    } catch (submitError) {
      setError(submitError.message || "This ticket could not be checked in.");
    } finally {
      setBusy(false);
    }
  };

  const rejectEntry = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const value = await eventStaffEntryDecision(qrToken.trim(), "REJECT");
      setResult(value); setQrToken("");
    } catch (rejectError) {
      setError(rejectError.message || "Unable to record entry decision.");
    } finally {
      setBusy(false);
    }
  };

  const scannerMessage = permissionState === "denied" ? "Camera access denied." : permissionState === "blocked" ? "Camera access is blocked by your browser." : "Atizzy needs camera access to scan tickets.";
  const resultTone = result?.decision === "REJECT" || result?.status === "already_checked_in" ? C.red : C.green;

  return <div className="ev-root ev-app-viewport" style={{ background: C.bg, color: C.ivory }}><div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col"><div className="flex items-center gap-3 px-5 pb-4 pt-8" style={{ borderBottom: `1px solid ${C.line}` }}><button type="button" onClick={nav.pop} aria-label="Back" style={{ color: C.gold }}><span aria-hidden="true">←</span></button><div><p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Protected operations</p><h1 className="ev-display text-[22px]" style={{ color: C.ivory }}>Ticket check-in</h1></div></div><main className="flex-1 px-5 py-6"><div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><ScanLine size={28} color={C.gold} /><p className="mt-4 text-[13px] leading-6" style={{ color: C.muted }}>{staffMode ? `${String(data?.responsibility || "CHECK_IN").replaceAll("_", " ")} entry desk for ${data?.eventTitle || "your assigned event"}.` : "Scan a verified Atizzy QR code or enter the server-issued QR token manually."} Authorization, ticket validity, event scope, and one-time check-in are enforced by Supabase.</p>{!scanning && permissionState !== "granted" && <div className="mt-4 rounded-xl p-3" style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}44` }}><div className="flex items-start gap-2"><Camera size={16} color={C.goldSoft} /><div><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>{scannerMessage}</p><p className="mt-1 text-[11px]" style={{ color: C.muted }}>Camera use is optional. The manual token fallback is always available.</p></div></div></div>}{scanning && <div className="relative mt-4 overflow-hidden rounded-xl" style={{ border: `1px solid ${C.gold}` }}><video ref={videoRef} muted playsInline className="h-56 w-full object-cover" /><div className="pointer-events-none absolute inset-8 rounded-xl" style={{ border: `2px solid ${C.goldSoft}`, boxShadow: `0 0 0 999px ${C.bg}55` }} /><p className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-semibold" style={{ color: C.ivory }}>Place the QR code inside the frame.</p><button type="button" onClick={stopScanner} aria-label="Stop scanner" className="absolute right-2 top-2 rounded-full p-2" style={{ background: C.bg, color: C.ivory }}><X size={16} /></button></div>}{scanError && <div className="mt-3 rounded-xl p-3" style={{ color: C.red, background: `${C.red}18` }}><div className="flex items-start gap-2"><ShieldAlert size={16} /><p className="text-[12px]">{scanError}</p></div></div>}<button type="button" onClick={scanning ? stopScanner : startScanner} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold" style={{ background: `${C.gold}20`, color: C.goldSoft, border: `1px solid ${C.gold}66` }}><Video size={16} />{scanning ? "Stop QR scanner" : permissionState === "denied" || permissionState === "error" ? "Try camera again" : "Allow camera and scan"}</button><form onSubmit={submit} className="mt-5"><label className="text-[12px]" style={{ color: C.goldSoft }}>Manual ticket / QR token fallback</label><input value={qrToken} onChange={(event) => setQrToken(event.target.value)} placeholder="Enter a server-issued QR token" className="mt-2 w-full rounded-xl px-3 py-3 text-[13px] outline-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /><button disabled={busy || !qrToken.trim()} className="mt-4 w-full rounded-xl py-3 text-[13px] font-semibold disabled:opacity-40" style={{ background: C.gold, color: C.bg }}>{busy ? "Validating securely..." : staffMode ? "Confirm valid entry" : "Check in ticket"}</button>{staffMode && <button type="button" disabled={busy || !qrToken.trim()} onClick={rejectEntry} className="mt-2 w-full rounded-xl py-3 text-[13px] font-semibold disabled:opacity-40" style={{ background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}55` }}>Reject entry</button>}</form>{error && <p className="mt-4 rounded-xl p-3 text-[12px]" style={{ color: C.red, background: `${C.red}18` }}>{error}</p>}{result && <div className="mt-4 rounded-xl p-4" style={{ color: resultTone, background: `${resultTone}18` }}><CheckCircle2 size={20} color={resultTone} /><p className="mt-2 text-[13px] font-semibold">{result.decision === "REJECT" ? (result.reason === "ALREADY_USED" ? "Entry rejected: ticket already used" : result.message || "Entry rejected") : result.status === "already_checked_in" ? "Ticket was already checked in" : "Valid entry recorded"}</p><p className="mt-1 text-[11px]" style={{ color: C.muted }}>Ticket: {result.ticket_id || "Verified server-side"}</p><button type="button" onClick={() => setResult(null)} className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: C.goldSoft }}><RefreshCw size={13} /> Scan another ticket</button></div>}</div></main></div></div>;
}
