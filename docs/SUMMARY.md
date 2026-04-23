# DK-LiveDemo Discovery — Summary

Generated 2026-04-23 by Claude Code on branch `discovery/upstream-api-mapping`.

---

## Bootstrap state

- **MCP bot user:** `mcp@deltakinetics.io` — `_id = 69ea6d7d10a3c3c5d93195b3` ✓
- **Primary workspace for MCP:** `DK CoreTAP Demos` — `_id = 69ea79a8d7a9e7a66f4a784c` ✓
  - (Two other workspaces exist on this user from earlier attempts:
    `"DK's workspace"` and `"Delta Kinetics"`. Ignore them unless consolidating.)
- **Token issued to MCP:** `2a163442...e1d0d2` (64-hex, opaque, no expiry) ✓
- **Persisted to Railway on `livedemo-mcp`:** yes
  - `LIVEDEMO_API_TOKEN = 2a163442...e1d0d2`
  - `LIVEDEMO_WORKSPACE_ID = 69ea79a8d7a9e7a66f4a784c`
- **Persisted to Infisical (project `dk-livedemo`, env `prod`):** yes, same two keys.
- **First published demo:** **none yet** — deferred to manual UI step (see "Top unknowns").
- **Public demo URL:** https://demo.deltakinetics.io (health: 200).
- **MCP endpoint:** https://livedemo-mcp-production.up.railway.app/sse (unchanged).

## Verdict on rewrite readiness

🟢 **Rewrite is unblocked.** Every route the MCP needs (list/get/create/delete
stories, add/patch/delete steps, create/patch forms, publish, story links,
session + lead analytics) is documented with verbatim Joi request schemas and
source-derived response shapes. Auth model is fully characterized — long-lived
opaque user tokens, `Authorization: Bearer <token>`, 401-with-empty-body on
failure, re-auth via `POST /users/password-authenticate` when a 401 is seen.

One caveat: programmatic **screen** creation is operationally heavy (requires
base64 PNG + full HTML + S3 credentials + server-side file write). The
existing broken MCP tool `livedemo_apply_coretap_template` cannot create
demos from thin air as currently scoped — the rewrite should be scoped to
operate on stories that already have screens (recorded via the Chrome
extension or the in-app recorder), OR clone an existing template story's
screens. This is a product decision, not a blocker for the API rewrite itself.

## Top unknowns remaining

1. **`screens` collection live `findOne()` is the #1 remaining risk.** Source
   gives us the Mongoose schema with high confidence, but no real document
   has been inspected this session. **Resolution:** Matty logs into
   https://demo.deltakinetics.io as `mcp@deltakinetics.io` (password in
   Infisical under `LIVEDEMO_MCP_PASSWORD`), records a 2-step demo of any
   public page, names it `discovery-probe-1`, publishes it. Then:
   ```
   railway service livedemo-backend
   railway redeploy --yes
   # wait ~20s for deploy
   until railway ssh "echo ok" 2>&1 | grep -q ok; do sleep 4; done
   railway ssh "node -e 'const {MongoClient}=require(\"mongodb\"); (async()=>{const c=new MongoClient(process.env.MONGO_URI); await c.connect(); console.log(JSON.stringify(await c.db().collection(\"screens\").findOne({}), null, 2)); await c.close()})()'"
   ```
   Append output to `docs/discovery-log.md` §Phase-4-followup. If any
   field in the live doc surprises the schema in `upstream-data-model.md`,
   fix the doc before the rewrite.

2. **Validator-error response body** was not captured live. Source says
   `validateBody` returns status **500** (not 400) with body
   `JSON.stringify({error, value, details})`. **Resolution:** send an
   intentionally bad `POST /emptyStory` (e.g. `{}`) with the token and
   capture the response. Expected ~1 minute of work once the backend is
   awake.

3. **All Mongo index lists** (especially `authtokens`, `users`, `workspaces`).
   **Resolution:** `railway ssh` → `node -e 'await db.collection("X").indexes()'`
   for each of interest. Not load-bearing for MCP correctness, but good
   hygiene.

4. **`POST /publish` → `publishedlivedemos` causation chain.** The data model
   has a `publishedlivedemos` collection with `{url, workspaceId, path,
   liveDemoId}`, but the code path that populates a row on publish was not
   traced. **Resolution:** publish the probe demo from (1), then
   `db.publishedlivedemos.findOne({storyId: ObjectId("<probeStoryId>")})`.
   MCP needs this to return the public demo URL to the caller.

5. **`POST /users/refreshToken`** was not exercised. If the rewrite's re-auth
   strategy needs a refresh path (rather than re-login-on-401), run that
   route once with a valid token and capture its shape.

## Critical findings

