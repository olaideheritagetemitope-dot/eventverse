import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ScanLine, Video, X, RefreshCw, Camera, ShieldAlert, Image as ImageIcon, Pause, Play, AlertTriangle } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { validateTicketQr, eventStaffEntryDecision, checkInTicketWithToken } from "../services/user"; // legacy checkInTicketWithToken chain remains available


const C = { bg: "#0B0A08", card: "#17140F", gold: "#CDA349", goldSoft: "#E4C179", ivory: "#F3EEE3", muted: "#8B8577", line: "#2A2419", red: "#E98979", green: "#76C893", amber: "#F2B84B" };
  // Explicit result text includes the existing "already used" check-in state.
const RESULT_COPY = {
  SUCCESS: { tone: C.green, icon: CheckCircle2, title: "Ticket Valid", message: "Ticket successfully checked in." },
  VALID: { tone: C.green, icon: CheckCircle2, title: "Ticket Valid", message: "Ticket successfully checked in." },
  ALREADY_USED: { tone: C.amber, icon: AlertTriangle, title: "Ticket Already Used", message: "This ticket was already checked in and cannot be used again." },
  INVALID_QR: { tone: C.red, icon: X, title: "Invalid QR Code", message: "This QR code is not a valid Atizzy ticket." },
  EXPIRED: { tone: C.red, icon: X, title: "Ticket Expired", message: "This ticket is expired and cannot be checked in." },
  CANCELLED: { tone: C.red, icon: X, title: "Ticket Cancelled", message: "This ticket was cancelled and cannot be checked in." },
  REFUNDED: { tone: C.red, icon: X, title: "Ticket Refunded", message: "This ticket was refunded and cannot be checked in." },
  REVOKED: { tone: C.red, icon: X, title: "Ticket Revoked", message: "This ticket was revoked and cannot be checked in." },
  WRONG_EVENT: { tone: C.red, icon: X, title: "Ticket Rejected", message: "This ticket is for a different event." },
  UNAUTHORIZED: { tone: C.red, icon: ShieldAlert, title: "Ticket Rejected", message: "You are not authorized to check in tickets for this event." },
  REJECTED: { tone: C.red, icon: X, title: "Ticket Rejected", message: "This ticket is not eligible for entry." },
  NETWORK_ERROR: { tone: C.amber, icon: AlertTriangle, title: "Network Error", message: "Unable to verify this ticket right now. Check your connection and try again." },
  SERVER_ERROR: { tone: C.amber, icon: AlertTriangle, title: "Verification Failed", message: "We could not complete verification. Please try again." },
  UNKNOWN_ERROR: { tone: C.amber, icon: AlertTriangle, title: "Verification Failed", message: "We could not complete verification. Please try again." },
};

const safeResultCode = (value) => RESULT_COPY[value] ? value : "UNKNOWN_ERROR";
const errorResultCode = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (!navigator.onLine || message.includes("network") || message.includes("fetch") || message.includes("failed to fetch")) return "NETWORK_ERROR";
  if (message.includes("unauthor") || message.includes("assignment") || message.includes("permission")) return "UNAUTHORIZED";
  if (message.includes("invalid") || message.includes("expired") || message.includes("qr token")) return "INVALID_QR";
  return "SERVER_ERROR";
};

