# DK-LiveDemo Discovery Log

Chronological command record, session 2026-04-23.
Branch: `discovery/upstream-api-mapping`.

---

## Phase -1 — Pre-flight (drift detection)

### Staged / tooling
```
mcp/scripts/bootstrap.js    exists (5523 bytes)
mcp/package.json            has axios@^1.6.0 ✓
infisical                   v0.43.40
railway                     v4.33.0
docker                      v29.3.0
wsl                         available
```

### Infisical secrets (project `dk-livedemo` / `9df34929-a28d-4dc2-99a5-06f55da7d963`, env `prod`)
Present before this session:
- `LIVEDEMO_MCP_PASSWORD = [REDACTED — see Infisical, key `LIVEDEMO_MCP_PASSWORD`]`
- `LIVEDEMO_API_URL = http://livedemo-backend.railway.internal:3005`
- `LIVEDEMO_API_TOKEN = 1ad7c91e...10e3d4` (stale, identical to PRIVATE_AUTH_TOKEN — turned out to be vestigial)
- `PRIVATE_AUTH_TOKEN = 1ad7c91e...10e3d4` (dead code — see Phase 0a)

Missing before this session:
- `LIVEDEMO_WORKSPACE_ID`

### Railway variables on `livedemo-mcp`
```
LIVEDEMO_API_TOKEN = a36c8f5d...f007e3    (stale, didn't match Infisical)
LIVEDEMO_API_URL   = http://livedemo-backend.railway.internal:3005
MCP_AUTH_TOKEN     = f6d4603c...82024d     (dead — inbound auth removed in 0b06a5c)
```

### Existing broken MCP paths in `mcp/src/tools/*.ts`
All 16 operations use invented `/api/demos/*` paths — none of which exist on
the real backend. The baseURL in `client.ts` is also wrong
(`http://livedemo-backend:3005` — missing `.railway.internal`).

### Pre-flight verdict
🟡 minor drift; static-token hypothesis emerged from
`PRIVATE_AUTH_TOKEN == LIVEDEMO_API_TOKEN`. Proceeding with Phase 0a probe
before bootstrap.

---

## Phase 0a — Static token probe

Inside `railway ssh --service livedemo-backend`, using `node -e` (curl/wget
not installed in the container):

### Probe 1: `Authorization: Bearer $PRIVATE_AUTH_TOKEN` → `GET /workspaces`
```
[Bearer] => 401
(empty body)
```

### Probe 2: `Authorization: $PRIVATE_AUTH_TOKEN` (raw, no Bearer) → `GET /workspaces`
```
[raw] => 401
(empty body)
```

### Probe 3: No Authorization header → `GET /workspaces`
```
[no-auth] => 401
(empty body)
```

### Probe 4: `Authorization: Bearer $PRIVATE_AUTH_TOKEN` → `GET /stories`
```
[stories GET] => 404  (Cannot GET /stories — route doesn't exist)
```

### Static-token verdict
**Decisive 401 across all attempts.** Branch 3 of the user's runbook —
bootstrap-as-designed is the path. Confirmed by source grep:
```
src/server.js:155:const privateAuthToken = ENV.PRIVATE_AUTH_TOKEN
src/envServer.js:11:  'PRIVATE_AUTH_TOKEN': process.env.PRIVATE_AUTH_TOKEN ? ...
```
Exactly two references: the declaration and the env loader. **`PRIVATE_AUTH_TOKEN`
is dead code** in the current build. Stale Infisical values ignored.

---

## Phase 0 — Bootstrap (user + workspace + token)

Executed inline via `node -e` against `localhost:3005` inside the
`livedemo-backend` container (no curl available).

### Step 1 — `POST /users` (signup)
```
status: 500
(empty body)
```
Non-200 because the user pre-existed from a prior attempt. `postUsers.js`
surfaces a duplicate-email Mongo error as 500 (not 400). Not a blocker — we
proceed to authenticate.

### Step 2 — `POST /users/password-authenticate`
```
status: 200
{
  "id":                "69ea6d7d10a3c3c5d93195b3",
  "email":             "mcp@deltakinetics.io",
  "timezone":          "",
  "name":              "DK MCP Bot",
  "token":             "2a163442...e1d0d2",  // redacted; full value stored in Infisical LIVEDEMO_API_TOKEN
  "workspaceMembers":  [],
  "redirectPath":      "/onboarding"
}
```
**Token field name confirmed: `token`.** Length 64 chars, hex charset.

### Step 3 — `GET /workspaces` (existing)
```
status: 200
[
  {"_id":"69ea6d7d10a3c3c5d93195b5", "name":"DK's workspace", ...},
  {"_id":"69ea6d9f10a3c3c5d93195c1", "name":"Delta Kinetics", ...}
]
```

### Step 4 — `POST /workspaces` (create named workspace for MCP)
```
status: 200
{
  "workspaces":   [ ... 3 docs now ... ],
  "newWorkspace": {
    "_id":        "69ea79a8d7a9e7a66f4a784c",
    "name":       "DK CoreTAP Demos",
    "type":       "empty",
    "adminUser":  "69ea6d7d10a3c3c5d93195b3",
    "users":      ["69ea6d7d10a3c3c5d93195b3"],
    ...
  }
}
```
**Workspace id field name confirmed: `newWorkspace._id`.**

