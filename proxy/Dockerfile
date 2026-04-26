# =============================================================
# Delta Kinetics — LiveDemo edge proxy + DK Player static host
#
# Build context = repo root (per proxy/railway.toml dockerContext="..")
# Stage 1: build the player SPA from /player using Node + Vite.
# Stage 2: copy built assets into caddy:2-alpine.
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
COPY proxy/inject/ /srv/inject/

# Caddy config.
COPY proxy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-80}/caddy-health" || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
