import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ScanLine, Video, X } from "lucide-react";
import { checkInTicket } from "../services/user";

const C = { bg: "#0B0A08", card: "#17140F", gold: "#CDA349", goldSoft: "#E4C179", ivory: "#F3EEE3", muted: "#8B8577", line: "#2A2419", red: "#E98979" };

export default function CheckInScreen({ nav }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const [ticketId, setTicketId] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopScanner = () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const startScanner = async () => {
    setScanError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setScanError("Camera scanning requires HTTPS and a supported browser. Use manual ticket ID entry instead.");
    if (!("BarcodeDetector" in window)) return setScanError("QR scanning is not available in this browser. Use manual ticket ID entry instead.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setScanning(true);
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes?.[0]?.rawValue;
          if (value) {
            setTicketId(value);
            stopScanner();
          }
        } catch (scanDetectionError) {
          setScanError(scanDetectionError.message || "Unable to read this QR code.");
        }
      }, 500);
    } catch (cameraError) {
      setScanError(cameraError.message || "Camera permission was not granted.");
      stopScanner();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const value = await checkInTicket(ticketId.trim());
      setResult(value);
      setTicketId("");
    } catch (submitError) {
      setError(submitError.message || "This ticket could not be checked in.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="ev-root ev-app-viewport" style={{ background: C.bg, color: C.ivory }}><div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col"><div className="flex items-center gap-3 px-5 pb-4 pt-8" style={{ borderBottom: `1px solid ${C.line}` }}><button type="button" onClick={nav.pop} aria-label="Back" style={{ color: C.gold }}><span aria-hidden="true">←</span></button><div><p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>Protected operations</p><h1 className="ev-display text-[22px]" style={{ color: C.ivory }}>Ticket check-in</h1></div></div><main className="flex-1 px-5 py-6"><div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}><ScanLine size={28} color={C.gold} /><p className="mt-4 text-[13px] leading-6" style={{ color: C.muted }}>Scan a verified Atizzy QR code or enter the ticket ID manually. Authorization, ticket validity, and one-time check-in are enforced by Supabase.</p>{scanning && <div className="relative mt-4 overflow-hidden rounded-xl" style={{ border: `1px solid ${C.gold}` }}><video ref={videoRef} muted playsInline className="h-56 w-full object-cover" /><button type="button" onClick={stopScanner} aria-label="Stop scanner" className="absolute right-2 top-2 rounded-full p-2" style={{ background: C.bg, color: C.ivory }}><X size={16} /></button></div>}<button type="button" onClick={scanning ? stopScanner : startScanner} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold" style={{ background: `${C.gold}20`, color: C.goldSoft, border: `1px solid ${C.gold}66` }}><Video size={16} />{scanning ? "Stop QR scanner" : "Scan QR code"}</button>{scanError && <p className="mt-3 rounded-xl p-3 text-[12px]" style={{ color: C.red, background: `${C.red}18` }}>{scanError}</p>}<form onSubmit={submit} className="mt-5"><label className="text-[12px]" style={{ color: C.goldSoft }}>Ticket ID</label><input value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder="Ticket UUID or scanned token" className="mt-2 w-full rounded-xl px-3 py-3 text-[13px] outline-none" style={{ background: C.bg, color: C.ivory, border: `1px solid ${C.line}` }} /><button disabled={busy || !ticketId.trim()} className="mt-4 w-full rounded-xl py-3 text-[13px] font-semibold disabled:opacity-40" style={{ background: C.gold, color: C.bg }}>{busy ? "Checking..." : "Check in ticket"}</button></form>{error && <p className="mt-4 rounded-xl p-3 text-[12px]" style={{ color: C.red, background: `${C.red}18` }}>{error}</p>}{result && <div className="mt-4 rounded-xl p-4" style={{ color: C.goldSoft, background: `${C.gold}18` }}><CheckCircle2 size={20} color={C.gold} /><p className="mt-2 text-[13px] font-semibold">{result.status === "already_checked_in" ? "Ticket was already checked in" : "Ticket checked in successfully"}</p><p className="mt-1 text-[11px]" style={{ color: C.muted }}>Ticket: {result.ticket_id}</p></div>}</div></main></div></div>;
}
