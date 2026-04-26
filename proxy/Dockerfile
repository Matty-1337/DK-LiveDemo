# =============================================================
# Delta Kinetics — LiveDemo edge proxy + DK Player static host
#
# Build context = proxy/ (per proxy/railway.toml).
# Player static files must be staged at proxy/player-dist/ before
# `railway up` — see scripts/deploy-proxy.sh which wraps `npm run
# build` in /player and copies dist into proxy/player-dist/.
#
# `proxy/player-dist/` is gitignored.
# =============================================================

FROM caddy:2-alpine
RUN apk add --no-cache curl

# Static SPA (built by Vite in /player, staged by deploy-proxy.sh).
COPY player-dist/ /srv/player/

# Brand CSS (kept as a static asset for back-compat).
COPY inject/ /srv/inject/

# Caddy config.
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-80}/caddy-health" || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
