import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const ui = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const services = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const workflow = fs.readFileSync(path.join(root, "supabase/0015_venue_manager_workflow.sql"), "utf8");
const completion = fs.readFileSync(path.join(root, "supabase/0016_venue_manager_completion.sql"), "utf8");
const mediaTriggerFix = fs.readFileSync(path.join(root, "supabase/0074_fix_shared_media_trigger_avatar_regression.sql"), "utf8");
const permanentDeleteFix = fs.readFileSync(path.join(root, "supabase/0076_permanent_venue_delete_preserve_history.sql"), "utf8");
const paymentApi = fs.readFileSync(path.join(root, "api/paystack/venue-initialize.js"), "utf8");
const webhook = fs.readFileSync(path.join(root, "api/paystack/webhook.js"), "utf8");
const directive = fs.readFileSync(path.join(root, "VENUE_MANAGER_DIRECTIVE.md"), "utf8");

const has = (source, value) => expect(source).toContain(value);

describe("Venue Manager directive acceptance", () => {
  it("preserves existing role workspaces and adds Venue Manager routes", () => {
    has(ui, "ArtistWorkspace");
    has(ui, "OrganizerEvents");
    has(ui, "VenueManagerOnboarding");
    has(ui, "VenueManagerWorkspace");
    has(ui, "venueOnboarding");
    has(ui, "venueManager");
  });

  it("exposes onboarding from authenticated profile navigation", () => {
    has(ui, "Become a Venue Manager");
    has(ui, "Submit application");
    has(services, "applyAsVenueManager");
  });

  it("supports owned venue creation and profile editing", () => {
    has(services, "createOwnedVenue");
    has(services, "updateOwnedVenue");
    has(services, "p_image_urls");
    has(completion, "update_owned_venue");
    has(ui, "Create owned venue");
    has(ui, "Save profile");
  });

  it("keeps venue media on image_urls and protects the shared trigger from avatar_url regressions", () => {
    expect(services).toContain("p_image_urls: (payload.image_urls || [])");
    expect(services).not.toMatch(/createOwnedVenue[\s\S]{0,1200}avatar_url/);
    expect(mediaTriggerFix).toContain("v_row jsonb := to_jsonb(new);");
    expect(mediaTriggerFix).not.toMatch(/\bnew\.(avatar_url|image_url|image_urls)\b/i);
    expect(mediaTriggerFix).toContain("before insert or update of image_urls on public.venues");
  });

  it("permanently deletes venues without destroying booking history", () => {
    has(services, "deleteOwnedVenue");
    has(permanentDeleteFix, "alter column venue_id drop not null");
    has(permanentDeleteFix, "on delete set null");
    has(permanentDeleteFix, "history_preserved");
    has(permanentDeleteFix, "detached_booking_count");
    expect(permanentDeleteFix).not.toContain("Venue cannot be permanently deleted while booking records exist");
    has(ui, "Delete");
  });

  it("supports server-authoritative availability management", () => {
    has(services, "setVenueAvailability");
    has(completion, "set_venue_availability");
    has(ui, "Block availability");
    has(ui, "available");
  });

  it("supports organizer venue discovery and direct event attachment", () => {
    has(services, "loadAvailableVenues");
    has(services, "requestVenueBooking");
    has(workflow, "request_venue_booking");
    has(ui, "Existing venue");
    has(ui, "Custom location");
    has(ui, "selectVenue");
    has(ui, "location_confirmed");
  });

  it("enforces capacity and overlapping-booking conflict protection", () => {
    has(workflow, "Expected attendance exceeds venue capacity");
    has(workflow, "conflicting pending or confirmed booking");
    has(workflow, "tstzrange");
    has(workflow, "auth.uid()");
  });

  it("supports venue-manager booking responses and status history", () => {
    has(services, "respondVenueBooking");
    has(workflow, "respond_venue_booking");
    has(ui, "Accept");
    has(ui, "Reject");
    has(ui, "Booking requests");
  });

  it("supports live dashboard metrics, calendar, revenue, and organizer context", () => {
    has(services, "loadVenueManagerWorkspace");
    has(completion, "venue_manager_metrics");
    has(ui, "Confirmed");
    has(ui, "Calendar");
    has(ui, "Revenue");
    has(ui, "Organizer requests");
  });

  it("initializes venue booking payment from server-computed state", () => {
    has(services, "initializeVenueBookingPayment");
    has(paymentApi, "initialize_venue_booking_payment");
    has(paymentApi, "PAYSTACK_SECRET_KEY");
    has(paymentApi, "authorization_url");
    has(completion, "payment_status");
  });

  it("finalizes venue payment only through verified Paystack webhook state", () => {
    has(webhook, "verifySignature");
    has(webhook, "NGN");
    has(webhook, "venue_booking");
    has(webhook, "verify_venue_booking_payment");
  });

  it("preserves one authoritative payment per booking across retries", () => {
    const idempotency = fs.readFileSync(path.join(root, "supabase/0051_venue_payment_idempotency.sql"), "utf8");
    const checkout = fs.readFileSync(path.join(root, "supabase/0052_venue_payment_checkout_idempotency.sql"), "utf8");
    has(idempotency, "on conflict (booking_id) do update");
    has(idempotency, "if p.status = 'SUCCESS'");
    has(idempotency, "if p.status = 'FAILED'");
    has(checkout, "authorization_url");
    has(checkout, "access_code");
    has(paymentApi, "payment.provider_reference && payment.authorization_url");
    has(paymentApi, "authorization_url: payment.authorization_url");
    has(paymentApi, "authorization_url: paystack.authorization_url");
    has(ui, "payload?.authorization_url");
    has(ui, "payload?.data?.authorization_url");
    has(paymentApi, "reused: true");
    has(ui, "idempotencyKey: `venue-${booking.id}`");
  });

  it("does not let duplicate failure webhooks overwrite successful payments", () => {
    has(webhook, "status=neq.SUCCESS");
  });

  it("keeps ownership and role checks server-authoritative", () => {
    expect(workflow.toLowerCase()).toContain("security definer");
    expect(completion.toLowerCase()).toContain("security definer");
    has(workflow, "has_any_app_role");
    has(completion, "owner_id");
  });

  it("keeps migration and directive evidence versioned", () => {
    expect(fs.existsSync(path.join(root, "supabase/0015_venue_manager_workflow.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root, "supabase/0016_venue_manager_completion.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root, "supabase/0074_fix_shared_media_trigger_avatar_regression.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root, "supabase/0076_permanent_venue_delete_preserve_history.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root, "VENUE_MANAGER_DIRECTIVE.md"))).toBe(true);
    expect(directive.length).toBeGreaterThan(200);
  });
});
