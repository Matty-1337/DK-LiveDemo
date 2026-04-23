# Phase A local smoke (DK-LiveDemo)

## GO — infrastructure

- `local/docker-compose.yml` uses bridge networking (Windows-compatible).
- Backend: `GET http://localhost:3005/health` → `{"status":"ok"}`.
- Frontend: `GET http://localhost:5000/` → HTTP 200.
- MCP: `GET http://localhost:3100/health` → `{"status":"ok","tools":20}` with `MCP_AUTH_TOKEN=local-dev-token-123`.

## NO-GO — `livedemo_apply_coretap_template` (until backend API matches)

The published image `docker.io/livedemo/livedemo-backend:latest` (inspected Apr 2026) does **not** expose `POST /api/demos` (Express returns `Cannot POST /api/demos`). The MCP tools target a **demo management REST API** that must be present on the backend process that `LIVEDEMO_API_URL` points to.

**Next step:** Use a backend build/image that includes the `/api/demos` surface (pin a digest after confirmation with the LiveDemo maintainer), or route `LIVEDEMO_API_URL` to a service that implements that contract.

## Commands (reference)

```powershell
# From repo root
docker compose -f local/docker-compose.yml up -d

# MCP (separate shell)
$env:LIVEDEMO_API_URL="http://localhost:3005"
$env:LIVEDEMO_API_TOKEN="local-dev-token-123"
$env:MCP_AUTH_TOKEN="local-dev-token-123"
$env:PORT="3100"
cd mcp; npm run build; node dist/index.js
```
