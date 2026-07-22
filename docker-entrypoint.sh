#!/bin/sh
# Writes the runtime API base URL into config.js from the API_BASE_URL env var, so the same
# static image can point at any backend without rebuilding. Runs before nginx starts (placed in
# /docker-entrypoint.d/, which the nginx:alpine image executes on boot).
set -e
CONFIG_FILE=/usr/share/nginx/html/config.js
API_BASE_URL="${API_BASE_URL:-}"
echo "window.__API_BASE__ = \"${API_BASE_URL}\";" > "$CONFIG_FILE"
echo "[entrypoint] API base URL set to '${API_BASE_URL:-<same-origin>}'"
