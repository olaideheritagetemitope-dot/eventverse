import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const screen = fs.readFileSync(path.join(root, "src/components/CheckInScreen.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");

describe("camera QR check-in contract", () => {
  it("requests the rear camera only in a secure supported browser", () => {
    expect(screen).toContain("window.isSecureContext");
    expect(screen).toContain("navigator.mediaDevices?.getUserMedia");
    expect(screen).toContain("facingMode: { ideal: \"environment\" }");
    expect(screen).toContain("BarcodeDetector");
  });

  it("stops camera tracks when scanning ends or the screen unmounts", () => {
    expect(screen).toContain("streamRef.current?.getTracks().forEach((track) => track.stop())");
    expect(screen).toContain("videoRef.current.srcObject = stream");
    expect(screen).toContain("stopScanner();");
  });

  it("submits the decoded token through the server check-in RPC", () => {
    expect(screen).toContain("checkInTicketWithToken(qrToken.trim())");
    expect(service).toContain('supabase.rpc("check_in_ticket_with_token"');
  });
});
