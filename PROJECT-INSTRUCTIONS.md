# DK-LiveDemo — Claude Code Project Instructions
## Delta Kinetics | Self-Hosted Interactive Demo Platform
### Last updated: April 23, 2026

---

## WHAT THIS PROJECT IS

Self-hosted LiveDemo instance for Delta Kinetics, forked from
exploitx3/livedemo-deploy (MIT license). White-labeled with DK branding,
deployed on Railway, with a custom MCP server for rapid CoreTAP demo creation.

**Goal:** One Claude prompt → published CoreTAP prospect demo in under 60 seconds.

---

## CURRENT STATE (as of session end)

### ✅ WORKING
- demo.deltakinetics.io → HTTP 200, TLS live, DK brand CSS injecting
- livedemo-mcp → https://livedemo-mcp-production.up.railway.app/sse → healthy, 20 tools
- All 5 Railway services running: mongo, backend, frontend, proxy, mcp
- MongoDB replica set rs0 initialized and PRIMARY
- 6 CoreTAP JSON templates built in templates/
- DK brand CSS (552 lines) injecting via Caddy proxy
- GitHub: Matty-1337/DK-LiveDemo, branch main

### ❌ BROKEN — THE ONE THING LEFT TO FIX
The MCP tool `livedemo_apply_coretap_template` returns 404 because
the MCP client is calling wrong API paths.

**Root cause:** We assumed the backend used `/api/demos` style routes.
The real upstream API uses:
- POST /stories (not /api/demos)
- POST /workspaces/:wsId/stories/:id/screens (not /api/demos/:id/steps)
- POST /emptyStory (programmatic story creation)
- POST /users (signup — no auth required)
- POST /users/password-authenticate (login → returns Bearer token)
- POST /workspaces (create workspace)

The DB is empty — no users, no workspaces, no stories yet.
Auth is token-based: Bearer token looked up in authtokens Mongo collection.

### THE FIX NEEDED
1. Bootstrap: create user → login → get Bearer token → create workspace → save wsId
2. Rewrite mcp/src/lib/client.ts to use correct paths + correct auth header
3. Rewrite mcp/src/tools/demos.ts, steps.ts, templates.ts, analytics.ts
   to use real upstream routes
4. Persist token + workspaceId in Railway env vars on livedemo-mcp service

---

## ARCHITECTURE

```
Internet
    ↓
demo.deltakinetics.io (Caddy proxy — livedemo-proxy)
    ↓ injects dk-brand.css into every HTML response
livedemo-frontend.railway.internal:5000 (LiveDemo Vite app)
    ↓ API calls
livedemo-backend.railway.internal:3005 (LiveDemo Node backend)
    ↓
livedemo-mongo.railway.internal:27017 (MongoDB 8, replSet rs0)

Separately:
livedemo-mcp-production.up.railway.app (Our MCP server, port 3100)
    ↓ calls
livedemo-backend.railway.internal:3005
```

---

## RAILWAY PROJECT

- **Project:** DK-LiveDemo
- **Project ID:** df0626c1-9a73-45b3-b73a-911a0e2a823e
- **URL:** https://railway.com/project/df0626c1-9a73-45b3-b73a-911a0e2a823e

| Service | Type | URL | Status |
|---|---|---|---|
| livedemo-mongo | Docker: mongo:8 | internal only | ✅ Online |
| livedemo-backend | Docker: **ghcr.io/matty-1337/dk-livedemo-backend:v1** | internal only | ✅ Online |
| livedemo-proxy | Repo: `proxy/Dockerfile` (context `proxy/`) | demo.deltakinetics.io | ✅ Online |
| livedemo-mcp | Repo: mcp/Dockerfile | livedemo-mcp-production.up.railway.app | ✅ Online |
| livedemo-browser | Repo: browser/Dockerfile | internal only | ✅ Online |

---

## INFISICAL SECRETS

- **Project:** Third-Party-APIs
- **Project ID:** 9df34929-a28d-4dc2-99a5-06f55da7d963
- **Environment:** prod
- **Domain:** infisicalinfisicallatest-postgres-production-d8ab.up.railway.app

