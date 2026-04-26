# DK-LiveDemo Troubleshooting Runbook

Common failure modes in the automated demo generation pipeline and how
to unstick them. Each entry: symptom → diagnosis → fix.

---

## Proxy Docker build: `/proxy/Caddyfile` not found

**Symptom.** `livedemo-proxy` build fails on Railway with:

`failed to solve: ... "/proxy/Caddyfile": not found`

Build logs show `[DBUG] root directory set as 'proxy'` (or `root directory sanitized to 'proxy'`).

**Diagnosis.** With **Root Directory** = `proxy`, Railway only uploads **proxy/**
into the Docker build context. A Dockerfile written for **repository root**
(`COPY proxy/Caddyfile`, `COPY player/` with `player/` at repo root) will fail.
`dockerContext = ".."` does **not** add parent directories to the upload.

**Fix (current layout).** Sources live under **`proxy/player/`**; [`proxy/Dockerfile`](../proxy/Dockerfile)
uses paths relative to **`proxy/`** (`COPY player/`, `COPY Caddyfile`, `COPY inject/`).
[`railway.toml`](../railway.toml) sets `dockerContext = "proxy"`.

Local verify:

```bash
docker build -f proxy/Dockerfile proxy
```

---

## Backend stuck in scaled-to-zero

**Symptom.** `railway ssh --service livedemo-backend` returns
`"Failed to connect: Your application is not running or in a unexpected
state. ... serverless (sleeping)"`. Repeated `railway redeploy --yes`
returns `"cannot be redeployed. This may be because it's currently
building, deploying, or was removed."` for minutes.

**Diagnosis.** `livedemo-backend` has `sleep when idle` enabled + is
internal-only (no public wake traffic). The service scales to zero
after idle timeout, then nothing wakes it. A stuck in-progress deploy
compounds the problem — `railway redeploy` refuses to queue a second one.

**Fix.**

1. Open Railway dashboard → `DK-LiveDemo` → `livedemo-backend` → **Settings → Service → Sleep when idle** → **uncheck**. Internal-only services shouldn't sleep; there's no one to wake them. Apply to `livedemo-mongo` too.
2. If a deploy appears stuck: dashboard → **Deployments** tab → `⋯` on the hung row → **Remove**. Then `railway redeploy --yes` from CLI will queue a fresh one.
3. To confirm alive: `railway ssh --service livedemo-backend "echo OK; node -e 'require(\"http\").get({host:\"localhost\",port:3005,path:\"/\"},r=>console.log(r.statusCode))'"` should print `OK` then `200`.

---

## Backend process running but port 3005 refuses connections

**Symptom.** `railway ssh` works, `cat /proc/*/comm` shows `node` and
`esbuild` alive, but `curl localhost:3005` gets `ECONNREFUSED`.

**Diagnosis.** The Node process is stuck waiting on an unresolved
promise — almost always a `mongoose.createConnection` that can't parse
or reach the URI. Check `railway logs` for `MongoParseError` or
`MongoServerSelectionError`.

**Fix — known recipe.**

- **Missing `DB_URI`.** Backend's `src/envServer.js:11` reads
  `process.env.DB_URI`. If unset, `models/index.js` passes an empty
  string to `mongoose.createConnection()` → `MongoParseError: Invalid
  scheme ... "mongodb://" or "mongodb+srv://"`. Restore via:
  ```
  railway variables --service livedemo-backend \
    --set "DB_URI=mongodb://livedemo-mongo.railway.internal:27017/livedemo?replicaSet=rs0"
  railway redeploy --yes
  ```
  The backend requires BOTH `MONGO_URI` (used by the monq worker) and
  `DB_URI` (used by the API/models code path). Don't unset either.
- **Unreachable Mongo.** Run `railway ssh --service livedemo-mongo` →
  `mongosh --eval 'rs.status().members' 'mongodb://livedemo-mongo.railway.internal:27017/?replicaSet=rs0'` — must show at least one PRIMARY member with `health: 1`.

---

## Screen capture returns 500 / AuthorizationHeaderMalformed

**Symptom.** `livedemo_generate_demo` fails during the `upload` phase.
Direct `POST /workspaces/:ws/stories/:sid/screens` returns 500 with
empty body. Backend logs show:
```
Code: 'AuthorizationHeaderMalformed',
  ...@aws-sdk/middleware-sdk-s3...
