#!/bin/bash
# Verify a built patched image. Pass the image tag as $1.
# Exits 0 if all checks pass, nonzero otherwise.
set -eu

IMAGE="${1:-dk-livedemo-backend:patched}"

echo "verify: image=$IMAGE"

run() {
  docker run --rm --entrypoint=/bin/sh "$IMAGE" -c "$1"
}

NEW_L=$(run "grep -c \"'dk-livedemo-cdn'\" /home/app/src/helpers/livedemoHelpers.js || true" | tr -d '[:space:]')
OLD_L=$(run "grep -c \"'livedemo-cdn'\"    /home/app/src/helpers/livedemoHelpers.js || true" | tr -d '[:space:]')
NEW_F=$(run "grep -c \"'dk-livedemo-cdn'\" /home/app/src/helpers/flixHelpers.js || true" | tr -d '[:space:]')
OLD_F=$(run "grep -c \"'livedemo-cdn'\"    /home/app/src/helpers/flixHelpers.js || true" | tr -d '[:space:]')

echo "livedemoHelpers.js: new=$NEW_L  old=$OLD_L  (expect new=5 old=0)"
echo "flixHelpers.js:     new=$NEW_F  old=$OLD_F  (expect new=5 old=0)"

FAIL=0
[ "$NEW_L" = "5" ] || { echo "FAIL: livedemoHelpers new count"; FAIL=1; }
[ "$OLD_L" = "0" ] || { echo "FAIL: livedemoHelpers old count"; FAIL=1; }
[ "$NEW_F" = "5" ] || { echo "FAIL: flixHelpers new count";     FAIL=1; }
[ "$OLD_F" = "0" ] || { echo "FAIL: flixHelpers old count";     FAIL=1; }

# Also confirm the source files are otherwise intact — line counts
# must match the upstream image byte-for-byte except for the bucket name.
UPSTREAM_LINES_L=$(docker run --rm --entrypoint=/bin/sh livedemo/livedemo-backend:latest -c "wc -l < /home/app/src/helpers/livedemoHelpers.js" | tr -d '[:space:]')
PATCHED_LINES_L=$(run "wc -l < /home/app/src/helpers/livedemoHelpers.js" | tr -d '[:space:]')
echo "livedemoHelpers.js line count: upstream=$UPSTREAM_LINES_L  patched=$PATCHED_LINES_L"
[ "$UPSTREAM_LINES_L" = "$PATCHED_LINES_L" ] || { echo "FAIL: line count drift in livedemoHelpers"; FAIL=1; }

UPSTREAM_LINES_F=$(docker run --rm --entrypoint=/bin/sh livedemo/livedemo-backend:latest -c "wc -l < /home/app/src/helpers/flixHelpers.js" | tr -d '[:space:]')
PATCHED_LINES_F=$(run "wc -l < /home/app/src/helpers/flixHelpers.js" | tr -d '[:space:]')
echo "flixHelpers.js line count:     upstream=$UPSTREAM_LINES_F  patched=$PATCHED_LINES_F"
[ "$UPSTREAM_LINES_F" = "$PATCHED_LINES_F" ] || { echo "FAIL: line count drift in flixHelpers"; FAIL=1; }

# Config preservation
UPSTREAM_CFG=$(docker inspect livedemo/livedemo-backend:latest --format='{{.Config.User}}|{{.Config.Entrypoint}}|{{.Config.WorkingDir}}')
PATCHED_CFG=$(docker inspect "$IMAGE" --format='{{.Config.User}}|{{.Config.Entrypoint}}|{{.Config.WorkingDir}}')
echo "upstream cfg: $UPSTREAM_CFG"
echo "patched  cfg: $PATCHED_CFG"
[ "$UPSTREAM_CFG" = "$PATCHED_CFG" ] || { echo "FAIL: USER/ENTRYPOINT/WORKDIR drift"; FAIL=1; }

if [ "$FAIL" = "1" ]; then
  echo "✗ verify: FAILED"
  exit 1
fi

echo "✓ verify: all checks passed"
