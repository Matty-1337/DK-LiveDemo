// Mobile-render screenshot of the new DK player. iPhone 14 Pro viewport.
const { chromium, devices } = require('C:/AI-Workspaces/dk-livedemo/browser/node_modules/playwright');
const { writeFileSync } = require('node:fs');

const URL = process.argv[2] || 'https://demo.deltakinetics.io/livedemos/69ec68ec3f18e64100767017';
const OUT = process.argv[3] || '/c/AI-Workspaces/dk-livedemo/docs/_player-v3-mobile.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 14 Pro'] });
  const page = await context.newPage();
  console.log(`→ ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);
  const buf = await page.screenshot({ fullPage: false });
  writeFileSync(OUT, buf);
  console.log(`  wrote ${OUT}  (${buf.length} bytes)`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
