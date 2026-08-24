async function request(path) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "TomTom location request failed.");
  return payload;
}

export async function searchTomTomPlaces(query) {
  const value = String(query || "").trim();
  if (value.length < 2) return [];
  const payload = await request(`/api/tomtom/search?query=${encodeURIComponent(value)}`);
  return Array.isArray(payload.results) ? payload.results : [];
}

export async function reverseGeocodeTomTom(latitude, longitude) {
  const payload = await request(`/api/tomtom/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
  return payload;
}

export function tomTomStaticMapUrl(latitude, longitude, zoom = 15) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return "";
  return `/api/tomtom/static-map?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=${encodeURIComponent(zoom)}`;
}
