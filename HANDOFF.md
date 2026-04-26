# HANDOFF.md — DK-LiveDemo

> **Last updated:** 2026-04-26 (Strategy C closeout). Read after `CLAUDE.md`.

---

## Production snapshot

| Surface | URL / notes |
|--------|-------------|
| Public demo | `https://demo.deltakinetics.io` |
| MCP | `https://livedemo-mcp-production.up.railway.app` (`/health`, `/sse`) |
| Player assets (example) | `index-OFszgW4M.css`, `index-g1BibA4C.js` (built from `proxy/player/`) |

**Proxy build fix (2026-04-26):** Railway uses **root directory `proxy`**, so the build snapshot is only `proxy/**`. The player was moved to **`proxy/player/`** and `proxy/Dockerfile` uses paths relative to that context. Root `railway.toml` sets `dockerfilePath = proxy/Dockerfile`, `dockerContext = proxy`. See `docs/troubleshooting.md`.

**Deploy path:** Push to `main` or `feature/*` — **no** `railway up` / `deploy-proxy.sh` (removed). `railway.json` documents intended services.

---

## Backend image — action for owner

- **Repo / IaC:** `railway.json` and `railway/backend.railway.toml` specify **`ghcr.io/matty-1337/dk-livedemo-backend:v1`** (S3 `livedemo-cdn` → `dk-livedemo-cdn` patch in `backend-patch/`).
- **`railway service list` (2026-04-26)** showed **`livedemo-backend` still running image `:v3`**. CLI cannot change image source without dashboard or GraphQL + token.
- **Please:** Railway → `livedemo-backend` → Settings → Source → Image → **`ghcr.io/matty-1337/dk-livedemo-backend:v1`** → redeploy.  
  (`:v3` is obsolete for our static player; `:v1` is the documented canonical patch set.)

Prod demo JSON already shows `imageUrl` under `dk-livedemo-cdn` — uploads are healthy; pinning to `:v1` matches docs and reduces drift.

---

## Railway / services

- **`livedemo-frontend`:** May still exist in the UI as a dormant service. Not in `railway.json`. **Owner:** delete when confirmed unused. See `docs/strategy-c.md`.
- **`livedemo-browser`:** Internal Playwright capture for Strategy C; builds from `browser/`.

---

## Evidence from closeout

- Full-bleed screenshot: `docs/_release/strategy-c-final.png` (1920×1200 viewport).
- Archived Railway dump: `docs/_archive/railway-services-2026-04-23.json`.
- Diag artifacts: `docs/_archive/_diag-v2-render/`, `_diag-v3-render/`, etc.

---

## Next 3 owner actions

1. **Dashboard:** Set `livedemo-backend` image to **`ghcr.io/matty-1337/dk-livedemo-backend:v1`** and redeploy.
2. **Optional:** Remove dormant **`livedemo-frontend`** service after confirming nothing points at it.
3. **PR #3:** Review checks + merge when satisfied (**do not merge** until you sign off).

---

## PR #3 / branch

- Branch: `feature/strategy-c-automation` (Strategy C + proxy/player layout).
- **Do not force-push or rewrite history.**

**GitHub check `livedemo-browser`:** Was failing because `railway.json` lacked `dockerContext: "browser"` (repo-root config built the proxy image). Fixed in commit `9e5629e`. If it regresses, set Railway **Root Directory** to **`browser`** — see `docs/troubleshooting.md`.

---

## Local dev quick refs

```powershell
docker build -f proxy/Dockerfile proxy -t dk-proxy:test
cd proxy/player && npm ci && npm run build
node scripts/screenshot-fullbleed.cjs "https://demo.deltakinetics.io/livedemos/<id>" docs/_release/out.png
```

Requires `browser/node_modules` (Playwright) for screenshot scripts.