Key secrets for this project:
- LIVEDEMO_API_URL = http://livedemo-backend.railway.internal:3005
- LIVEDEMO_API_TOKEN = (in Infisical)
- PRIVATE_AUTH_TOKEN = (same as API token)
- MONGO_URI = mongodb://livedemo-mongo.railway.internal:27017/livedemo?replicaSet=rs0
- DB_URI = same as MONGO_URI
- ENABLE_API = true
- ENABLE_CONSUMER = true
- PORT = 3005
- MCP_AUTH_TOKEN = (removed — MCP endpoint is now open, no inbound auth)

⚠️ SECRET ROTATION NEEDED: Backend startup logs dump all env vars to stdout.
Rotate these ASAP in their dashboards + update Infisical:
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- ELEVENLABS_API_KEY
- APIFY_API_KEY
- MUX_TOKEN_ID / MUX_TOKEN_SECRET

---

## REPO STRUCTURE

```
C:\AI-Workspaces\dk-livedemo\
├── local/                        # Docker Compose for local dev
│   ├── docker-compose.yml
│   └── envs/
│       ├── backend.env
│       └── web-app.env
├── frontend/
│   └── Dockerfile                # Wraps livedemo-web-app:latest, stubs missing file
├── proxy/
│   ├── Caddyfile                 # Reverse proxy + CSS injection
│   ├── Dockerfile                # caddy:2 + replace-response plugin
│   └── inject/
│       └── dk-brand.css          # 552-line DK brand override
├── mcp/
│   ├── src/
│   │   ├── index.ts              # MCP server entry, SSE transport, port 3100
│   │   ├── tools/
│   │   │   ├── demos.ts          # ❌ NEEDS REWRITE — wrong API paths
│   │   │   ├── steps.ts          # ❌ NEEDS REWRITE — wrong API paths
│   │   │   ├── templates.ts      # ✅ Works (in-memory templates)
│   │   │   └── analytics.ts      # ❌ NEEDS REWRITE — wrong API paths
│   │   └── lib/
│   │       ├── client.ts         # ❌ NEEDS REWRITE — wrong base paths
│   │       └── coretap-templates.ts  # ✅ Works — 6 CoreTAP templates
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── railway.toml
├── railway/
│   ├── backend.railway.toml
│   ├── frontend.railway.toml
│   └── mongo.railway.toml
├── templates/                    # ✅ All 6 CoreTAP JSON templates
│   ├── coretap-overview.json
│   ├── coretap-golden-hours.json
│   ├── coretap-void-detection.json
│   ├── coretap-employee-grading.json
│   ├── coretap-monitor-pitch.json
│   └── coretap-command-full.json
├── mongo/
│   └── Dockerfile                # mongo:8 with --replSet rs0
├── verify-deploy.sh
├── railway.json
├── CLAUDE.md
└── HANDOFF.md
```

---

## REAL UPSTREAM API ROUTES (discovered via SSH)

These are the ACTUAL routes in the upstream livedemo-backend image:

```
POST   /users                                           # signup, no auth
POST   /users/password-authenticate                     # login → Bearer token
POST   /workspaces                                      # create workspace
POST   /stories                                         # create story (screen recording)
POST   /emptyStory                                      # create empty story (programmatic)
POST   /inProgressStory                                 # create in-progress story
GET    /workspaces/:wsId/stories/:storyId               # get story
DELETE /workspaces/:wsId/stories/:storyId               # delete story
POST   /workspaces/:wsId/stories/:storyId/screens       # add screen/step
POST   /workspaces/:wsId/stories/:storyId/publish       # publish story
POST   /forms                                           # create lead form
POST   /workspaces/:wsId/forms                          # workspace-scoped form
GET    /workspaces/:wsId/sessions                       # analytics
GET    /workspaces/:wsId/leads                          # leads
```

Auth: `Authorization: Bearer <token>` where token is looked up in
`authtokens` Mongo collection. Token obtained from password-authenticate.

---

## FIRST TASK IN NEW SESSION

Bootstrap the upstream API so MCP tools work:

