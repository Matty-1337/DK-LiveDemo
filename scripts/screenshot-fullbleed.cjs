const path = require('node:path');
const { writeFileSync } = require('node:fs');
const { chromium } = require(path.join(__dirname, '..', 'browser', 'node_modules', 'playwright'));

const URL = process.argv[2] || 'https://demo.deltakinetics.io/livedemos/69ec68ec3f18e64100767017';
const OUT = process.argv[3] || path.join(__dirname, '..', 'docs', '_player-fullbleed-desktop.png');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
  console.log(`→ ${URL} @ 1920x1200`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(10000);
  const buf = await page.screenshot({ fullPage: false });
  writeFileSync(OUT, buf);
  console.log(`  wrote ${OUT} (${buf.length} bytes)`);

  const probe = await page.evaluate(`(() => {
    const canvas = document.querySelector('.dk-canvas');
    const bg = document.querySelector('.dk-canvas__bg');
    const player = document.querySelector('.dk-player');
    const popup = document.querySelector('.dk-popup__card');
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const cs = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return { padding: s.padding, maxWidth: s.maxWidth, borderRadius: s.borderRadius, boxShadow: s.boxShadow };
    };
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      player: { rect: r(player), style: cs(player) },
      canvas: { rect: r(canvas), style: cs(canvas) },
      bg: { rect: r(bg) },
      popup: { rect: r(popup) },
    };
  })()`);
  console.log(JSON.stringify(probe, null, 2));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
