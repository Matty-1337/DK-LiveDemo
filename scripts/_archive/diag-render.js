// Comprehensive render diagnostic. Captures:
//   - Every console message at every level (error/warn/log/info/debug)
//   - Every page error (uncaught exceptions)
//   - Every network request with status, content-type, failure reason
//   - Final DOM state (#app innerHTML, body children, computed visible text)
//   - Two screenshots: at 4s (early), at 18s (post-bootstrap)
//
// Outputs everything to <outDir>:
//   console.json     — every console event, ordered
//   network.json     — every request with response/failure metadata
//   pageerror.json   — uncaught JS errors
//   dom.json         — post-load DOM probe
//   render-early.png
//   render-late.png

const { chromium } = require('C:/AI-Workspaces/dk-livedemo/browser/node_modules/playwright');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const TARGET_URL = process.argv[2] || 'https://demo.deltakinetics.io/livedemos/69ec68ec3f18e64100767017';
const OUT_DIR = process.argv[3] || 'C:/AI-Workspaces/dk-livedemo/docs/_diag-v2-render';
mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const consoleEvents = [];
  page.on('console', (msg) => {
    consoleEvents.push({
      ts: Date.now(),
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    });
  });

  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push({
      ts: Date.now(),
      name: err.name,
      message: err.message,
      stack: (err.stack || '').slice(0, 1500),
    });
  });

  const networkEvents = [];
  const byUrl = new Map();
  page.on('request', (req) => {
    const e = {
      ts: Date.now(),
      url: req.url(),
      method: req.method(),
      type: req.resourceType(),
      status: null,
      contentType: null,
      contentLength: null,
      failed: null,
    };
    networkEvents.push(e);
    byUrl.set(req.url(), e);
  });
  page.on('response', (res) => {
    const e = byUrl.get(res.url());
    if (!e) return;
    e.status = res.status();
    const headers = res.headers();
    e.contentType = headers['content-type'] || null;
    e.contentLength = headers['content-length'] ? Number(headers['content-length']) : null;
  });
  page.on('requestfailed', (req) => {
    const e = byUrl.get(req.url());
    if (!e) return;
    e.failed = req.failure()?.errorText ?? 'unknown';
  });

  console.log(`→ ${TARGET_URL}`);
  const t0 = Date.now();
  const resp = await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((err) => {
    console.log('  goto error:', err.message);
    return null;
  });
  console.log(`  navigation status=${resp ? resp.status() : '?'}  url=${page.url()}  title="${await page.title()}"`);
  console.log(`  domcontent at t+${Date.now() - t0}ms`);

  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(OUT_DIR, 'render-early.png'), fullPage: false });
  console.log(`  early screenshot at t+${Date.now() - t0}ms`);

  await page.waitForTimeout(14000);
  await page.screenshot({ path: join(OUT_DIR, 'render-late.png'), fullPage: false });
  console.log(`  late screenshot at t+${Date.now() - t0}ms`);

  // DOM probe
  const dom = await page.evaluate(`(() => {
    var app = document.getElementById('app');
    return {
      url: location.href,
      title: document.title,
      bodyChildCount: document.body.children.length,
      bodyChildren: Array.from(document.body.children).map(function(c){
        return {
          tag: c.tagName.toLowerCase(),
          id: c.id || null,
          className: typeof c.className === 'string' ? c.className.slice(0, 80) : null,
          childElementCount: c.childElementCount,
          textPreview: (c.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 120),
        };
      }),
      appExists: !!app,
      appChildCount: app ? app.children.length : 0,
      appHTMLPreview: app ? app.innerHTML.slice(0, 1500) : null,
      iframes: Array.from(document.querySelectorAll('iframe')).map(function(f){
        return { src: f.src, w: f.width, h: f.height };
      }),
      visibleText: (document.body.innerText || '').slice(0, 1000),
      readyState: document.readyState,
      headLinks: Array.from(document.querySelectorAll('link')).map(function(l){
        return { rel: l.rel, href: l.href };
      }),
      headScripts: Array.from(document.querySelectorAll('script[src]')).map(function(s){
        return s.src;
      }),
    };
  })()`);

  await browser.close();

  writeFileSync(join(OUT_DIR, 'console.json'), JSON.stringify(consoleEvents, null, 2));
  writeFileSync(join(OUT_DIR, 'pageerror.json'), JSON.stringify(pageErrors, null, 2));
  writeFileSync(join(OUT_DIR, 'network.json'), JSON.stringify(networkEvents, null, 2));
  writeFileSync(join(OUT_DIR, 'dom.json'), JSON.stringify(dom, null, 2));

  // Summary on stdout
  console.log(`\n=== console events: ${consoleEvents.length} ===`);
  const byType = {};
  for (const e of consoleEvents) byType[e.type] = (byType[e.type] || 0) + 1;
  console.log('  by type:', JSON.stringify(byType));
  for (const e of consoleEvents) {
    if (e.type === 'error' || e.type === 'warning') {
      console.log(`  [${e.type}]`, e.text.slice(0, 220));
    }
  }

  console.log(`\n=== uncaught page errors: ${pageErrors.length} ===`);
  for (const e of pageErrors) console.log(`  [${e.name}] ${e.message.slice(0, 240)}`);

  console.log(`\n=== network: ${networkEvents.length} requests ===`);
  const failed = networkEvents.filter((e) => e.failed);
  const http4xx5xx = networkEvents.filter((e) => e.status && e.status >= 400);
  console.log(`  failed: ${failed.length}`);
  for (const e of failed) console.log(`    [${e.failed}] ${e.method} ${e.url}`);
  console.log(`  http >=400: ${http4xx5xx.length}`);
  for (const e of http4xx5xx) console.log(`    [HTTP ${e.status}] ${e.method} ${e.url}`);

  console.log(`\n=== DOM ===`);
  console.log(`  body children: ${dom.bodyChildCount}`);
  console.log(`  #app children: ${dom.appChildCount}`);
  console.log(`  visible text len: ${(dom.visibleText || '').length}`);
  console.log(`  iframes: ${dom.iframes.length}`);
  if (dom.bodyChildren) for (const c of dom.bodyChildren) console.log(`    body>`, JSON.stringify(c));

  console.log(`\nartifacts written to ${OUT_DIR}`);
})().catch((e) => {
  console.error('threw:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