```bash
# Step 1 — Create MCP bot user
railway run --service livedemo-mcp -- node -e "
const axios = require('axios');
axios.post('http://livedemo-backend.railway.internal:3005/users', {
  email: 'mcp@deltakinetics.io',
  password: process.env.LIVEDEMO_MCP_PASSWORD  // stored in Infisical as LIVEDEMO_MCP_PASSWORD,
  name: 'DK MCP Bot'
}).then(r => console.log(JSON.stringify(r.data)))
  .catch(e => console.log(e.response?.data));
"

# Step 2 — Login + get token
railway run --service livedemo-mcp -- node -e "
const axios = require('axios');
axios.post('http://livedemo-backend.railway.internal:3005/users/password-authenticate', {
  email: 'mcp@deltakinetics.io',
  password: process.env.LIVEDEMO_MCP_PASSWORD  // stored in Infisical as LIVEDEMO_MCP_PASSWORD
}).then(r => console.log(JSON.stringify(r.data)))
  .catch(e => console.log(e.response?.data));
"

# Step 3 — Create workspace (use token from step 2)
# Step 4 — Store token + wsId as Railway env vars on livedemo-mcp
# Step 5 — Rewrite mcp/src/lib/client.ts + tool files
# Step 6 — Commit, push, redeploy, test
```

---

## CORETAP TEMPLATES (6 ready)

| ID | Name | Tier | Focus |
|---|---|---|---|
| coretap-overview | CoreTAP Overview | monitor | All features, 8 steps |
| coretap-golden-hours | Golden Hours Deep Dive | monitor | Revenue peak window |
| coretap-void-detection | Void Detection | execute | Fraud/theft alerts |
| coretap-employee-grading | Employee Grading | execute | A-D staff performance |
| coretap-monitor-pitch | Monitor Pitch ($449) | monitor | Sales conversion |
| coretap-command-full | Command Full Demo ($749) | command | Enterprise/multi-location |

---

## DK BRAND TOKENS

```
Background:     #0A1420
Gradient:       linear-gradient(90deg, #92F7FC, #B6E2FF)  ← ALWAYS gradient
CoreTAP Cyan:   #40F0F0
CoreTAP Magenta:#E040C0
Text Primary:   #F0F4FF
Text Secondary: #8899BB
Border:         rgba(64, 240, 240, 0.15)
Fonts:          Inter (body) + JetBrains Mono (code/metrics)
```

CoreTAP Pricing (canonical — never use old prices):
- Monitor: $449/mo
- Execute: $599/mo
- Command: $749/mo

---

## KEY COMMANDS

```bash
# Tail logs
railway logs --service livedemo-backend --tail 50
railway logs --service livedemo-mcp --tail 50
railway logs --service livedemo-proxy --tail 30

# Restart services
railway service restart livedemo-backend
railway service restart livedemo-mcp

# SSH into service
railway shell --service livedemo-backend
railway shell --service livedemo-mongo

# Add Infisical secret
infisical secrets set KEY="value" \
  --projectId 9df34929-a28d-4dc2-99a5-06f55da7d963 \
  --env prod \
  --domain infisicalinfisicallatest-postgres-production-d8ab.up.railway.app

# Test MCP health
curl https://livedemo-mcp-production.up.railway.app/health

# Test public site
curl -I https://demo.deltakinetics.io
curl https://demo.deltakinetics.io | grep dk-brand

# Deploy
git add . && git commit -m "..." && git push origin main
```

---

## RULES

1. NEVER modify docker.io/livedemo/* images — closed source
2. ALL secrets go through Infisical — never hardcode
3. Use --domain flag on every infisical CLI command
4. livedemo-backend and livedemo-mongo must NEVER sleep (no public ingress to wake them)
5. All demo creation in production must flow through MCP server
6. DK brand CSS lives in proxy/inject/dk-brand.css — edit there, not inline
7. MCP server has NO inbound auth (removed) — do not re-add without updating claude.ai connector

---

## DEVELOPER CONTACTS

- **Owner:** Matty Herrera (CEO, Delta Kinetics)
- **Dev Lead:** Keval Patel
- **Backend:** Neil
- **EA:** Haley Rodriguez
- **GitHub:** Matty-1337
- **Railway account:** matt@htxtap.com
