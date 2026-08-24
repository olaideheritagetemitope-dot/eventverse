const TOMTOM_KEY = process.env.TOMTOM_API_KEY || process.env.TOMTOM_MAPS_API_KEY;

function json(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const query = String(req.query?.query || "").trim();
  if (query.length < 2) return json(res, 400, { error: "Search text must contain at least 2 characters." });
  if (!TOMTOM_KEY) return json(res, 503, { error: "TomTom Maps is not configured on the server." });
  const params = new URLSearchParams({ key: TOMTOM_KEY, limit: "8", language: "en-GB", countrySet: "NG", typeahead: "true" });
  try {
    const response = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?${params}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, response.status >= 400 && response.status < 500 ? 502 : 503, { error: payload?.errorText || "TomTom search failed." });
    return json(res, 200, { results: (payload.results || []).map((result) => ({ id: result.id || null, label: result.address?.freeformAddress || result.poi?.name || result.address?.municipality || query, name: result.poi?.name || null, address: result.address?.freeformAddress || null, latitude: Number(result.position?.lat), longitude: Number(result.position?.lon), country: result.address?.country || null, countryCode: result.address?.countryCode || null, state: result.address?.countrySubdivision || null, providerPlaceId: result.id || null })).filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) });
  } catch (error) {
    return json(res, 502, { error: error?.message || "Unable to reach TomTom search." });
  }
}