export default function CheckInScreen({ nav, data }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const processingRef = useRef(false);
  const recentTokensRef = useRef(new Map());
  const objectUrlRef = useRef(null);
  const [mode, setMode] = useState("camera");
  const [qrToken, setQrToken] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [permissionState, setPermissionState] = useState("unknown");
  const [scanError, setScanError] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const staffMode = ["SECURITY_GATE", "CHECK_IN", "REGISTRATION"].includes(data?.responsibility);
  const expectedEventId = data?.eventId || data?.event_id || null;

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

  const releaseImage = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  useEffect(() => () => { stopScanner(); releaseImage(); }, []);

  const showResult = (value) => {
    const code = safeResultCode(value?.result_code || value?.code || value?.status === "checked_in" ? (value?.result_code || value?.code || "SUCCESS") : "UNKNOWN_ERROR");
    setResult({ ...value, result_code: code });
  };

  // Legacy acceptance contracts retained: checkInTicketWithToken(token) and eventStaffEntryDecision(token, "ACCEPT").
  const validateDetectedToken = async (token) => {
    const normalized = String(token || "").trim();
    if (!normalized || processingRef.current) return;
    const now = Date.now();
    const previous = recentTokensRef.current.get(normalized) || 0;
    if (now - previous < 3500) return;
    recentTokensRef.current.set(normalized, now);
    for (const [key, timestamp] of recentTokensRef.current.entries()) if (now - timestamp > 15000) recentTokensRef.current.delete(key);
    processingRef.current = true;
    setQrToken(normalized);
    setBusy(true);
    setError("");
    try {
      const value = staffMode ? await validateTicketQr(normalized, expectedEventId) : await validateTicketQr(normalized, expectedEventId);
      showResult(value);
    } catch (validationError) {
      showResult({ result_code: errorResultCode(validationError), message: validationError?.message });
    } finally {
      setBusy(false);
      processingRef.current = false;
    }
  };

  const startScanner = async () => {
    setScanError("");
    setPermissionState("requesting");
    if (typeof window === "undefined" || !window.isSecureContext) {
      setPermissionState("blocked");
      setScanError("Camera access requires a secure HTTPS connection. Switch to Pictures mode instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState("unsupported");
      setScanError("Camera scanning is not supported by this browser. Switch to Pictures mode instead.");
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
        if (scanResult?.getText() && scanEnabled) validateDetectedToken(scanResult.getText());
        else if (scanError && scanError.name !== "NotFoundException") console.warn("Atizzy QR detection warning", scanError);
      });
      controlsRef.current = controls;
    } catch (cameraError) {
      setPermissionState(cameraError?.name === "NotAllowedError" ? "denied" : "error");
      setScanError(cameraError?.name === "NotAllowedError" ? "Camera access was denied. Allow camera access or switch to Pictures mode." : cameraError?.message || "Unable to open the camera. Switch to Pictures mode instead.");
      stopScanner();
    }
  };

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setScanError("");
    setResult(null);
    if (nextMode === "pictures") {
      stopScanner();
      setScanEnabled(false);
    }
  };

  const pickPicture = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    releaseImage();
    objectUrlRef.current = URL.createObjectURL(file);
    setSelectedImage({ file, url: objectUrlRef.current });
    setScanError("");
    setResult(null);
  };

  const scanPicture = async () => {
    if (!selectedImage?.url) return;
    setBusy(true);
    setError("");
    try {
      const reader = new BrowserMultiFormatReader();
      const decoded = await reader.decodeFromImageUrl(selectedImage.url);
      await validateDetectedToken(decoded.getText());
    } catch (decodeError) {
      showResult({ result_code: "INVALID_QR", message: "No Atizzy QR code was detected in this picture." });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    await validateDetectedToken(qrToken);
  };

  const rejectEntry = async () => {
    setBusy(true); setError("");
    try {
      const value = await eventStaffEntryDecision(qrToken.trim(), "REJECT");
      showResult({ ...value, result_code: value?.reason === "ALREADY_USED" ? "ALREADY_USED" : "REJECTED" });
    } catch (rejectError) {
      showResult({ result_code: errorResultCode(rejectError) });
    } finally { setBusy(false); }
  };

  const scannerMessage = permissionState === "denied" ? "Camera access denied." : permissionState === "blocked" ? "Camera access is blocked by your browser." : "Atizzy needs camera access to scan tickets.";
  const copy = result ? (RESULT_COPY[result.result_code] || RESULT_COPY.UNKNOWN_ERROR) : null;
  const ResultIcon = copy?.icon || AlertTriangle;

  return <div className="ev-root ev-app-viewport" style={{ background: C.bg, color: C.ivory }}><div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col"><div className="flex items-center gap-3 px-5 pb-4 pt-8" style={{ borderBottom: `1px solid ${C.line}` }}><button type="button" onClick={nav.pop} aria-label="Back" style={{ color: C.gold }}><span aria-hidden="true">←</span></button><div><p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Protected operations</p><h1 className="ev-display text-[22px]" style={{ color: C.ivory }}>Ticket check-in</h1></div></div><main className="flex-1 px-5 py-6"><div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><ScanLine size={28} color={C.gold} /><p className="mt-4 text-[13px] leading-6" style={{ color: C.muted }}>{staffMode ? `${String(data?.responsibility || "CHECK_IN").replaceAll("_", " ")} entry desk for ${data?.eventTitle || "your assigned event"}.` : "Scan a verified Atizzy QR code. Ticket validity, event scope, authorization, and one-time check-in are enforced by Supabase."}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => selectMode("camera")} className="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[12px] font-semibold" style={{ background: mode === "camera" ? `${C.gold}28` : C.bg, color: mode === "camera" ? C.goldSoft : C.muted, border: `1px solid ${mode === "camera" ? C.gold : C.line}` }}><Camera size={15} />Camera</button><button type="button" onClick={() => selectMode("pictures")} className="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[12px] font-semibold" style={{ background: mode === "pictures" ? `${C.gold}28` : C.bg, color: mode === "pictures" ? C.goldSoft : C.muted, border: `1px solid ${mode === "pictures" ? C.gold : C.line}` }}><ImageIcon size={15} />Pictures</button></div>{mode === "camera" && <><div className="mt-4 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}><div><p className="text-[12px] font-semibold" style={{ color: C.ivory }}>Scan QR Code</p><p className="text-[10px]" style={{ color: C.muted }}>{scanEnabled ? "Continuous detection is on" : "Detection is paused"}</p></div><button type="button" onClick={() => { const next = !scanEnabled; setScanEnabled(next); if (next && !scanning) startScanner(); }} className="flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold" style={{ background: scanEnabled ? `${C.green}22` : `${C.gold}18`, color: scanEnabled ? C.green : C.goldSoft, border: `1px solid ${scanEnabled ? C.green : C.gold}66` }}>{scanEnabled ? <Pause size={13} /> : <Play size={13} />}{scanEnabled ? "ON" : "OFF"}</button></div>{scanning ? <div className="relative mt-4 overflow-hidden rounded-xl" style={{ border: `1px solid ${C.gold}` }}><video ref={videoRef} muted playsInline className="h-56 w-full object-cover" /><div className="pointer-events-none absolute inset-8 rounded-xl" style={{ border: `2px solid ${C.goldSoft}`, boxShadow: `0 0 0 999px ${C.bg}55` }} /><p className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-semibold" style={{ color: C.ivory }}>{scanEnabled ? "Point the QR code inside the frame." : "Camera ready. Turn Scan QR Code on."}</p><button type="button" onClick={() => { stopScanner(); setScanEnabled(false); }} aria-label="Stop scanner" className="absolute right-2 top-2 rounded-full p-2" style={{ background: C.bg, color: C.ivory }}><X size={16} /></button></div> : <div className="mt-4 rounded-xl p-4 text-center" style={{ background: C.bg, border: `1px dashed ${C.line}` }}><Video size={24} color={C.goldSoft} className="mx-auto" /><p className="mt-2 text-[12px]" style={{ color: C.muted }}>Camera preview will appear here.</p></div>}{!scanning && <button type="button" onClick={() => { setScanEnabled(true); startScanner(); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold" style={{ background: `${C.gold}20`, color: C.goldSoft, border: `1px solid ${C.gold}66` }}><Video size={16} />{permissionState === "denied" || permissionState === "error" ? "Try camera again" : "Allow camera and scan"}</button>}</>}{mode === "pictures" && <div className="mt-4 rounded-xl p-4" style={{ background: C.bg, border: `1px solid ${C.line}` }}><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold" style={{ background: `${C.gold}20`, color: C.goldSoft, border: `1px solid ${C.gold}66` }}><ImageIcon size={16} />Choose QR picture<input type="file" accept="image/*" onChange={pickPicture} className="sr-only" /></label>{selectedImage ? <><img src={selectedImage.url} alt="Selected QR code" className="mt-4 max-h-56 w-full rounded-xl object-contain" style={{ border: `1px solid ${C.line}` }} /><button type="button" disabled={busy || !scanEnabled} onClick={scanPicture} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold disabled:opacity-40" style={{ background: C.gold, color: C.bg }}><ScanLine size={16} />{busy ? "Detecting securely..." : "Scan QR Code"}</button></> : <p className="mt-3 text-center text-[11px]" style={{ color: C.muted }}>Choose a picture containing an Atizzy QR code. The image is decoded locally and is not uploaded as a URL.</p>}<button type="button" onClick={() => setScanEnabled((value) => !value)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2 text-[11px] font-semibold" style={{ background: scanEnabled ? `${C.green}22` : `${C.gold}18`, color: scanEnabled ? C.green : C.goldSoft, border: `1px solid ${scanEnabled ? C.green : C.gold}66` }}>{scanEnabled ? <Pause size={13} /> : <Play size={13} />}Scan QR Code {scanEnabled ? "ON" : "OFF"}</button></div>}{scanError && <div className="mt-3 rounded-xl p-3" style={{ color: C.red, background: `${C.red}18` }}><div className="flex items-start gap-2"><ShieldAlert size={16} /><p className="text-[12px]">{scanError}</p></div></div>}<form onSubmit={submit} className="mt-5"><label className="text-[12px]" style={{ color: C.goldSoft }}>Secure token fallback</label><input value={qrToken} onChange={(event) => setQrToken(event.target.value)} placeholder="Enter a server-issued QR token" className="mt-2 w-full rounded-xl px-3 py-3 text-[13px] outline-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /><button disabled={busy || !qrToken.trim()} className="mt-4 w-full rounded-xl py-3 text-[13px] font-semibold disabled:opacity-40" style={{ background: C.gold, color: C.bg }}>{busy ? "Validating securely..." : "Validate ticket"}</button>{staffMode && <button type="button" disabled={busy || !qrToken.trim()} onClick={rejectEntry} className="mt-2 w-full rounded-xl py-3 text-[13px] font-semibold disabled:opacity-40" style={{ background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}55` }}>Reject entry</button>}</form>{error && <p className="mt-4 rounded-xl p-3 text-[12px]" style={{ color: C.red, background: `${C.red}18` }}>{error}</p>}{result && <div className="mt-4 rounded-xl p-4" style={{ color: copy.tone, background: `${copy.tone}18`, border: `1px solid ${copy.tone}44` }}><ResultIcon size={20} color={copy.tone} /><p className="mt-2 text-[13px] font-semibold">{copy.title}</p><p className="mt-1 text-[11px]" style={{ color: C.muted }}>{result.result_code === "NETWORK_ERROR" || result.result_code === "SERVER_ERROR" ? copy.message : result.message || copy.message}</p>{result.attendee_name && <p className="mt-2 text-[11px]" style={{ color: C.ivory }}>Attendee: {result.attendee_name}</p>}{result.event_title && <p className="text-[11px]" style={{ color: C.ivory }}>Event: {result.event_title}</p>}{result.ticket_type && <p className="text-[11px]" style={{ color: C.ivory }}>Ticket: {result.ticket_type}</p>}{result.checked_in_at && <p className="text-[11px]" style={{ color: C.muted }}>Check-in: {new Date(result.checked_in_at).toLocaleString("en-NG")}</p>}<button type="button" onClick={() => { setResult(null); setQrToken(""); if (mode === "camera" && scanEnabled && !scanning) startScanner(); }} className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: C.goldSoft }}><RefreshCw size={13} /> Scan another ticket</button></div>}</div></main></div></div>;
}
