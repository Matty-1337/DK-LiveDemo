# =============================================================
# DK-LiveDemo Frontend — patched image (v2)
# =============================================================
# Forks livedemo/livedemo-web-app:latest. Every patch below traces to
# a logged error in a deployed run — no speculative carry-forwards.
#
#   Patch 1 — Stub src/utils/postLoginRedirect.js
#     v1 deploy logs showed Vite import-analysis error overlay:
#       "Failed to resolve import '../../utils/postLoginRedirect' from
#        src/pages/LoginPage/LoginPage.js"
#     LoginPage.js + Auth.js import { getPostLoginPathFromLocation,
#     sanitizeReturnPath } from this file.
#
#   Patch 2 — Stub src/utils/storyDemoBackground.js
#     v1 deploy logs (after patch 1 fixed Vite) showed webpack error:
#       "Module not found: Error: Can't resolve
#        '../utils/storyDemoBackground.js' in '/app/src/injectScript'"
#     injectScript/injectScript.js imports
#     { resolveStoryDemoOuterBackground } via webpack for the
#     bundle-inject build (the analytics/styling injector).
#
# A Vite allowedHosts patch existed in the prior frontend/Dockerfile
# (commit 1f4d7b3) but is NOT included here — v1's deploy showed Vite
# serving requests and the public demo URL returned 200, so the
# blocking pattern that originally prompted that patch isn't currently
# observed. Will add only if a "Blocked request" error surfaces in a
# deployed run.
#
# Upstream image inspection 2026-04-25:
#   USER=<empty, root>
#   ENTRYPOINT=[docker-entrypoint.sh]
#   CMD=[/bin/sh -c npm run start-vite-docker -- --host 0.0.0.0 & npm run bundle-inject & wait]
#   WORKDIR=/app

FROM livedemo/livedemo-web-app:latest

# Upstream USER is empty (effectively root) — inherit it. An explicit
# `USER root` here mutates the inspected config and trips verify.sh.

# Patch 1 — postLoginRedirect.js stub.
COPY postLoginRedirect.js /app/src/utils/postLoginRedirect.js

# Patch 2 — storyDemoBackground.js stub.
RUN printf '%s\n%s\n' \
    'export function resolveStoryDemoOuterBackground() { return null; }' \
    'export default {};' \
    > /app/src/utils/storyDemoBackground.js

# Sanity assertions — fail the build on any patch regression.
RUN set -eux; \
    test -f /app/src/utils/postLoginRedirect.js; \
    grep -q "getPostLoginPathFromLocation"        /app/src/utils/postLoginRedirect.js; \
    grep -q "sanitizeReturnPath"                  /app/src/utils/postLoginRedirect.js; \
    test -f /app/src/utils/storyDemoBackground.js; \
    grep -q "resolveStoryDemoOuterBackground"     /app/src/utils/storyDemoBackground.js; \
    echo "✓ both patches applied"

LABEL org.opencontainers.image.source="https://github.com/Matty-1337/DK-LiveDemo" \
      org.opencontainers.image.description="DK fork of livedemo-web-app: adds missing src/utils/postLoginRedirect.js" \
      org.opencontainers.image.vendor="Delta Kinetics" \
      dk.patch.source-image="docker.io/livedemo/livedemo-web-app:latest" \
      dk.patch.source-digest="sha256:65c821ebb1dccc2dc3acf966e101256bb57a6a529f1a24913153056cf434b353" \
      dk.patch.rev="v2"
