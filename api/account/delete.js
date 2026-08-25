const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (res, status, body) => {
  res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 503, { error: "Account deletion is not configured on the server." });
  }

  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json(res, 401, { error: "A valid authenticated session is required." });

  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userPayload = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !userPayload?.id) return json(res, 401, { error: "Your session is no longer valid. Sign in again." });

    const deleteResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userPayload.id)}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const deletePayload = await deleteResponse.json().catch(() => null);
    if (!deleteResponse.ok) {
      console.error("account deletion failed", { status: deleteResponse.status, userId: userPayload.id, response: deletePayload });
      return json(res, 502, { error: "The account could not be deleted. Please try again or contact support." });
    }

    return json(res, 200, { deleted: true });
  } catch (error) {
    console.error("account deletion request failed", { message: error?.message });
    return json(res, 500, { error: "The account could not be deleted. Please try again." });
  }
}
