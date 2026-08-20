import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const ui = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");
const services = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const workflow = fs.readFileSync(path.join(root, "supabase/0015_venue_manager_workflow.sql"), "utf8");
const completion = fs.readFileSync(path.join(root, "supabase/0016_venue_manager_completion.sql"), "utf8");
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
    has(completion, "update_owned_venue");
    has(ui, "Create owned venue");
    has(ui, "Save profile");
  });

  it("supports server-authoritative availability management", () => {
    has(services, "setVenueAvailability");
    has(completion, "set_venue_availability");
    has(ui, "Block availability");
    has(ui, "available");
  });

  it("supports organizer venue discovery and booking requests", () => {
    has(services, "loadAvailableVenues");
    has(services, "requestVenueBooking");
    has(workflow, "request_venue_booking");
    has(ui, "Available venue");
    has(ui, "Save draft and request venue");
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

  it("keeps ownership and role checks server-authoritative", () => {
    expect(workflow.toLowerCase()).toContain("security definer");
    expect(completion.toLowerCase()).toContain("security definer");
    has(workflow, "has_any_app_role");
    has(completion, "owner_id");
  });

  it("keeps migration and directive evidence versioned", () => {
    expect(fs.existsSync(path.join(root, "supabase/0015_venue_manager_workflow.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root, "supabase/0016_venue_manager_completion.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root, "VENUE_MANAGER_DIRECTIVE.md"))).toBe(true);
    expect(directive.length).toBeGreaterThan(200);
  });
});
