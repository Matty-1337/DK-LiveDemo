// Take a screenshot of a published livedemo to visually confirm the
// player rendered with branding + personalized popup. Runs locally —
// driver: Playwright (already installed in browser/node_modules).

const { chromium } = require('C:/AI-Workspaces/dk-livedemo/browser/node_modules/playwright');
const { writeFileSync } = require('node:fs');

const URL = process.argv[2] || 'https://demo.deltakinetics.io/livedemos/69ec68ec3f18e64100767017';
const OUT = process.argv[3] || '/c/AI-Workspaces/dk-livedemo/docs/_e2e-demo-render.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  console.log(`→ ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  // The LiveDemo player is async — inlined HTML state, then JS renders
  // the iframe + popup overlay over a few seconds. 12s is conservative.
  await page.waitForTimeout(12000);
  const buf = await page.screenshot({ fullPage: false });
  writeFileSync(OUT, buf);
  console.log(`  wrote ${OUT}  (${buf.length} bytes)`);

  // Check if "Smoke Test Bar" appears anywhere in the rendered DOM
  const hits = await page.evaluate(`(() => {
    var html = document.documentElement.outerHTML;
    return {
      bodyTextLen: (document.body.innerText || '').length,
      hasProspectName: html.indexOf('Smoke Test Bar') >= 0,
      hasWelcomeText: html.indexOf('Welcome') >= 0,
      hasDashboardWord: html.indexOf('Dashboard') >= 0,
      hasS3Image: html.indexOf('dk-livedemo-cdn') >= 0,
      h1Count: document.querySelectorAll('h1').length,
      imgCount: document.querySelectorAll('img').length,
    };
  })()`);
  console.log('  page checks:', JSON.stringify(hits, null, 2));

  await browser.close();
})().catch((e) => {
  console.error('threw:', e);
  process.exit(1);
});
