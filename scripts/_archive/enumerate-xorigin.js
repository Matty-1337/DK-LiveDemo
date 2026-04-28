// Enumerate every cross-origin request the LiveDemo player makes when
// rendering a published demo. We need this to scope the upcoming
// "self-host external assets" patch.
//
// Outputs categorized JSON: by host, by content-type, by status,
// flagging blocked-by-ORB and failed loads separately.

const { chromium } = require('C:/AI-Workspaces/dk-livedemo/browser/node_modules/playwright');

const TARGET_URL = process.argv[2] || 'https://demo.deltakinetics.io/livedemos/69ec68ec3f18e64100767017';
const SAME_ORIGIN_HOST = 'demo.deltakinetics.io';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  /** @type {Array<{url:string, host:string, method:string, type:string, status:number|null, failed:string|null, contentType:string|null, size:number|null}>} */
  const reqs = [];
  const byUrl = new Map();

  page.on('request', (req) => {
    const u = new URL(req.url());
    const entry = {
      url: req.url(),
      host: u.hostname,
      method: req.method(),
      type: req.resourceType(),
      status: null,
      failed: null,
      contentType: null,
      size: null,
    };
    reqs.push(entry);
    byUrl.set(req.url(), entry);
  });
  page.on('response', (res) => {
    const e = byUrl.get(res.url());
    if (!e) return;
    e.status = res.status();
    e.contentType = res.headers()['content-type'] || null;
    const cl = res.headers()['content-length'];
    if (cl) e.size = Number(cl);
  });
  page.on('requestfailed', (req) => {
    const e = byUrl.get(req.url());
    if (!e) return;
    e.failed = req.failure()?.errorText ?? 'unknown';
  });

  console.log(`→ ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((err) =>
    console.log('goto:', err.message),
  );
  // Let async player bootstrap continue
  await page.waitForTimeout(15000);
  await browser.close();

  const xorigin = reqs.filter((r) => r.host !== SAME_ORIGIN_HOST);
  const sameorigin = reqs.filter((r) => r.host === SAME_ORIGIN_HOST);

  console.log(`\n=== TOTAL REQUESTS ===`);
  console.log(`  same-origin (${SAME_ORIGIN_HOST}): ${sameorigin.length}`);
  console.log(`  cross-origin: ${xorigin.length}`);

  // Group cross-origin by host
  const byHost = {};
  for (const r of xorigin) {
    byHost[r.host] = byHost[r.host] || [];
    byHost[r.host].push(r);
  }
  console.log(`\n=== CROSS-ORIGIN HOSTS ===`);
  for (const [host, rs] of Object.entries(byHost).sort((a, b) => b[1].length - a[1].length)) {
    const failed = rs.filter((r) => r.failed).length;
    const blocked = rs.filter((r) => /ORB|BLOCKED/i.test(r.failed || '')).length;
    console.log(`  ${host}  total=${rs.length}  failed=${failed}  ORB=${blocked}`);
  }

  console.log(`\n=== EVERY CROSS-ORIGIN URL (deduped) ===`);
  const seen = new Set();
  for (const r of xorigin) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    const tag = r.failed ? `FAIL(${r.failed})` : `${r.status ?? '?'}`;
    console.log(`  [${r.method} ${r.type} ${tag}] ${r.url}`);
  }

  console.log(`\n=== FAILED OR BLOCKED ===`);
  const broken = xorigin.filter((r) => r.failed || (r.status && r.status >= 400));
  for (const r of broken) {
    console.log(`  ${r.failed ?? `HTTP ${r.status}`}  ${r.url}`);
  }

  console.log(`\n=== HOSTS WE'D NEED TO SELF-HOST ===`);
  // Cross-origin + on hosts we don't control + needed-for-rendering
  // (CSS, JS, fonts; not third-party tracking like fullstory/recaptcha)
  const trackingHosts = new Set([
    'edge.fullstory.com', 'fullstory.com', 'rs.fullstory.com',
    'www.google.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com',
    'app.livedemo.ai',
  ]);
  const upstreamCdnHosts = new Set([
    'livedemo-cdn.s3.us-east-1.amazonaws.com',
    'livedemo-cdn.s3.amazonaws.com',
  ]);
  const candidates = xorigin.filter((r) =>
    upstreamCdnHosts.has(r.host) || r.host === 'app.livedemo.ai',
  );
  const candidateUrls = new Set(candidates.map((r) => r.url));
  for (const u of [...candidateUrls].sort()) {
    const r = byUrl.get(u);
    console.log(`  [${r.type}] ${u}  status=${r.status ?? r.failed}`);
  }
})().catch((e) => {
  console.error('threw:', e);
  process.exit(1);
});
