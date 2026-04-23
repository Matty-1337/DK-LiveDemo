# Railway — DK-LiveDemo

- **Project:** [DK-LiveDemo](https://railway.com/project/df0626c1-9a73-45b3-b73a-911a0e2a823e)  
- **Workspace:** matty-1337's Projects  

## Public URLs (generated)

| Service | URL |
|--------|-----|
| **Proxy (site + /api)** | `https://livedemo-proxy-production.up.railway.app` |
| **MCP** | `https://livedemo-mcp-production.up.railway.app` |

## Services

- `livedemo-mongo` — `mongo:8` + volume `/data/db` — **set replica set** per [RAILWAY_MONGO_REPLSET.md](./RAILWAY_MONGO_REPLSET.md) (backend will crash with change-stream errors until this is done).  
- `livedemo-backend` — `docker.io/livedemo/livedemo-backend:latest`  
- `livedemo-frontend` — `docker.io/livedemo/livedemo-web-app:latest`  
- `livedemo-proxy` — Caddy (repo `proxy/`)  
- `livedemo-mcp` — TypeScript MCP (repo `mcp/`) — `/health` should return `{"status":"ok","tools":20}`

## After Mongo replica set

Redeploy **livedemo-backend**, then re-run `./verify-deploy.sh` — expect the public site **HTTP 200**.
