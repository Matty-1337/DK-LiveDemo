# =============================================================
# Delta Kinetics — LiveDemo Brand Proxy (Caddy)
# Injects DK CSS branding into LiveDemo frontend responses
# Requires caddy-replace-response plugin (built via xcaddy)
# =============================================================

FROM caddy:2-builder-alpine AS builder
RUN xcaddy build --with github.com/caddyserver/replace-response

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
RUN apk add --no-cache curl
COPY Caddyfile /etc/caddy/Caddyfile
COPY inject/ /srv/inject/
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/caddy-health || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
