# =============================================================
# DK-LiveDemo Backend — patched image
# =============================================================
# Forks livedemo/livedemo-backend:latest and replaces the hardcoded
# S3 bucket name 'livedemo-cdn' (globally taken in S3, not ours) with
# 'dk-livedemo-cdn' in both helper files.
#
# Every other byte stays identical. USER/ENTRYPOINT/CMD/WORKDIR preserved.
# Upstream image inspection 2026-04-24:
#   USER=<empty, i.e. root>
#   ENTRYPOINT=[/bin/sh -c ./start.sh]
#   CMD=[]
#   WORKDIR=/home/app
# Since USER was empty, no USER directive is needed after the patch.

FROM livedemo/livedemo-backend:latest

# Apply the bucket-name patch. The `grep` calls at the end are
# load-bearing — they fail the build if the substitution didn't take
# (exit 1 on zero matches for the new name, exit 0 on zero matches
# for the old name).
RUN set -eux; \
    sed -i "s/'livedemo-cdn'/'dk-livedemo-cdn'/g" \
        /home/app/src/helpers/livedemoHelpers.js \
        /home/app/src/helpers/flixHelpers.js; \
    echo "--- post-patch counts ---"; \
    NEW_L=$(grep -c "'dk-livedemo-cdn'" /home/app/src/helpers/livedemoHelpers.js); \
    OLD_L=$(grep -c "'livedemo-cdn'"    /home/app/src/helpers/livedemoHelpers.js || true); \
    NEW_F=$(grep -c "'dk-livedemo-cdn'" /home/app/src/helpers/flixHelpers.js); \
    OLD_F=$(grep -c "'livedemo-cdn'"    /home/app/src/helpers/flixHelpers.js || true); \
    echo "livedemoHelpers.js: new=$NEW_L old=$OLD_L"; \
    echo "flixHelpers.js:     new=$NEW_F old=$OLD_F"; \
    test "$NEW_L" = "5" || { echo "expected 5 replacements in livedemoHelpers.js, got $NEW_L"; exit 1; }; \
    test "$OLD_L" = "0" || { echo "expected 0 'livedemo-cdn' remaining in livedemoHelpers.js, got $OLD_L"; exit 1; }; \
    test "$NEW_F" = "5" || { echo "expected 5 replacements in flixHelpers.js, got $NEW_F"; exit 1; }; \
    test "$OLD_F" = "0" || { echo "expected 0 'livedemo-cdn' remaining in flixHelpers.js, got $OLD_F"; exit 1; }

# Label for provenance. Inspect with `docker inspect`.
LABEL org.opencontainers.image.source="https://github.com/Matty-1337/DK-LiveDemo" \
      org.opencontainers.image.description="DK fork of livedemo-backend: S3 bucket patched to dk-livedemo-cdn" \
      org.opencontainers.image.vendor="Delta Kinetics" \
      dk.patch.source-image="docker.io/livedemo/livedemo-backend:latest" \
      dk.patch.source-digest="sha256:6e63e427ac9f602a9057f6d20c2a0094b2e849c33b75c4d69b0eac85b05a43bb" \
      dk.patch.rev="v1"
