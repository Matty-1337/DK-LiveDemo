// End-to-end smoke test for Strategy C — coretap/overview module.
//
// Runs INSIDE livedemo-browser container (has internal DNS to
// livedemo-backend.railway.internal:3005 + Infisical-loaded secrets in
// process.env). Self-contained: inlines the overview narrative so we
// don't have to ship config/products.json into the browser image.
//
// Pipeline:
//   1. Browser captures CoreTAP via local /capture (real Playwright)
//   2. Auth to backend with bot creds
//   3. POST /emptyStory
//   4. For each captured screen: POST /screens, then PATCH the
//      auto-seeded steps[0] with the personalized popup
//   5. POST /publish
//   6. POST /links
//   7. Print public URL
//
// Stream output to stdout as we go so we can watch progress live.

const http = require('node:http');

// Secrets are loaded from Infisical at script start (not process.env)
// because the browser service caches them in-memory only. This script
// fetches what it needs via the SDK using the universal-auth client
// credentials that ARE in process.env.
let BACKEND, BROWSER, WS, EMAIL, PWD;

const PROSPECT = {
  name: process.env.E2E_PROSPECT_NAME || 'Smoke Test Bar',
  location: process.env.E2E_PROSPECT_LOCATION || 'Dallas, TX',
  context: process.env.E2E_PROSPECT_CONTEXT || 'Sports bar, 80 seats, weekend-heavy',
};

// Inlined narrative (subset of config/products.json coretap.overview)
const MODULE = {
  name: 'CoreTAP Overview',
  baseUrl: 'https://coretap.deltakinetics.io',
  navigationPlan: [
    { path: '/dashboard',  waitFor: 'networkidle', note: 'KPI overview' },
    { path: '/pulse-live', waitFor: 'networkidle', note: 'Pulse Live' },
    { path: '/team',       waitFor: 'networkidle', note: 'Staff perf grid' },
    { path: '/actions',    waitFor: 'networkidle', note: 'Action items' },
    { path: '/menu',       waitFor: 'networkidle', note: 'Menu health' },
    { path: '/dashboard',  waitFor: 'networkidle', note: 'Closing CTA' },
  ],
  narrative: [
    { screenIndex: 0, popup: { title: 'Welcome to {{prospectName}}\'s CoreTAP Dashboard',
        body: '<p>This is the command center for <strong>{{prospectName}}</strong>. Everything you need to know about your bar\'s health is on this single screen.</p>' } },
    { screenIndex: 1, popup: { title: 'Pulse Live — Revenue Without the Lag',
        body: '<p>This is what\'s happening at <strong>{{prospectName}}</strong> right now — every order, every void, every drink poured, updated as it happens.</p>' } },
    { screenIndex: 2, popup: { title: 'Staff Performance — A Through D, Every Shift',
        body: '<p>Every bartender, every server, every shift — graded automatically on revenue, void rate, ticket size. No more gut-feel performance reviews.</p>' } },
    { screenIndex: 3, popup: { title: 'Actions — What to Do, Not Just What\'s Wrong',
        body: '<p>CoreTAP doesn\'t just surface problems at <strong>{{prospectName}}</strong> — it tells you the next move. Daily action items, prioritized.</p>' } },
    { screenIndex: 4, popup: { title: 'Menu Health — Where Margin Hides',
        body: '<p>Pour costs, item performance, contribution margin per drink. The bar\'s most-profitable items vs the duds, ranked.</p>' } },
    { screenIndex: 5, popup: { title: 'See What CoreTAP Finds in {{prospectName}}',
        body: '<p>We\'d expect to find $2,000+/month in recoverable revenue at <strong>{{prospectName}}</strong> in the first 30 days. Book a 20-minute walkthrough.</p>',
        cta: { text: 'Book My Free Audit', url: 'https://cal.com/matty-dk' } } },
  ],
};

// ---------- helpers ----------

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderTpl(tpl, p) {
  const v = {
    prospectName: escapeHtml(p.name),
    prospectLocation: escapeHtml(p.location || ''),
    prospectContext: escapeHtml(p.context || ''),
  };
  return String(tpl).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in v ? v[k] : m));
}

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : null;
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({
      host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: opts.method || 'GET',
      headers, timeout: opts.timeout || 120_000,
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        let parsed;
        try { parsed = d ? JSON.parse(d) : null; } catch { parsed = d; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (data) r.write(data);
    r.end();
  });
}

