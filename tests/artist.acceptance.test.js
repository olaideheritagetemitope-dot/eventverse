import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Artist onboarding and monetization acceptance checklist", () => {
  it("contains every required server, UI, and payment contract", () => {
    const migration = read("supabase/0011_artist_registration_verification.sql");
    const service = read("src/services/user.js");
    const ui = read("src/EventVerse.jsx");
    const webhook = read("api/paystack/webhook.js");
    const initializer = read("api/paystack/artist-initialize.js");

    for (const token of ["artist_registration_fee", "artist_verification_fee", "artist_registrations", "artist_verifications", "artist_fee_transactions", "initialize_artist_fee_payment", "activate_artist_fee_transaction", "SUPER_ADMIN", "idempotency_key", "PENDING_PAYMENT", "VERIFIED_SUCCESS"]) {
      expect(migration).toContain(token);
    }
    for (const token of ["loadArtistOnboarding", "initializeArtistFeePayment", "loadArtistAdminOverview", "updateArtistFee"]) expect(service).toContain(token);
    for (const token of ["Become an Artist", "artistOnboarding", "artistVerification", "artistAdminSettings", "Golden verification active", "Verified"]) expect(ui).toContain(token);
    expect(initializer).toContain("initialize_artist_fee_payment");
    expect(webhook).toContain("activate_artist_fee_transaction");
    expect(webhook).toContain("markArtistFailure");
  });
});