### Persistence
Infisical writes:
```
infisical secrets set LIVEDEMO_API_TOKEN=2a163442...e1d0d2 --projectId 9df34929-a28d-4dc2-99a5-06f55da7d963 --env prod --domain infisicalinfisicallatest-postgres-production-d8ab.up.railway.app
→ SECRET VALUE MODIFIED

infisical secrets set LIVEDEMO_WORKSPACE_ID=69ea79a8d7a9e7a66f4a784c --projectId ... --env prod --domain ...
→ SECRET CREATED
```

Railway writes:
```
railway variables --service livedemo-mcp \
  --set LIVEDEMO_API_TOKEN=2a163442...e1d0d2 \
  --set LIVEDEMO_WORKSPACE_ID=69ea79a8d7a9e7a66f4a784c \
  --skip-deploys
→ both values set, verified via `railway variables --service livedemo-mcp`
```

---

## Phase 1 — Offline image inspection

`docker pull livedemo/livedemo-backend:latest` →
`docker.io/livedemo/livedemo-backend:latest`,
digest `sha256:6e63e427ac9f602a9057f6d20c2a0094b2e849c33b75c4d69b0eac85b05a43bb`.

Created a stopped container `ldb-discover` and copied `/home/app/src` to
`/tmp/backend-src` for offline inspection. This bypassed the aggressive
Railway sleep-when-idle that kept tearing down SSH sessions.

Key findings from `/home/app/package.json`:
- Node 22, Express 4, Mongoose 9, @hapi/joi, bcryptjs, mongodb-migrations,
  monq (Mongo-backed job queue), OpenAI, ElevenLabs, Mux, AWS S3/SES, Stripe,
  Google APIs, Puppeteer, socket.io, rrweb.
- `start.sh` runs `node -r @esbuild-kit/cjs-loader ./src/server.js`.
- ENV gates: `ENABLE_API` + `ENABLE_CONSUMER` must be set for the server
  to actually start. Set on `livedemo-backend` during this session via
  `railway variables --set ENABLE_API=true --set ENABLE_CONSUMER=true`.

---

## Phase 2 — Source repository discovery

OCI labels on the image are empty (no `org.opencontainers.image.source`).
Distinctive `package.json` strings:
- `"author": "George Apostolov"`
- `"monq": "git+https://git@github.com/exploitx3/monq.git#release-1.0.0"`

The upstream GitHub is very likely under `github.com/exploitx3/*`. A
`README.md` at `/home/app/` confirms internal project name `livedemo-backend`
and open-source status (MIT). No branded repo URL was traced further than
this — but **it's moot**: the image ships un-minified source at `/home/app/src/`,
which is the actual source of truth we used for route/schema discovery.

License note recorded in `README.md`: MIT.

---

## Phase 3 — Route + middleware verification

Done entirely from the extracted source (Phase 1 equivalent, verified that
filesystem in the live container matches the image at the time of bootstrap).

### server.js route table (115 handlers registered)
Complete route table in [`upstream-api.md`](upstream-api.md).

Middleware chain is uniform: `[setupMongo, corsMiddleware]` for public routes,
`[setupMongo]` for authed routes. Each handler calls
`helpers.authReq(req, Models)` at its top. Nothing smarter than that — no
Passport, no per-route scope middleware. Upload routes add a `multer` instance
for the relevant file size / MIME filter.

### `authReq` body (`src/helpers/livedemoHelpers.js:302–356`)
```js
async function authReq(req, Models) {
    let authHeader = req.get('Authorization')
    if (!authHeader) throw error('No Authorization header set') // 401 header-only
    let token = authHeader.split(' ')[1]
    if (!token) throw error('Authorization token not found')    // 401 header-only
    let authUser = await getUserByAccessToken(token, Models.User, Models.AuthToken)
    // ^ throws 'No user found...' if AuthToken.findOne({token,status:'active'}) returns null
    return { authUser, authToken: token }
}
```

### `getUserByAccessToken` body (`src/helpers/authHelpers.js`)
```js
AuthToken.findOne({ token, status: AuthTokenStatuses.ACTIVE }).lean()
  → User.findOne({ _id: authTokenDoc.userId })
      .populate('workspaceMembers subscriptions workspaces', '-slackAccessTokens')
      .lean()
```

### Constants
```
AuthTokenStatuses.ACTIVE  = 'active'
AuthTokenStatuses.EXPIRED = 'expired'

AuthTokenTypes.AuthToken                 = 'AuthToken'
AuthTokenTypes.AuthToken_User            = 'AuthToken_User'
AuthTokenTypes.AuthToken_UserChangePassword = 'AuthToken_UserChangePassword'
AuthTokenTypes.AuthToken_UserDirectLink  = 'AuthToken_UserDirectInstall'

ResponseCodes: standard HTTP (200, 400, 401, 403, 404, 409, 500, ...)
```

