const TOMTOM_KEY = process.env.TOMTOM_API_KEY || process.env.TOMTOM_MAPS_API_KEY;
function json(res, status, body) { res.status(status).json(body); }
export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const lat = Number(req.query?.lat); const lon = Number(req.query?.lon); const zoom = Math.min(18, Math.max(4, Number(req.query?.zoom || 15)));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return json(res, 400, { error: "Valid latitude and longitude are required." });
  if (!TOMTOM_KEY) return json(res, 503, { error: "TomTom Maps is not configured on the server." });
  const params = new URLSearchParams({ key: TOMTOM_KEY, zoom: String(zoom), format: "png", view: "Unified", language: "NG" });
  try {
    const response = await fetch(`https://api.tomtom.com/map/1/staticimage?center=${lon},${lat}&width=900&height=420&${params}`);
    if (!response.ok) { const detail = await response.text().catch(() => ""); return json(res, 502, { error: detail || "TomTom static map failed." }); }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.status(200).setHeader("Content-Type", response.headers.get("content-type") || "image/png").setHeader("Cache-Control", "private, max-age=300").send(buffer);
  } catch (error) { return json(res, 502, { error: error?.message || "Unable to reach TomTom maps." }); }
}
