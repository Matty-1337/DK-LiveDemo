# Upstream image patches — historical

> Status as of 2026-04-25 (after the custom DK player shipped).
> Originally tracked as the "Upstream image patches" section of
> `strategy-c.md`. Moved here when the patches were retired so the
> strategy doc could shrink back to current architecture only.

---

## Pattern (kept for the next time we ever need it)

Both `livedemo/livedemo-backend:latest` and `livedemo/livedemo-web-app:latest`
are closed-source upstream images on Docker Hub. When they ship a hardcoded
value or missing reference that breaks self-hosting, our pattern was:

1. `docker pull livedemo/livedemo-<svc>:latest`
2. `docker inspect ... --format='{{.Config.User}} ...'` — capture base config
3. Locate the bug — grep source inside the image, identify the missing/hardcoded file
4. Write a `<svc>-patch/Dockerfile` that `FROM`s the upstream tag and applies the minimum diff (`sed -i ... && grep -c ... && test ...` pattern; load-bearing assertions in the build itself so a regression fails the build)
5. Write `verify.sh` — checks expected counts/files + `docker inspect` cfg matches upstream byte-for-byte (no USER/ENTRYPOINT drift)
6. Write `README.md` — what's patched, why, how to rebuild, when to retire
7. Build, verify, push to `ghcr.io/matty-1337/dk-livedemo-<svc>:v<n>`
8. Set Railway service source to that GHCR tag (NOT `:latest` — pin)
9. Add row to the table below
10. **Tag bumps go up monotonically.** Never push a different image to the same `vN` tag.

---

## Patch table

| Service | Image | Patch | Status (2026-04-25) |
|---|---|---|---|
| backend `:v1` | `ghcr.io/matty-1337/dk-livedemo-backend:v1` | `sed` rename `'livedemo-cdn'` → `'dk-livedemo-cdn'` in `helpers/livedemoHelpers.js` (5 occ) + `helpers/flixHelpers.js` (5 occ). | **ACTIVE.** Still required — backend uploads screen PNGs to our S3 bucket on every screen create. |
| backend `:v2` | `ghcr.io/matty-1337/dk-livedemo-backend:v2` | All v1 patches **plus** strip two stale `<link>` tags from `handlers/getLiveDemoPreview.js` (`app.livedemo.ai/main.5e127e43*.css` + `npm.antd.22ac6b*.css`). | **OBSOLETE — superseded by DK player (2026-04-25).** This patch only mattered when the proxy routed `/livedemos/:id` to `getLiveDemoPreview.js`. After Phase 6 the player is static and that handler is no longer reached. v1 is the canonical backend image. |
| backend `:v3` | `ghcr.io/matty-1337/dk-livedemo-backend:v3` | All v1+v2 patches **plus** rename the React mount target from `<div id="app">` → `<div id="reactInjectTourApp">` in `handlers/getLiveDemoPreview.js:234`. | **OBSOLETE — superseded by DK player (2026-04-25).** Same reasoning as v2. |
| frontend `:v1` | `ghcr.io/matty-1337/dk-livedemo-frontend:v1` | `COPY` a stub `src/utils/postLoginRedirect.js` (exports `getPostLoginPathFromLocation` + `sanitizeReturnPath`). | **OBSOLETE — frontend service deleted (2026-04-25).** |
| frontend `:v2` | `ghcr.io/matty-1337/dk-livedemo-frontend:v2` | All v1 patches **plus** inline-stub `src/utils/storyDemoBackground.js` (exports `resolveStoryDemoOuterBackground` + default). | **OBSOLETE — frontend service deleted (2026-04-25).** |

**Net active patches after 2026-04-25:** 1 (backend `:v1`, S3 bucket rename).

When upstream finally fixes the v1 bucket hardcoding, retire it by switching
Railway back to upstream `:latest` and deleting `backend-patch/`.

---

## Why we retired the upstream player

5 patches in 7 days, mostly chasing rendering bugs in `getLiveDemoPreview.js`
and the upstream Vite frontend. Each patch surfaced the next architectural
assumption that didn't fit our agentic-generation use case:

- `livedemo-cdn` S3 bucket name globally taken (v1)
- Stale CSS hashes returning HTML, ORB-blocked (v2)
- Public preview handler emitting wrong React mount-id (v3)
- Vite SPA importing files that don't exist in the published image (frontend v1, v2)

The data layer (Mongo schema + S3 storage) was always correct. Only the
*player* — the SPA that renders captured screens with popup overlays —
was the source of friction. So we replaced it with a 180KB static React
SPA in `/player`, served by Caddy, calling the backend's public
`/preview/:storyId` route directly. Zero upstream player code remains in
the deployed artifact. See `strategy-c.md` for the new architecture.
