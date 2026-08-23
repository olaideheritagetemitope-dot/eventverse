const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
  res.status(status).json(body);
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 503, { error: "Media cleanup is not configured" });
  }
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return json(res, 401, { error: "Authentication required" });

  try {
    const userResult = await supabaseFetch("/auth/v1/user", { headers: { Authorization: authorization } });
    if (!userResult.response.ok || !userResult.payload?.id) return json(res, 401, { error: "Authentication required" });
    const userId = userResult.payload.id;
    const rolesResult = await supabaseFetch(`/rest/v1/user_roles?select=roles(code)&user_id=eq.${encodeURIComponent(userId)}&limit=20`, { headers: { Authorization: authorization } });
    const roles = Array.isArray(rolesResult.payload) ? rolesResult.payload.map((row) => String(row.roles?.code || "").toUpperCase()) : [];
    const privileged = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    const paths = Array.isArray(req.body?.paths) ? req.body.paths.filter((path) => typeof path === "string" && path.trim()).slice(0, 100) : [];
    if (!paths.length) return json(res, 200, { removed: [], failed: [] });
    if (!privileged && paths.some((path) => !path.startsWith(`${userId}/`))) return json(res, 403, { error: "Media cleanup access denied" });

    const removed = [];
    const failed = [];
    for (const path of paths) {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/atizzy-media/${encodedPath}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (response.ok || response.status === 404) removed.push(path);
      else failed.push({ path, status: response.status });
    }
    return json(res, failed.length ? 207 : 200, { removed, failed });
  } catch (error) {
    return json(res, 500, { error: error?.message || "Unable to clean up managed media" });
  }
}
