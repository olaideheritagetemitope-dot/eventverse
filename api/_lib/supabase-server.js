const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export function getSupabaseServerConfig() {
  return { url: SUPABASE_URL, key: SUPABASE_SERVICE_ROLE_KEY };
}

export function hasSupabaseServerConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseServerHeaders(extra = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Privileged Supabase server key is not configured");
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
  // Legacy service_role keys are JWTs and must be supplied as the bearer token.
  // Modern sb_secret_* keys are opaque API keys; do not send them as JWTs.
  if (!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  } else if (Object.prototype.hasOwnProperty.call(extra, "Authorization")) {
    delete headers.Authorization;
  }
  return headers;
}

export async function supabaseServerFetch(path, options = {}) {
  if (!SUPABASE_URL) throw new Error("Supabase URL is not configured");
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: supabaseServerHeaders(options.headers || {}),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

export async function supabaseServerRpc(name, args) {
  const { response, payload } = await supabaseServerFetch(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Privileged Supabase request failed");
  return Array.isArray(payload) ? payload[0] : payload;
}

export { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