1. **`PRIVATE_AUTH_TOKEN` is dead code.** Declared once in `server.js:155`,
   referenced nowhere. The matching Infisical value (identical to
   `LIVEDEMO_API_TOKEN` until this session) is vestigial. Empirically verified:
   `PRIVATE_AUTH_TOKEN` as a Bearer returns 401. The MCP must use user-issued
   tokens only.

2. **The backend's notion of a "demo" is a Mongoose `Story`.** Every MCP tool
   that thinks it's manipulating `/api/demos/*` is operationally wrong —
   there's no `demos` collection and no `/api/*` prefix anywhere. The correct
   endpoint family is `/workspaces/:wsId/stories/*`. See `upstream-api.md`
   for the full, accurate route table.

3. **Steps are embedded inside screens, not a separate collection.** The
   route to add a step is
   `POST /workspaces/:wsId/stories/:sid/screens/:screenId/steps`. The created
   step has its own `_id` but lives in `screens.$.steps[]`. `patchStep` uses
   Mongo array-positional `steps.$.view.xxx` operators. This invalidates the
   existing MCP pattern of step-ids-as-top-level-documents.

4. **Validation errors return 500, access-denied returns 500, generic errors
   return 500.** Status-code-only error mapping will not work. The MCP must
   always read `response.data` and surface it. Only 401 is unambiguous.

5. **Railway sleep-when-idle on `livedemo-backend` is operationally brittle.**
   Internal-only services get no wake traffic, so every SSH session required
   a fresh `railway redeploy`. Strongly recommend disabling sleep on that
   service in the Railway dashboard before the rewrite begins. Also added
   `ENABLE_API=true` and `ENABLE_CONSUMER=true` to the service's env — these
   were missing/empty and the server technically shouldn't have started
   without them (investigate why it did earlier; possibly a Railway default
   or a leftover from a previous set).

6. **`MCP_AUTH_TOKEN` is still on `livedemo-mcp` but no longer enforced.**
   Remove it in a follow-up cleanup commit.

7. **No inbound auth on the MCP server.** By design (commit `0b06a5c`). The
   MCP SSE endpoint at `livedemo-mcp-production.up.railway.app/sse` is
   publicly callable — it's protected only by the LiveDemo token it holds
   internally. Confirm this is intended posture with Matty; if not, re-add
   a lightweight auth layer before next announce.

## Files produced

- `docs/auth-model.md` — token format, acquisition, validation, edge cases.
- `docs/upstream-api.md` — complete route table, critical route contracts.
- `docs/upstream-data-model.md` — Mongoose schemas, collection counts, indexes.
- `docs/discovery-log.md` — chronological command record with raw outputs.
- `docs/SUMMARY.md` — this file.
- `docs/_handlers-dump.txt` (2279 lines) — source dumps of the critical handlers, kept for reference during the rewrite.
- `docs/_models-dump.txt` (622 lines) — source dumps of every Mongoose model.
- `scripts/discover.sh`, `scripts/probe.sh` — container-side scripts prepared
  but not fully executed due to idle-sleep issues. Safe to delete or keep
  for the Phase-4 follow-up.

## What the rewrite should look like (not part of this session's scope, but stated for the hand-off)

- `mcp/src/lib/client.ts`:
  - Base URL: `process.env.LIVEDEMO_API_URL` with default
    `http://livedemo-backend.railway.internal:3005`.
  - Token: from `process.env.LIVEDEMO_API_TOKEN`, re-auth on 401 using
    `LIVEDEMO_MCP_EMAIL` (default `mcp@deltakinetics.io`) and
    `LIVEDEMO_MCP_PASSWORD`, retry once.
  - Surface `response.data` on every non-2xx.
- `mcp/src/tools/demos.ts`: rewrite all paths against
  `/workspaces/:wsId/stories/*` from `upstream-api.md`. Use
  `LIVEDEMO_WORKSPACE_ID` as the default workspace.
- `mcp/src/tools/steps.ts`: rewrite for screen-scoped paths. Every step
  operation takes `(storyId, screenId, stepId?)`.
- `mcp/src/tools/templates.ts`: redesign. Cannot create screens from thin
  air. Three viable strategies — pick one with Matty:
  - (a) Template operates on an already-recorded story: inject steps,
    popups, forms, and styling into existing screens.
  - (b) Template clones a reference story (e.g. a canonical
    `coretap-overview` story pre-recorded once) into a new story in the
    target workspace. Requires implementing a story-clone helper that
    creates new `screens`, new `stories`, and copies S3 asset URLs — no
    API exists for this, would need direct Mongo writes OR a new backend
    endpoint.
  - (c) Template only sets story-level `custom` branding + links + forms,
    leaves screen content alone.
- `mcp/src/tools/analytics.ts`: rewrite against `/workspaces/:wsId/sessions`
  and `/workspaces/:wsId/leads`. Expect the pagination envelope on sessions.
