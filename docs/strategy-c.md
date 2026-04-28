# Strategy C — Automated Agentic Demo Generation

> Architecture, request flow, and runbook for the one-call MCP tool that
> produces a published, personalized LiveDemo from scratch.

---

## Goal

From claude.ai a user says _"Generate a CoreTAP Golden Hours demo for
Johnny's Tavern in Dallas"_ → gets back
`https://demo.deltakinetics.io/livedemos/<id>` within 60 seconds,
featuring real CoreTAP dashboard screenshots with
Johnny's-Tavern-appropriate data and popup copy personalized to the
prospect.

## Architecture

```
Generation path                    Render path
──────────────────────             ─────────────────────────────
User in claude.ai                  Prospect (browser)
      │                                  │
      ▼                                  ▼
livedemo-mcp     (public 3100)     livedemo-proxy   (public 80, demo.deltakinetics.io)
   │ orchestrate                       │
   │ personalize                       ├──► /livedemos/:id   → static DK Player SPA
   │                                   │       (built from proxy/player, served by Caddy)
   ├──► livedemo-browser  (internal)   │
   │      Playwright capture           └──► /api/v1/demos/:id → rewrite → /preview/:id
   │                                                          │
   ▼                                                          ▼
livedemo-backend (internal 3005) ◄───────────────────────────┘
   │  existing LiveDemo Express API, 115 routes
   │  /emptyStory, /screens (PNG→S3), /steps, /publish
   │  /preview/:id is the public 🌐 read-only story route
   ▼
livedemo-mongo   (internal 27017)
   │
   └──► S3       (Delta Kinetics AWS)
```

Public surface: only `livedemo-mcp` (`livedemo-mcp-production.up.railway.app`)
and `livedemo-proxy` (`demo.deltakinetics.io`). Backend, mongo, browser
service are internal-only via Railway DNS.

**The upstream Vite frontend (`livedemo-web-app`) is off the request path** as
of 2026-04-25 — replaced by the static DK Player SPA in `proxy/player`, served
by Caddy. A dormant **`livedemo-frontend` Railway service** may still exist in
the dashboard until manually removed; it is not in `railway.json` and receives
no traffic. **Owner decision:** delete after confirming no external dependency.
See `docs/upstream-patches.md` for patch retirement and `docs/player.md` for
player architecture.

## Request flow (livedemo_generate_demo)

```
1. MCP: resolveModule(product, module) against config/products.json
        → navigationPlan[] + narrative[]

2. MCP → livedemo-browser: POST /capture
        { product, module, baseUrl, navigationPlan }
        ← { screens: [{ html, pngBase64, width, height, pageTitle, ... }] }

3. MCP → backend: POST /emptyStory
        { name, workspaceId, windowMeasures, aspectRatio }
        ← { _id: storyId }

4. for each captured screen:
   MCP → backend: POST /workspaces/:ws/stories/:sid/screens
        { name, content, imageData, width, height }
        ← { _id: screenId, ... }

   if narrative[screenIndex] exists:
     MCP → backend: POST .../screens/:scid/steps
        { index: 0, view: { viewType: "popup" } }
        ← { _id: stepId, ... }

     MCP → backend: PATCH .../steps/:stepId
        { view: { popup: renderPopup(narrative, prospect) } }

5. MCP → backend: POST /workspaces/:ws/stories/:sid/publish
        { isPublished: true }

6. MCP → backend: POST /workspaces/:ws/stories/:sid/links
        { name: prospectName }
        ← { _id: shortUuid, ... }

7. return {
     ok: true, storyId, name,
     url:      "https://demo.deltakinetics.io/livedemos/" + storyId,
     shareUrl: "https://demo.deltakinetics.io/l/" + shortUuid,
     screenCount, generatedAt, timings
   }
```

Error handling is phase-scoped. A failure after `createEmptyStory`
triggers a best-effort `DELETE /stories/:id` (soft-delete via `deletedAt`)
to avoid clutter. Publish failure intentionally does NOT clean up —
screens are expensive to recreate and the story might still be
recoverable by retrying publish alone.

## Upstream ingestion pattern

The backend's `POST /workspaces/:ws/stories/:sid/screens` handler:

1. Takes `{name, content, imageData, width, height}` in the request body
   (Joi-validated — see `docs/upstream-api.md`).
2. Calls `helpers.uploadImage(imageData, imageName)` which pushes the
   base64 PNG to S3 — **this is where the strategy C pipeline currently
   breaks** if AWS creds are malformed (see
   [troubleshooting.md](troubleshooting.md)).
3. Writes HTML content to `$STORIES_FOLDER/<storyId>/<screenId>.html`
   on the backend's local filesystem.
4. Creates the `Screen_Page` Mongo document with `imageUrl` pointing at
   the S3 URL from step 2.

Screens post **incrementally** — each POST is a discrete transaction.
There is no batch-upload route. For a 6-screen demo we make 6 sequential
`POST /screens` calls plus up to 6 `POST /steps` + `PATCH /steps`. This
puts the bottleneck squarely on screen uploads (PNG size × 6). Large
full-page screenshots at 1280×800 typically hit 200KB–1MB as base64.

## Adding a new product

See [products-catalog.md](products-catalog.md). Short version:

1. Provision a demo-bot account in the product's environment, scoped to
   a safe demo tenant.
