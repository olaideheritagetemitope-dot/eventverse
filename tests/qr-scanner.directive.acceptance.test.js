import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const screen = fs.readFileSync(path.join(root, "src/components/CheckInScreen.jsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/0046_ticket_qr_validation_result_states.sql"), "utf8");

describe("Atizzy QR scanner directive contracts", () => {
  it("supports camera and picture-library decoding without URL upload fallbacks", () => {
    expect(screen).toContain("BrowserMultiFormatReader");
    expect(screen).toContain("getUserMedia");
    expect(screen).toContain('type="file"');
    expect(screen).toContain("Choose QR picture");
    expect(screen).toContain("not uploaded as a URL");
  });

  it("supports continuous scanning controls and duplicate suppression", () => {
    expect(screen).toContain("scanEnabled");
    expect(screen).toContain("scanEnabled ? \"ON\" : \"OFF\"");
    expect(screen).toContain("recentTokensRef");
    expect(screen).toContain("Scan another ticket");
  });

  it("uses the expected-event validation RPC and preserves explicit result states", () => {
    expect(service).toContain('supabase.rpc("validate_ticket_qr"');
    for (const code of ["SUCCESS", "ALREADY_USED", "INVALID_QR", "EXPIRED", "CANCELLED", "REFUNDED", "REVOKED", "WRONG_EVENT", "UNAUTHORIZED", "REJECTED", "NETWORK_ERROR", "SERVER_ERROR"]) {
      expect(screen).toContain(code);
    }
  });

  it("keeps authorization and atomic check-in server authoritative", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("p_expected_event_id");
    expect(migration).toContain("event_staff_can_check_in");
    expect(migration).toContain("for update");
    expect(migration).toContain("update public.tickets set status = 'CHECKED_IN'");
    expect(migration).toContain("attendance_recorded");
    expect(migration).toContain("grant execute on function public.validate_ticket_qr(text, uuid) to authenticated");
  });
});
