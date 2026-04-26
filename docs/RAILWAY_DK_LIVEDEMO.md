# Railway — DK-LiveDemo

- **Project:** [DK-LiveDemo](https://railway.com/project/df0626c1-9a73-45b3-b73a-911a0e2a823e)  
- **Workspace:** matty-1337's Projects  

## Public URLs (generated)

| Service | URL |
|--------|-----|
| **Proxy (site + /api)** | `https://livedemo-proxy-production.up.railway.app` |
| **MCP** | `https://livedemo-mcp-production.up.railway.app` |

## Services

Declared in root [`railway.json`](../railway.json) (IaC-style reference; confirm each service **Source** in the Railway dashboard matches).

- `livedemo-mongo` — `mongo:8` + volume `/data/db` — **set replica set** per [RAILWAY_MONGO_REPLSET.md](./RAILWAY_MONGO_REPLSET.md) (backend will crash with change-stream errors until this is done).  
- `livedemo-backend` — **`ghcr.io/matty-1337/dk-livedemo-backend:v1`** (S3 bucket patch; see `backend-patch/`). If the dashboard still shows `:latest` or `:v3`, repoint to **`:v1`** and redeploy.  
- `livedemo-proxy` — Caddy: builds [`proxy/Dockerfile`](../proxy/Dockerfile) with context **`proxy/`** (player lives in `proxy/player/`).  
- `livedemo-mcp` — TypeScript MCP (repo `mcp/`) — `/health` should return `{"status":"ok",...}`  
- `livedemo-browser` — Playwright capture service (repo `browser/`) — internal only.  

**Not used:** upstream `livedemo-web-app` / legacy `livedemo-frontend` — player is static in the proxy image. Remove any leftover `livedemo-frontend` service when safe.

## After Mongo replica set

Redeploy **livedemo-backend**, then re-run `./verify-deploy.sh` — expect the public site **HTTP 200**.
