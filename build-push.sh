#!/usr/bin/env bash
# Builds tradebot-ui for linux/amd64, tags with `latest` and a version tag
# (YYYYMMDD-<git short sha>, -dirty if the tree has uncommitted changes), pushes both.
#
# Usage: ./build-push.sh    (REGISTRY=host:5000 to override)
set -euo pipefail
cd "$(dirname "$0")"

REGISTRY="${REGISTRY:-192.168.1.53:5000}"
SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)
DIRTY=""
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
   DIRTY="-dirty"
fi
VERSION="$(date +%Y%m%d)-${SHORT_SHA}${DIRTY}"

echo "Building tradebot-ui:${VERSION} (and latest) for linux/amd64..."
docker build --platform linux/amd64 -t tradebot-ui:latest -t "tradebot-ui:${VERSION}" .

docker tag tradebot-ui:latest "${REGISTRY}/tradebot-ui:latest"
docker tag "tradebot-ui:${VERSION}" "${REGISTRY}/tradebot-ui:${VERSION}"

echo "Pushing ${REGISTRY}/tradebot-ui:${VERSION} and :latest..."
docker push "${REGISTRY}/tradebot-ui:${VERSION}"
docker push "${REGISTRY}/tradebot-ui:latest"

echo ""
echo "Pushed. Pin this version in docker-compose with:"
echo "  image: ${REGISTRY}/tradebot-ui:${VERSION}"