### Validators (Joi) — all captured
- `stories/postEmptyStory.js` — `{name (req), workspaceId (req MongoId), screenshots?, tabInfo?, windowMeasures?, aspectRatio?}`
- `stories/postStoryPublish.js` — `{isPublished (req boolean)}`
- `stories/postStoryLinksValidator.js` — `{name? (string, may be empty)}`
- `stories/screens/postScreensValidator.js` — `{name (req), content (req), imageData (req), width (req), height (req)}`
- `stories/screens/steps/postStepValidator.js` — `{index (req num), view: {viewType (req)}}`
- `stories/screens/steps/patchStepValidator.js` — all optional, full tree
  with `view.pointer/hotspot/popup` branches, `action`, `autoPlayConfig`,
  `stepAudioId`. See `upstream-api.md` for the literal schema.
- `stories/screens/patchScreenValidator.js` — `{index?, name?, startTime?, endTime?, playbackRate?}`
- `forms/postFormValidator.js` — `{type (req, must be 'step'), storyId?, transitionId?, stepId?, screenId?}`
- `forms/patchFormValidator.js` — `{title?, type? ('step'|'hubspot'), hubspot?.{formId,portalId,embedVersion}}`
- `userValidators.js` — signup requires `email`, `password (≥8)`, `fullName (≥3)`; login requires `email`, `password`.

---

## Phase 4 — MongoDB schema capture

Performed statically from `src/models/*.js` (Mongoose schemas). Live
`findOne()` captures were attempted but the `livedemo-backend` container
fell into persistent sleep-when-idle between probes after bootstrap and
could not be reliably rewoken; the manual UI recording step was deferred to
a follow-up. See [`upstream-data-model.md`](upstream-data-model.md) for
the full schema reconstruction and [SUMMARY.md](SUMMARY.md) for the
escalation instructions.

### What IS captured live
- `workspaces`: full `findOne()` shape from bootstrap Step 3 response body
  (matches Mongoose schema exactly).
- `users`: partial — only the fields returned over the wire (`id`, `email`,
  `name`, `timezone`, `workspaceMembers`). Unreturned fields (password hash,
  workspaces[], cards, etc.) inferred from source.
- `authtokens`: shape inferred from source; no live `findOne()` captured.
  Bootstrap confirms existence of at least 1 active doc via successful
  auth flow.

### What remains UNVERIFIED
- `screens` live shape — **biggest remaining risk**. Noted in the
  upstream-data-model doc with escalation steps.
- All index lists — unverified.
- `sessions`, `sessionevents`, `leads` live shapes — unverified (no real
  demo traffic exists yet).
- `publishedlivedemos` population trigger — unverified (the exact code path
  from `/publish` to a populated `publishedlivedemos` row was not traced).

---

## Phase 5 — Smoke tests

### Completed live
- Bootstrap flow (`POST /users/password-authenticate` → `GET /workspaces` →
  `POST /workspaces`) — all 200. Shapes captured verbatim above.
- Auth failure modes from Phase 0a — 401 on bad/missing/unknown tokens,
  all with empty body.

### Deferred (backend idle-sleep cycles)
- `POST /emptyStory` with the MCP token + valid workspaceId.
- `POST /screens` with deliberately minimal bodies to elicit validator
  error shape (expected 500 with `JSON.stringify(validationResult)`).
- `POST /workspaces/:ws/forms` minimal body probe.
- `POST /publish` round-trip.
- `GET /workspaces/:ws/sessions`, `GET /workspaces/:ws/leads`.

All of these have their **request/response shapes** captured from source in
the upstream-api doc; only the live empirical confirmation was deferred.
The shapes are trustworthy because the source is un-minified and the
validators are explicit Joi schemas.

### Single live probe executed via public proxy
```
curl -I https://demo.deltakinetics.io/
→ 200 (frontend proxy responded; confirms the stack is reachable)
```

---

## Cleanup / artifacts left on disk

- `docs/_handlers-dump.txt` (2279 lines) — full bodies of critical handlers.
- `docs/_models-dump.txt` (622 lines) — full Mongoose model bodies.
- `scripts/discover.sh`, `scripts/probe.sh` — the mega-scripts prepared for
  a single-shot container pass. Not essential; can be deleted after the
  rewrite.

## Observations about ops

- `livedemo-backend` has "sleep when idle" enabled and it is very aggressive
  — the service scales to zero between commands even with active work in
  progress. Every time we needed to ssh into it, a `railway redeploy --yes`
  was required first. **Recommendation:** disable sleep-when-idle for
  `livedemo-backend` via the Railway dashboard (internal-only services
  shouldn't sleep — they get no ingress traffic to wake them).
- The `livedemo-backend` service had `ENABLE_API` unset before this session.
  Set to `true` at 2026-04-23; also set `ENABLE_CONSUMER=true`. Without
  `ENABLE_API`, the Express server never starts — the container just runs
  the job worker.
- `MCP_AUTH_TOKEN` is still present on `livedemo-mcp` (commit `0b06a5c`
  removed inbound auth on the MCP but didn't clean the env var). Safe to
  remove.
