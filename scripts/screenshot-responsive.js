// Screenshot the DK player at every breakpoint we care about.
// Usage:
//   node screenshot-responsive.js [base-url] [storyId] [out-dir]
// Default: hits the local Vite dev server (5173) which proxies /api to prod.
const { chromium } = require('C:/AI-Workspaces/dk-livedemo/browser/node_modules/playwright');
const { writeFileSync } = require('node:fs');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const STORY = process.argv[3] || '69ec68ec3f18e64100767017';
const OUT = (process.argv[4] || 'C:/AI-Workspaces/dk-livedemo/docs/_player-responsive').replace(/\\/g, '/');

// (label, width, height, isMobileUA)
const SIZES = [
  ['1920',     1920, 1080, false],
  ['1440',     1440, 900,  false],
  ['1024',     1024, 768,  false],
  ['768',      768,  1024, false],
  ['414',      414,  896,  true],
  ['390',      390,  844,  true],
  ['360',      360,  780,  true],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [label, w, h, mobile] of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      isMobile: mobile,
      hasTouch: mobile,
      userAgent: mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    const page = await ctx.newPage();
    const url = `${BASE}/livedemos/${STORY}`;
    console.log(`→ ${label}px : ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    // Allow popup entrance + Ken-Burns to settle.
    await page.waitForTimeout(2500);
    const out = `${OUT}/${label}.png`;
    await page.screenshot({ path: out, fullPage: false });
    console.log(`  wrote ${out}`);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
