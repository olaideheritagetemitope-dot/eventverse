import { createClient } from "@supabase/supabase-js";

// Supabase configuration is supplied by the deployment environment. Never commit service
// credentials or bind the production frontend to a project-specific hardcoded URL.
export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
export const SUPABASE_PUBLISHABLE_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
export const SUPABASE_PROJECT_REF = SUPABASE_URL.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co(?:m)?$/i)?.[1] || "";
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Keep the app shell mountable when a deployment is misconfigured. The first live request
// then fails explicitly and the UI can render its ERROR state instead of showing demo data.
const clientUrl = SUPABASE_URL || "https://missing-supabase-config.invalid";
const clientKey = SUPABASE_PUBLISHABLE_KEY || "missing-supabase-publishable-key";

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
