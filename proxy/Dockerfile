# =============================================================
# Delta Kinetics — LiveDemo Edge Proxy + DK Player static host
#
# Stage 1 builds the DK player SPA (player/) with Vite.
# Stage 2 is stock Caddy: serves player/dist statically and reverse-
# proxies the read-only /api/v1/demos route to the backend's PUBLIC
# /preview/:storyId endpoint (no auth needed, it's a 🌐 route per
# upstream-api.md).
#
# Build context MUST be repo root.
#   railway.json: dockerContext = ".", dockerfilePath = "proxy/Dockerfile"
# =============================================================

# ---- Stage 1: build the player ----
FROM node:20-alpine AS player-build
WORKDIR /player
COPY player/package.json player/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY player/ ./
RUN npm run build

# ---- Stage 2: caddy serves player + proxies API ----
FROM caddy:2-alpine
RUN apk add --no-cache curl
COPY --from=player-build /player/dist /srv/player
COPY proxy/inject/ /srv/inject/
COPY proxy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-80}/caddy-health" || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