```

**Diagnosis.** `postScreens.js:helpers.uploadImage(imageData, ...)`
pushes the base64 PNG to S3 before writing anything to Mongo. S3 auth
must work for any screen to persist. Malformed header means the AWS
credential pair is invalid, expired, or signed against the wrong
region/service.

**Fix.**

1. Verify current env on the service:
   ```
   railway variables --service livedemo-backend | grep -E "^AWS_|S3"
   ```
2. Generate or rotate credentials in the AWS account that owns the
   LiveDemo S3 bucket. Minimum policy: `s3:PutObject`, `s3:GetObject`
   on `arn:aws:s3:::<bucket>/*`.
3. Update Infisical first (project `dk-livedemo`, env `prod`):
   ```
   infisical secrets set AWS_ACCESS_KEY_ID=<new> ...
   infisical secrets set AWS_SECRET_ACCESS_KEY=<new> ...
   ```
4. Re-sync to Railway (the `livedemo-backend` service's Infisical
   integration should pick it up automatically on next redeploy; if
   manually synced, `railway variables --set AWS_ACCESS_KEY_ID=... ...`).
5. `railway redeploy --yes --service livedemo-backend`.
6. Re-run `scripts/probe-v2.js` to verify: should get `status:200` on `POST /screens` with a real `imageUrl` in the response.

**Until this is fixed, Strategy C cannot complete a single generation
end-to-end.** The screens step will always 500.

---

## Generation times out (livedemo-browser)

**Symptom.** `livedemo_generate_demo` returns `{ok:false, phase:'capture', message: "[browser 0 network] timeout of 90000ms exceeded"}` or
`phase:'timeout'`.

**Diagnosis (in order of likelihood).**

1. Browser pool exhausted — all 3 instances busy. Concurrent generations
   exceeded pool size.
2. A single page takes too long to reach `networkidle` — the product
   has long-polling websockets or never-settling fetches.
3. Auth selector not found — the `auth/coretap.ts` placeholders don't
   match the real login DOM.

**Fix.**

1. `curl http://livedemo-browser.railway.internal:3200/ready` (from
   inside Railway) → should show `poolSize == targetSize`. If less,
   check `railway logs --service livedemo-browser` for crash loops.
2. If pool is full, bump `BROWSER_POOL_SIZE` env var; each instance
   costs ~400MB RAM on Pro.
3. For slow pages, change the module's `navigationPlan[].waitFor` from
   `"networkidle"` to a specific CSS selector like
   `"[data-testid=dashboard-loaded]"`. That stops waiting for stray
   XHRs.
4. For auth failure: `railway logs --service livedemo-browser | grep
   "coretap:"` — the auth function emits diagnostic lines naming which
   selector wasn't found. Update `browser/src/auth/coretap.ts` with the
   real selectors from DOM inspection.

---

## Screen capture returns blank PNG

**Symptom.** `livedemo_generate_demo` succeeds but the generated demo
shows white/empty screens.

**Diagnosis (in order of likelihood).**

1. Product auth failed silently — the browser is screenshotting the
   login page, not the authenticated dashboard. (The coretap auth
   function's post-login heuristic missed.)
2. The page loaded but the app rendered blank (missing feature flag,
   tenant not set).
3. `hideSelectors` hid too much — an accidental `body` selector, etc.

**Fix.**

1. Check `livedemo-browser` logs for `coretap: still on login page` —
   that's the clear auth-fail signal. Fix auth function or credentials.
2. Inspect one failing screen's captured HTML
   (`docs/_probe-*-raw.json` or an ad-hoc mongosh query on `screens`
   for the story). If the HTML has `<input type=password>` in it, it's
   the login page.
3. For tenant issues, confirm `CORETAP_DEMO_TENANT_ID` is set and the
   auth function uses it after login.
4. For over-eager `hideSelectors`, compare `config/products.json`
   `defaults.hideSelectors` and the module's per-step overrides
   against the product's actual DOM. Remove the offender.

---

## Popup text shows `{{prospectName}}`

**Symptom.** Generated demo renders popup titles/bodies with literal
`{{prospectName}}` tokens instead of the prospect's name.

**Diagnosis.** The personalizer in `mcp/src/lib/personalizer.ts`
didn't substitute. Either:

- The tool was called without a `prospect.name`.
- A typo in the narrative token name — personalizer only substitutes
  `prospectName`, `prospectLocation`, `prospectContext`. Any other
  token (e.g. `{{name}}`, `{{bar}}`) passes through unchanged.

**Fix.**

1. Check the generator input payload. `prospect.name` is the only
   required field (Zod enforced).
2. `grep -nE '\{\{[^}]+\}\}' config/products.json | grep -v -E 'prospect(Name|Location|Context)'` — any hit is a typo to fix.

---

## URL returns 404 on demo.deltakinetics.io/livedemos/:storyId

**Symptom.** `livedemo_get_demo_status` reports `isPublished: true` but
the returned `publicUrl` 404s.

**Diagnosis.**

1. **Story has no screens.** An empty published story 404s — the
   frontend player requires at least one screen to render. Confirmed
   2026-04-24 via `discovery-probe-v2`.
2. **Proxy config drift.** The Caddy `replace` rule in `proxy/Caddyfile`
   didn't inject, or the upstream frontend is down.
3. **Wrong story id in the URL.** Story soft-deleted (`deletedAt` set).

**Fix.**

1. `livedemo_get_demo_status` also returns `screenCount`. If 0, the
   generation upload phase failed silently — check logs.
2. `curl -I https://demo.deltakinetics.io/` should return 200 with
   `Content-Type: text/html`. If it doesn't, proxy or frontend is
   down; check their Railway deploy status.
3. `livedemo_get_demo` and look at `deletedAt` — should be `null`.

---

## MCP tool returns `{ok:false, phase:'capture', status:0}`

**Symptom.** Browser client can't reach the browser service.

**Diagnosis.** `livedemo-mcp` couldn't connect to
`livedemo-browser.railway.internal:3200`.

**Fix.**

1. Verify the browser service is deployed: `railway service livedemo-browser && railway status`.
2. Verify the MCP env var: `railway variables --service livedemo-mcp | grep LIVEDEMO_BROWSER_URL`. Should be
   `http://livedemo-browser.railway.internal:3200` (default fallback is
   the same, so missing is OK).
3. From inside Railway: `railway run --service livedemo-mcp -- curl -fsS http://livedemo-browser.railway.internal:3200/health`. Must print `{"ok":true}`.

---

## Workspace-id errors / "workspace_id not provided"

**Symptom.** MCP tool errors with `workspace_id not provided and
LIVEDEMO_WORKSPACE_ID not set`.

**Fix.** `LIVEDEMO_WORKSPACE_ID` must be set on `livedemo-mcp`. Current
value: `69ea79a8d7a9e7a66f4a784c` (the `DK CoreTAP Demos` workspace).
Either provide `workspace_id` in every tool call or:
```
railway variables --service livedemo-mcp \
  --set LIVEDEMO_WORKSPACE_ID=69ea79a8d7a9e7a66f4a784c
```

---

## 401 loops / infinite re-auth

**Symptom.** MCP logs show repeated `/users/password-authenticate` calls.

**Diagnosis.** The bot account's password got rotated externally, or
the token was invalidated via manual logout. Our client's re-auth flow
picks up the new token from memory but doesn't persist it.

**Fix.**

1. Test manually: `curl -X POST https://... /users/password-authenticate -d '{"email":"mcp@deltakinetics.io","password":"<from-infisical>"}'`. Should return 200 with a new token.
2. If that fails, the password is wrong. Rotate via the LiveDemo web
   UI (forgot password flow) and update Infisical
   `LIVEDEMO_MCP_PASSWORD`.
3. If it succeeds, the in-memory client has stale state — a redeploy of
   `livedemo-mcp` fixes it.
