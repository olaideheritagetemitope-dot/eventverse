const configuredApiBase = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
  ? String(import.meta.env.VITE_API_BASE_URL).trim()
  : "";

const isBrowserRelativeRuntime = typeof window !== "undefined"
  && (window.location.protocol === "http:" || window.location.protocol === "https:");

// Native Capacitor uses capacitor://localhost, where /api routes do not exist.
// Web keeps relative routing so preview and production rewrites remain intact.
export const API_BASE_URL = configuredApiBase || (isBrowserRelativeRuntime ? "" : "https://eventverse-eight.vercel.app");

export function apiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
