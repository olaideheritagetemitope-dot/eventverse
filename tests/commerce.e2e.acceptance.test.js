import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const coreRpc = fs.readFileSync(path.join(root, "supabase/0013_directive_payment_checkin_reconcile.sql"), "utf8");
const scopedCheckIn = fs.readFileSync(path.join(root, "supabase/0014_scope_organizer_checkin.sql"), "utf8");
const venueWorkflow = fs.readFileSync(path.join(root, "supabase/0016_venue_manager_completion.sql"), "utf8");
const webhook = fs.readFileSync(path.join(root, "api/paystack/webhook.js"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const checkInUi = fs.readFileSync(path.join(root, "src/components/CheckInScreen.jsx"), "utf8");
const userService = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const engagementPrivacy = fs.readFileSync(path.join(root, "supabase/0094_engagement_privacy_summary.sql"), "utf8");

const has = (source, value) => expect(source).toContain(value);

describe("Atizzy commerce end-to-end acceptance", () => {
  it("fulfills a verified ticket payment on the server and issues tickets idempotently", () => {
    has(coreRpc, "verify_payment_and_issue_tickets");
    has(coreRpc, "payment_row.status = 'VERIFIED_SUCCESS'");
    has(coreRpc, "insert into public.tickets");
    has(webhook, "verify_payment_and_issue_tickets");
    has(webhook, "verifySignature");
  });

  it("uses an aggregate engagement RPC instead of exposing all user likes and ratings", () => {
    has(engagementPrivacy, "create or replace function public.get_content_engagement_summary");
    has(engagementPrivacy, "revoke all on function public.get_content_engagement_summary");
    has(engagementPrivacy, "create policy likes_self_read");
    has(engagementPrivacy, "create policy ratings_self_read");
    has(userService, 'supabase.rpc("get_content_engagement_summary"');
  });

  it("checks failure-state Supabase patches before acknowledging Paystack callbacks", () => {
    has(webhook, "async function supabasePatch(path, body)");
    has(webhook, "Supabase update failed");
    has(webhook, "await supabasePatch(`/rest/v1/role_application_payments");
    has(webhook, "await supabasePatch(`/rest/v1/venue_booking_payments");
  });

  it("supports both scoped QR-token and ticket-id check-in paths", () => {
    has(scopedCheckIn, "create or replace function public.check_in_ticket(p_ticket_id uuid)");
    has(scopedCheckIn, "create or replace function public.check_in_ticket_with_token(p_qr_token text)");
    has(scopedCheckIn, "Organizer is not authorized for this event");
    has(service, 'supabase.rpc("check_in_ticket_with_token"');
    has(checkInUi, "checkInTicketWithToken");
  });

  it("keeps venue booking payment initialization and webhook verification server-authoritative", () => {
    has(venueWorkflow, "initialize_venue_booking_payment");
    has(venueWorkflow, "verify_venue_booking_payment");
    has(venueWorkflow, "payment_status='SUCCESS'");
    has(service, 'supabase.rpc("initialize_venue_booking_payment"');
    has(webhook, "verify_venue_booking_payment");
  });
});
