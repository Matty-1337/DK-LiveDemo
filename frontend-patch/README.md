# DK-LiveDemo Frontend Patch

A small fork of `livedemo/livedemo-web-app:latest` that adds the missing
`src/utils/postLoginRedirect.js` module. Without this stub, Vite throws
an `import-analysis` error overlay on every page load (including the
public `/livedemos/:storyId` viewer used by the Strategy C generator).

## Why this exists

The upstream image's `LoginPage.js:29` imports
`getPostLoginPathFromLocation` from `../../utils/postLoginRedirect`,
and `Auth.js:7` imports `sanitizeReturnPath` from the same module —
but the file isn't in the image. Vite's dev server (used by the
container's `start-vite-docker` script) fails import resolution and
overlays an error onto the rendered DOM.

This is the **second** missing-file fix in this image's history. See
`docs/strategy-c.md` §"Upstream image patches" for the full pattern
and the precedent set by other patches.

## How to rebuild

```bash
cd frontend-patch
docker pull livedemo/livedemo-web-app:latest
docker build -t dk-livedemo-frontend:patched .
./verify.sh dk-livedemo-frontend:patched

# Push (requires a fresh GHCR PAT with write:packages)
echo "$GHCR_TOKEN" | docker login ghcr.io -u Matty-1337 --password-stdin
docker tag dk-livedemo-frontend:patched ghcr.io/matty-1337/dk-livedemo-frontend:v1
docker push ghcr.io/matty-1337/dk-livedemo-frontend:v1
```

After push: dashboard → `livedemo-frontend` service → Settings → Source
→ `ghcr.io/matty-1337/dk-livedemo-frontend:v1`. Save → Railway redeploys.

## What the stub does

`postLoginRedirect.js` exports two functions whose contracts are
inferred from the call sites:

- `sanitizeReturnPath(path)` — takes a candidate path string, returns a
  same-origin path. Rejects scheme-prefixed (`javascript:`, `http:`,
  etc.), protocol-relative (`//evil.com`), and missing-leading-slash
  inputs by defaulting to `/`. Conservative — biased toward refusing
  exotic input rather than allowing it.

- `getPostLoginPathFromLocation(location)` — takes a react-router
  `location` object, looks at `?next=` / `?redirect=` / `?returnTo=`
  query params, and returns the sanitized first-match. Defaults to
  `/`.

These cover the LoginPage / Auth flow without enabling external-URL
injection. The demo-viewing flow at `/livedemos/:storyId` doesn't
exercise this code at all — the stub just has to NOT throw.

## When to rebuild

Any time `livedemo/livedemo-web-app:latest` is rebuilt upstream.
Re-test by pulling fresh and grep-ing — if the upstream finally ships
the real file, retire this patch.
