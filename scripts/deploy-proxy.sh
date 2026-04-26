#!/usr/bin/env bash
# Builds the DK player and stages it for the proxy Docker build, then
# triggers a Railway deploy of the livedemo-proxy service.
#
# Legacy: player now lives in proxy/player/ and builds in-image. Prefer
# git-push deploy. This script still supports `railway up` + player-dist
# staging if needed.
#
# Usage: ./scripts/deploy-proxy.sh [--detach]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[deploy-proxy] Building player…"
npm --prefix proxy/player ci --no-audit --no-fund
npm --prefix proxy/player run build

echo "[deploy-proxy] Staging proxy/player/dist → proxy/player-dist…"
rm -rf proxy/player-dist
cp -r proxy/player/dist proxy/player-dist

echo "[deploy-proxy] Bundle:"
du -sh proxy/player-dist || true

echo "[deploy-proxy] railway up (service: livedemo-proxy)…"
railway up --service livedemo-proxy --ci "$@"
