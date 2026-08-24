const TOMTOM_KEY = process.env.TOMTOM_API_KEY || process.env.TOMTOM_MAPS_API_KEY;
function json(res, status, body) { res.status(status).json(body); }
export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const lat = Number(req.query?.lat); const lon = Number(req.query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return json(res, 400, { error: "Valid latitude and longitude are required." });
  if (!TOMTOM_KEY) return json(res, 503, { error: "TomTom Maps is not configured on the server." });
  const params = new URLSearchParams({ key: TOMTOM_KEY, language: "en-GB", radius: "50" });
  try {
    const response = await fetch(`https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?${params}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, 502, { error: payload?.errorText || "TomTom reverse geocoding failed." });
    const result = payload.addresses?.[0]; const address = result?.address || {};
    return json(res, 200, { formattedAddress: address.freeformAddress || null, municipality: address.municipality || null, state: address.countrySubdivision || null, country: address.country || null, countryCode: address.countryCode || null, providerPlaceId: result?.id || null, latitude: lat, longitude: lon });
  } catch (error) { return json(res, 502, { error: error?.message || "Unable to reach TomTom reverse geocoding." }); }
}
