#!/usr/bin/env bash
# Builds the DK player and stages it for the proxy Docker build, then
# triggers a Railway deploy of the livedemo-proxy service.
#
# Why a wrapper script: proxy/railway.toml pins the Docker build context
# to proxy/, so the multi-stage approach can't reach repo-root /player.
# Pre-building and staging keeps the proxy build context small and
# predictable.
#
# Usage: ./scripts/deploy-proxy.sh [--detach]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[deploy-proxy] Building player…"
npm --prefix player ci --no-audit --no-fund
npm --prefix player run build

echo "[deploy-proxy] Staging player/dist → proxy/player-dist…"
rm -rf proxy/player-dist
cp -r player/dist proxy/player-dist

echo "[deploy-proxy] Bundle:"
du -sh proxy/player-dist || true

echo "[deploy-proxy] railway up (service: livedemo-proxy)…"
railway up --service livedemo-proxy --ci "$@"
