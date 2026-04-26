# =============================================================
# Delta Kinetics — LiveDemo edge proxy + DK Player static host
#
# Build context MUST be the proxy/ directory (see railway.toml):
#   docker build -f proxy/Dockerfile proxy
#
# That layout lets Railway use Root Directory = "proxy" (snapshot is
# proxy/** only) while still building the Vite app from proxy/player/.
# =============================================================

# --- Stage 1: Build the player SPA ---
FROM node:20-alpine AS player-build
WORKDIR /app
COPY player/package.json player/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY player/ ./
RUN npm run build

# --- Stage 2: Caddy with static assets ---
FROM caddy:2-alpine
RUN apk add --no-cache curl

# Static SPA (built in stage 1).
COPY --from=player-build /app/dist/ /srv/player/

# Brand CSS (kept as a static asset for back-compat).
COPY inject/ /srv/inject/

# Caddy config.
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-80}/caddy-health" || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
