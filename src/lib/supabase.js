import { createClient } from "@supabase/supabase-js";

// These are Supabase publishable client values. They are safe to expose in a browser
// when Row Level Security is enabled on every application table.
export const SUPABASE_URL = "https://blalvoelllndmbppbkcy.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UPS5rb-O3q2hExK0RtPoBA_dn5X6aPf";

// Keep the default Supabase browser flow (PKCE). It was the last known working
// configuration for both Google and Spotify in EventVerse. The verifier is stored
// by supabase-js in browser storage and is exchanged at the Supabase callback.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
