// Runtime config for the static UI. In production the container's entrypoint overwrites this
// file from the API_BASE_URL env var. Empty string = same-origin (dev uses the Vite proxy).
window.__API_BASE__ = "";