2. Add `<PRODUCT>_LOGIN_URL`, `<PRODUCT>_DEMO_BOT_EMAIL`,
   `<PRODUCT>_DEMO_BOT_PASSWORD`, and any tenant-id Infisical secrets
   under project `dk-livedemo`, env `prod`.
3. Implement `browser/src/auth/<product>.ts` — Playwright login flow.
4. Register in `browser/src/auth/registry.ts`.
5. Add the product block to `config/products.json` with `authFn`
   pointing at the registry key and at least one module with
   `navigationPlan` + `narrative`.
6. Run `scripts/generate-dry-run.js` against the new product/module
   to validate the MCP orchestration.
7. Deploy `livedemo-browser` with the new secrets accessible.
8. Run `mcp/scripts/e2e-test.ts` (Phase 7 — to be authored) against
   production.

## Runbook — generation failed

See [troubleshooting.md](troubleshooting.md). Entry points by phase:

- `phase: 'catalog'` — product/module id wrong; check `livedemo_list_products` output.
- `phase: 'capture'` — browser service issue. Check `livedemo-browser` `/ready`, logs, and product auth.
- `phase: 'create-story'` — backend unreachable or `DB_URI` missing.
- `phase: 'upload'` — **almost always S3 auth**. See troubleshooting §"Screen capture returns 500 / AuthorizationHeaderMalformed".
- `phase: 'steps'` — screens uploaded but step PATCH failed; manual inspection via `livedemo_get_demo`.
- `phase: 'publish'` — rarest; screens exist, just retry.
- `phase: 'link'` — non-fatal; `url` is still returned, only `shareUrl` missing.

## Cost estimates (Railway Pro)

**Expected per-demo generation cost:** dominated by 60s of Playwright
CPU/RAM on the browser service. Back-of-envelope:

- `livedemo-browser`: 3 warm Chromium ≈ 1.2GB RAM idle, 2.5GB peak.
  Railway Pro: ~$0.000463/GB-s → ~$0.07/hour of pool uptime. Service
  should run 24/7 (no sleep — internal-only). **~$50/mo.**
- `livedemo-backend`: existing, ~200MB idle, ~600MB under load. **~$15/mo.**
- `livedemo-mongo`: ~150MB idle, persistent storage. **~$10/mo.**
- `livedemo-proxy` (Caddy): <100MB. **~$5/mo.**
- `livedemo-mcp`: <150MB, mostly idle. **~$5/mo.**

Generation-time cost per demo: ~30–60s × 500MB × (one browser instance +
orchestration) → under $0.001. S3 PUT + storage per demo: ~$0.0001.
**Total: each generated demo costs less than a penny in infra.**

Scale ceiling at pool size 3: concurrent generations cap at 3, each
~30–60s. So ~180 generations/hour = 4,320/day if fully saturated. Real
usage will be 10–50/day; no scaling concerns at that rate.

## Upstream image patches

Active patches reduced to **1** as of 2026-04-25:

- `backend :v1` — `sed` renames the hardcoded `livedemo-cdn` S3 bucket
  to our `dk-livedemo-cdn` (still required; backend uploads PNGs on
  every screen create).

The other four (backend `:v2`, `:v3`; frontend `:v1`, `:v2`) became
obsolete when the custom DK Player shipped — they all patched code paths
the static player no longer touches. Full table, retirement reasoning,
and the patch authoring pattern moved to `docs/upstream-patches.md`.

When upstream fixes the v1 bucket hardcoding, switch Railway back to
upstream `:latest`, delete `backend-patch/`, and we're off the fork
entirely.

## Credentials lifecycle

- Backend `PRIVATE_AUTH_TOKEN` — **dead code**, do not maintain. See
  `auth-model.md`.
- LiveDemo MCP bot account (`mcp@deltakinetics.io`) — long-lived, no
  rotation needed unless the account is compromised.
- `CORETAP_DEMO_BOT_PASSWORD` — rotate on 180-day schedule. Update
  Infisical first, then Railway.
- Infisical service token for `livedemo-browser` — 90-day expiry
  recommended. Document creation date here when rotated:
  - **Created:** _pending — will be `infisical service-token create`'d in
    Phase 3 once CoreTAP bot account exists._
- AWS S3 credentials — **currently broken** (see troubleshooting). When
  rotated, record the new IAM user name here for audit:
  - **User:** _pending rotation_
  - **Policy ARN:** _pending rotation_
  - **Rotation date:** _pending_

## Known gotchas

- **`DB_URI` must always be set** on `livedemo-backend`. `MONGO_URI`
  alone is not enough — different code paths read each. Omitting
  `DB_URI` makes the backend appear alive (process running) but
  silently never binds port 3005.
- **Sleep-when-idle must be OFF** for all internal services
  (`livedemo-backend`, `livedemo-mongo`, `livedemo-browser`). They have
  no public wake traffic so they never come back up after sleeping.
- **Validator errors return 500**, not 400, from the backend. Don't
  status-code-map; read `response.data`.
- **Empty published stories 404** on the public proxy. `isPublished=true
  AND screenCount>0` is the real ready signal.
- **`aspectRatio` is stored as a String** in Mongo even though the API
  accepts a number. Cosmetic quirk; MCP handles correctly.
- **`screens` collection has no index on `storyId`**. Listings of screens
  for a given story do a full scan. Fine at small scale; investigate if
  the collection grows past ~10K docs.
