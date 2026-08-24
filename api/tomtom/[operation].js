const TOMTOM_KEY = process.env.TOMTOM_API_KEY || process.env.TOMTOM_MAPS_API_KEY;

function json(res, status, body) {
  return res.status(status).json(body);
}

function coordinates(req) {
  const lat = Number(req.query?.lat);
  const lon = Number(req.query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

async function search(req, res) {
  const query = String(req.query?.query || "").trim();
  if (query.length < 2) return json(res, 400, { error: "Search text must contain at least 2 characters." });
  const params = new URLSearchParams({ key: TOMTOM_KEY, limit: "8", language: "en-GB", countrySet: "NG", typeahead: "true" });
  const response = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?${params}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return json(res, response.status >= 400 && response.status < 500 ? 502 : 503, { error: payload?.errorText || "TomTom search failed." });
  return json(res, 200, { results: (payload.results || []).map((result) => ({ id: result.id || null, label: result.address?.freeformAddress || result.poi?.name || result.address?.municipality || query, name: result.poi?.name || null, address: result.address?.freeformAddress || null, latitude: Number(result.position?.lat), longitude: Number(result.position?.lon), country: result.address?.country || null, countryCode: result.address?.countryCode || null, state: result.address?.countrySubdivision || null, providerPlaceId: result.id || null })).filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) });
}

async function reverse(req, res) {
  const point = coordinates(req);
  if (!point) return json(res, 400, { error: "Valid latitude and longitude are required." });
  const params = new URLSearchParams({ key: TOMTOM_KEY, language: "en-GB", radius: "50" });
  const response = await fetch(`https://api.tomtom.com/search/2/reverseGeocode/${point.lat},${point.lon}.json?${params}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return json(res, 502, { error: payload?.errorText || "TomTom reverse geocoding failed." });
  const result = payload.addresses?.[0];
  const address = result?.address || {};
  return json(res, 200, { formattedAddress: address.freeformAddress || null, municipality: address.municipality || null, state: address.countrySubdivision || null, country: address.country || null, countryCode: address.countryCode || null, providerPlaceId: result?.id || null, latitude: point.lat, longitude: point.lon });
}

async function staticMap(req, res) {
  const point = coordinates(req);
  const zoomValue = Number(req.query?.zoom || 15);
  const zoom = Math.min(18, Math.max(4, Number.isFinite(zoomValue) ? zoomValue : 15));
  if (!point) return json(res, 400, { error: "Valid latitude and longitude are required." });
  const params = new URLSearchParams({ key: TOMTOM_KEY, zoom: String(zoom), format: "png", view: "Unified", language: "NG" });
  const response = await fetch(`https://api.tomtom.com/map/1/staticimage?center=${point.lon},${point.lat}&width=900&height=420&${params}`);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return json(res, 502, { error: detail || "TomTom static map failed." });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return res.status(200).setHeader("Content-Type", response.headers.get("content-type") || "image/png").setHeader("Cache-Control", "private, max-age=300").send(buffer);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const operation = String(req.query?.operation || "").toLowerCase();
  if (!["search", "reverse", "static-map"].includes(operation)) return json(res, 404, { error: "Unknown TomTom operation." });
  if (!TOMTOM_KEY) return json(res, 503, { error: "TomTom Maps is not configured on the server." });
  try {
    if (operation === "search") return await search(req, res);
    if (operation === "reverse") return await reverse(req, res);
    return await staticMap(req, res);
  } catch (error) {
    return json(res, 502, { error: error?.message || "Unable to reach TomTom." });
  }
}