const t0 = Date.now();
const phase = (label) => console.log(`\n[${Math.round((Date.now()-t0)/1000)}s] ${label}`);

// ---------- pipeline ----------

async function loadSecretsFromInfisical() {
  const sdk = require('@infisical/sdk');
  const cid = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID;
  const csc = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;
  const env = process.env.INFISICAL_ENV || 'prod';
  const apiUrl = process.env.INFISICAL_API_URL;
  if (!cid || !csc || !projectId || !apiUrl) {
    throw new Error('missing INFISICAL_UNIVERSAL_AUTH_CLIENT_ID/SECRET, INFISICAL_PROJECT_ID, or INFISICAL_API_URL');
  }
  const client = new sdk.InfisicalSDK({ siteUrl: apiUrl });
  await client.auth().universalAuth.login({ clientId: cid, clientSecret: csc });
  const list = await client.secrets().listSecrets({ projectId, environment: env });
  const map = {};
  for (const s of list.secrets || []) map[s.secretKey] = s.secretValue;
  return map;
}

(async () => {
  console.log('loading secrets from Infisical...');
  const secrets = await loadSecretsFromInfisical();
  BACKEND = secrets.LIVEDEMO_API_URL || 'http://livedemo-backend.railway.internal:3005';
  BROWSER = secrets.LIVEDEMO_BROWSER_URL || 'http://livedemo-browser.railway.internal:3200';
  WS = secrets.LIVEDEMO_WORKSPACE_ID || '69ea79a8d7a9e7a66f4a784c';
  EMAIL = secrets.LIVEDEMO_MCP_EMAIL || 'mcp@deltakinetics.io';
  PWD = secrets.LIVEDEMO_MCP_PASSWORD;
  if (!PWD) throw new Error('LIVEDEMO_MCP_PASSWORD missing from Infisical fetch');
  console.log(`  BACKEND=${BACKEND}\n  BROWSER=${BROWSER}\n  WS=${WS}\n  EMAIL=${EMAIL}\n  PWD=[${PWD.length} chars]`);

  phase('1/7  capture screens via livedemo-browser');
  const cap = await req(`${BROWSER}/capture`, {
    method: 'POST', timeout: 180_000,
    body: { product: 'coretap', module: 'overview', baseUrl: MODULE.baseUrl, navigationPlan: MODULE.navigationPlan, timeoutSeconds: 120 },
  });
  if (cap.status !== 200 || !cap.body?.ok) {
    console.error('  capture failed:', cap.status, JSON.stringify(cap.body)?.slice(0, 400));
    process.exit(1);
  }
  console.log(`  ✓ ${cap.body.screens.length} screens captured (auth=${cap.body.timings.authMs}ms total=${cap.body.timings.totalMs}ms)`);
  for (let i = 0; i < cap.body.screens.length; i++) {
    const s = cap.body.screens[i];
    console.log(`    [${i}] ${s.source.path}  title="${s.pageTitle}"  ${s.width}x${s.height}  png=${Math.round(s.pngBase64.length*0.75/1024)}KB  html=${Math.round(s.html.length/1024)}KB`);
  }

  phase('2/7  authenticate to backend');
  const auth = await req(`${BACKEND}/users/password-authenticate`, {
    method: 'POST', body: { email: EMAIL, password: PWD },
  });
  if (auth.status !== 200 || !auth.body?.token) throw new Error(`auth failed status=${auth.status}`);
  const TOKEN = auth.body.token;
  const authH = { Authorization: 'Bearer ' + TOKEN };
  console.log(`  ✓ token acquired (preview ${TOKEN.slice(0,8)}…${TOKEN.slice(-6)})`);

  phase('3/7  POST /emptyStory');
  const storyName = `CoreTAP Overview — ${PROSPECT.name}`.slice(0, 200);
  const es = await req(`${BACKEND}/emptyStory`, {
    method: 'POST', headers: authH,
    body: {
      name: storyName,
      workspaceId: WS,
      windowMeasures: { innerWidth: cap.body.screens[0].width, innerHeight: cap.body.screens[0].height },
      aspectRatio: cap.body.screens[0].width / cap.body.screens[0].height,
    },
  });
  if (es.status !== 200) throw new Error(`emptyStory failed ${es.status}: ${JSON.stringify(es.body).slice(0,200)}`);
  const STORY_ID = es.body._id;
  console.log(`  ✓ story ${STORY_ID}`);

  phase('4/7  upload screens + patch seeded steps');
  const screens = [];
  for (let i = 0; i < cap.body.screens.length; i++) {
    const s = cap.body.screens[i];
    const cs = await req(`${BACKEND}/workspaces/${WS}/stories/${STORY_ID}/screens`, {
      method: 'POST', headers: authH,
      body: {
        name: (s.pageTitle || `screen-${i + 1}`).slice(0, 120),
        content: s.html,
        imageData: s.pngBase64,
        width: s.width,
        height: s.height,
      },
      timeout: 90_000,
    });
    if (cs.status !== 200) {
      console.error(`  screen[${i}] upload failed ${cs.status}:`, JSON.stringify(cs.body).slice(0, 400));
      process.exit(1);
    }
    const screenId = cs.body._id;
    const seededStepId = cs.body.steps?.[0]?._id;
    screens.push({ screenId, seededStepId, imageUrl: cs.body.imageUrl });
    console.log(`  ✓ screen[${i}] ${screenId}  seededStep=${seededStepId}  imageUrl=${cs.body.imageUrl?.slice(0,80)}…`);

    // Patch the seeded step with the personalized popup, if narrative entry exists
    const narr = MODULE.narrative.find((n) => n.screenIndex === i);
    if (narr && seededStepId) {
      const title = renderTpl(narr.popup.title, PROSPECT);
      const description = renderTpl(narr.popup.body, PROSPECT);
      const cta = narr.popup.cta;
      const buttons = cta
        ? [{ index: 0, text: renderTpl(cta.text, PROSPECT), gotoType: 'website', gotoWebsite: cta.url, textColor: '#FFFFFF', backgroundColor: '#0A1420' }]
        : (i + 1 < cap.body.screens.length ? [{ index: 0, text: 'Next', gotoType: 'next' }] : []);
      const ps = await req(`${BACKEND}/workspaces/${WS}/stories/${STORY_ID}/screens/${screenId}/steps/${seededStepId}`, {
        method: 'PATCH', headers: authH,
        body: {
          view: {
            viewType: 'popup',
            popup: { type: 'popup', showOverlay: true, title, description, alignment: 'center', buttons },
          },
        },
      });
      if (ps.status !== 200) console.warn(`    ⚠ patchStep[${i}] non-200: ${ps.status}`);
      else console.log(`    ✓ popup: "${title.slice(0, 60)}…"`);
    }
  }

  phase('5/7  POST /publish');
  const pub = await req(`${BACKEND}/workspaces/${WS}/stories/${STORY_ID}/publish`, {
    method: 'POST', headers: authH, body: { isPublished: true },
  });
  if (pub.status !== 200) throw new Error(`publish failed ${pub.status}`);
  console.log(`  ✓ isPublished=true`);

  phase('6/7  POST /links');
  const link = await req(`${BACKEND}/workspaces/${WS}/stories/${STORY_ID}/links`, {
    method: 'POST', headers: authH, body: { name: PROSPECT.name },
  });
  console.log(`  ✓ link _id=${link.body?._id}`);

  phase('7/7  smoke-check public URL');
  const publicHost = process.env.LIVEDEMO_PUBLIC_HOST || 'https://demo.deltakinetics.io';
  const publicUrl = `${publicHost}/livedemos/${STORY_ID}`;
  const https = require('node:https');
  const ok = await new Promise((r) => {
    https.get(publicUrl, { timeout: 10_000 }, (res) => r({ status: res.statusCode })).on('error', () => r({ status: 0 })).on('timeout', () => r({ status: 0 }));
  });
  console.log(`  ${ok.status === 200 ? '✓' : '✗'} ${publicUrl} -> ${ok.status}`);

  console.log(`\n=== RESULT ===`);
  console.log(`storyId:   ${STORY_ID}`);
  console.log(`publicUrl: ${publicUrl}`);
  console.log(`shareUrl:  ${publicHost}/l/${link.body?._id}`);
  console.log(`screens:   ${screens.length}`);
  console.log(`elapsed:   ${Math.round((Date.now()-t0)/1000)}s`);
  console.log(ok.status === 200 ? '\n✓ E2E PASS' : '\n⚠ pipeline OK but public URL not 200 — check proxy/frontend');
  process.exit(ok.status === 200 ? 0 : 2);
})().catch((e) => {
  console.error('threw:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
