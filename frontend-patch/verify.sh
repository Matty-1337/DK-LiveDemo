#!/bin/bash
# Verify a built patched frontend image. Pass tag as $1.
set -eu
IMAGE="${1:-dk-livedemo-frontend:patched}"

echo "verify: image=$IMAGE"

# Patch 1 — postLoginRedirect.js
EXISTS=$(docker run --rm --entrypoint=/bin/sh "$IMAGE" -c "test -f /app/src/utils/postLoginRedirect.js && echo yes || echo no")
echo "[patch 1] postLoginRedirect.js: $EXISTS"
[ "$EXISTS" = "yes" ] || { echo "FAIL: postLoginRedirect.js missing"; exit 1; }
GET=$(docker run --rm --entrypoint=/bin/sh "$IMAGE" -c "grep -c 'export function getPostLoginPathFromLocation' /app/src/utils/postLoginRedirect.js || true" | tr -d '[:space:]')
SAN=$(docker run --rm --entrypoint=/bin/sh "$IMAGE" -c "grep -c 'export function sanitizeReturnPath' /app/src/utils/postLoginRedirect.js || true" | tr -d '[:space:]')
echo "          exports: getPostLoginPathFromLocation=$GET sanitizeReturnPath=$SAN  (expect both=1)"
[ "$GET" = "1" ] || { echo "FAIL: getPostLoginPathFromLocation export missing"; exit 1; }
[ "$SAN" = "1" ] || { echo "FAIL: sanitizeReturnPath export missing"; exit 1; }

# Patch 2 — storyDemoBackground.js
SDBG_EXISTS=$(docker run --rm --entrypoint=/bin/sh "$IMAGE" -c "test -f /app/src/utils/storyDemoBackground.js && echo yes || echo no")
echo "[patch 2] storyDemoBackground.js: $SDBG_EXISTS"
[ "$SDBG_EXISTS" = "yes" ] || { echo "FAIL: storyDemoBackground.js missing"; exit 1; }
SDBG_NAMED=$(docker run --rm --entrypoint=/bin/sh "$IMAGE" -c "grep -c 'export function resolveStoryDemoOuterBackground' /app/src/utils/storyDemoBackground.js || true" | tr -d '[:space:]')
SDBG_DEFAULT=$(docker run --rm --entrypoint=/bin/sh "$IMAGE" -c "grep -c 'export default' /app/src/utils/storyDemoBackground.js || true" | tr -d '[:space:]')
echo "          exports: resolveStoryDemoOuterBackground=$SDBG_NAMED  default=$SDBG_DEFAULT  (expect both>=1)"
[ "$SDBG_NAMED" = "1" ] || { echo "FAIL: resolveStoryDemoOuterBackground export missing"; exit 1; }
[ "$SDBG_DEFAULT" = "1" ] || { echo "FAIL: storyDemoBackground default export missing"; exit 1; }

# (No patch 3 — Vite allowedHosts deliberately not included in v2.
#  Will be added only if a deployed run logs a "Blocked request"
#  error. Empirical-only, per the image-patch policy.)

# 2. Other src files unchanged — line counts of LoginPage and Auth
for path in /app/src/pages/LoginPage/LoginPage.js /app/src/pages/Auth/Auth.js; do
  UP=$(docker run --rm --entrypoint=/bin/sh livedemo/livedemo-web-app:latest -c "wc -l < $path" | tr -d '[:space:]')
  PA=$(docker run --rm --entrypoint=/bin/sh "$IMAGE"                       -c "wc -l < $path" | tr -d '[:space:]')
  echo "$(basename $path):  upstream=$UP  patched=$PA"
  [ "$UP" = "$PA" ] || { echo "FAIL: $path drift"; exit 1; }
done

# 3. Image config preserved
UP=$(docker inspect livedemo/livedemo-web-app:latest --format='{{.Config.User}}|{{.Config.Entrypoint}}|{{.Config.Cmd}}|{{.Config.WorkingDir}}')
PA=$(docker inspect "$IMAGE"                       --format='{{.Config.User}}|{{.Config.Entrypoint}}|{{.Config.Cmd}}|{{.Config.WorkingDir}}')
echo "upstream cfg: $UP"
echo "patched  cfg: $PA"
[ "$UP" = "$PA" ] || { echo "FAIL: USER/ENTRYPOINT/CMD/WORKDIR drift"; exit 1; }

echo "✓ verify: all checks passed"
