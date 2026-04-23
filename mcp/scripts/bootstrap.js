#!/usr/bin/env node
/**
 * DK-LiveDemo MCP bootstrap
 *
 * 1. Create MCP bot user            (idempotent — survives re-runs)
 * 2. Authenticate                   (POST /users/password-authenticate)
 * 3. Create workspace               (POST /workspaces, Bearer auth)
 * 4. Print Railway + Infisical persistence commands
 *
 * Drop this at: mcp/scripts/bootstrap.js
 *
 * Run from your machine:
 *   railway run --service livedemo-mcp -- node mcp/scripts/bootstrap.js
 *
 * Required env (resolved from Infisical via `railway run`):
 *   LIVEDEMO_API_URL          http://livedemo-backend.railway.internal:3005
 *   LIVEDEMO_MCP_PASSWORD     strong password (must be in Infisical first)
 *
 * Optional:
 *   LIVEDEMO_MCP_EMAIL        defaults to mcp@deltakinetics.io
 *   LIVEDEMO_WORKSPACE_NAME   defaults to "DK CoreTAP Demos"
 */

const axios = require("axios");

const API   = process.env.LIVEDEMO_API_URL       || "http://livedemo-backend.railway.internal:3005";
const EMAIL = process.env.LIVEDEMO_MCP_EMAIL     || "mcp@deltakinetics.io";
const PWD   = process.env.LIVEDEMO_MCP_PASSWORD;
const WS    = process.env.LIVEDEMO_WORKSPACE_NAME || "DK CoreTAP Demos";

if (!PWD) {
  console.error("✗ LIVEDEMO_MCP_PASSWORD is not set in this environment.");
  console.error("  Add it to Infisical (prod env) first, then re-run via `railway run`.");
  process.exit(1);
}

const http = axios.create({
  baseURL: API,
  timeout: 15_000,
  validateStatus: () => true, // we'll inspect every status ourselves
});

const dump = (label, data) =>
  console.log(`\n── ${label} ──\n${JSON.stringify(data, null, 2)}`);

(async () => {
  console.log(`API:   ${API}`);
  console.log(`User:  ${EMAIL}`);
  console.log(`WS:    ${WS}\n`);

  // ─── 1. Signup (idempotent) ───────────────────────────────────────────
  console.log(`→ POST /users  (signup)`);
  const signup = await http.post("/users", {
    email: EMAIL,
    password: PWD,
    name: "DK MCP Bot",
  });

  if (signup.status >= 200 && signup.status < 300) {
    dump(`user created (${signup.status})`, signup.data);
  } else if (signup.status === 409 || /exist|duplicate/i.test(JSON.stringify(signup.data || ""))) {
    console.log(`✓ user already exists (${signup.status}) — continuing\n`);
  } else {
    dump(`✗ signup failed (${signup.status})`, signup.data);
    process.exit(1);
  }

  // ─── 2. Authenticate ──────────────────────────────────────────────────
  console.log(`→ POST /users/password-authenticate`);
  const auth = await http.post("/users/password-authenticate", {
    email: EMAIL,
    password: PWD,
  });

  if (auth.status >= 300) {
    dump(`✗ auth failed (${auth.status})`, auth.data);
    process.exit(1);
  }
  dump(`auth response (${auth.status})`, auth.data);

  // upstream may return token under several plausible field names
  const token =
    auth.data?.token ||
    auth.data?.authToken ||
    auth.data?.bearer ||
    auth.data?.accessToken ||
    auth.data?.access_token;

  if (!token) {
    console.error(`\n✗ Could not find a token field in the auth response.`);
    console.error(`  Inspect the JSON above and edit bootstrap.js to read the right field.`);
    process.exit(1);
  }
  console.log(`✓ token acquired  (length ${token.length})\n`);

  // ─── 3. Create workspace ──────────────────────────────────────────────
  console.log(`→ POST /workspaces`);
  const ws = await http.post(
    "/workspaces",
    { name: WS },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (ws.status >= 300) {
    dump(`✗ workspace create failed (${ws.status})`, ws.data);
    process.exit(1);
  }
  dump(`workspace created (${ws.status})`, ws.data);

  const wsId =
    ws.data?._id ||
    ws.data?.id ||
    ws.data?.workspaceId ||
    ws.data?.workspace?._id;

  if (!wsId) {
    console.error(`\n✗ Could not find a workspace id field. Inspect JSON above.`);
    process.exit(1);
  }

  // ─── 4. Persistence commands ──────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`✓ Bootstrap complete.`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  console.log(`# 1. Set on livedemo-mcp Railway service:`);
  console.log(`railway variables --service livedemo-mcp \\`);
  console.log(`  --set LIVEDEMO_API_TOKEN="${token}" \\`);
  console.log(`  --set LIVEDEMO_WORKSPACE_ID="${wsId}"\n`);

  console.log(`# 2. Mirror into Infisical (canonical store):`);
  const inf =
    `--projectId 9df34929-a28d-4dc2-99a5-06f55da7d963 --env prod ` +
    `--domain infisicalinfisicallatest-postgres-production-d8ab.up.railway.app`;
  console.log(`infisical secrets set LIVEDEMO_API_TOKEN="${token}" ${inf}`);
  console.log(`infisical secrets set LIVEDEMO_WORKSPACE_ID="${wsId}" ${inf}\n`);
})().catch((e) => {
  console.error("Unhandled error:", e.message);
  process.exit(1);
});
