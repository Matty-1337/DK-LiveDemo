// Diagnose why the demo player isn't rendering. Logs every console
// message + every failed network request during page load.

const { chromium } = require('C:/AI-Workspaces/dk-livedemo/browser/node_modules/playwright');

const URL = process.argv[2] || 'https://demo.deltakinetics.io/livedemos/69ec68ec3f18e64100767017';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[console.${msg.type()}]`, msg.text().slice(0, 200));
    }
  });
  page.on('pageerror', (err) => {
    console.log('[pageerror]', err.message.slice(0, 300));
  });
  page.on('requestfailed', (req) => {
    console.log('[reqfailed]', req.url(), '-', req.failure()?.errorText);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log(`[http ${res.status()}]`, res.url().slice(0, 120));
    }
  });

  console.log(`→ goto ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => console.log('goto:', e.message));
  console.log('  url after load:', page.url());
  console.log('  title:', await page.title());
  await page.waitForTimeout(8000);

  // Look at #app's children to see if anything mounted
  const dom = await page.evaluate(`(() => {
    var app = document.getElementById('app');
    return {
      appHTML: app ? app.innerHTML.slice(0, 500) : '(no #app)',
      appChildCount: app ? app.children.length : 0,
      bodyChildCount: document.body.children.length,
      bodyChildren: Array.from(document.body.children).map(function (c) { return c.tagName + (c.id ? '#'+c.id : '') + (c.className ? '.'+(typeof c.className==='string'?c.className.slice(0,40):'?') : ''); }),
    };
  })()`);
  console.log('post-load DOM state:');
  console.log(JSON.stringify(dom, null, 2));

  await browser.close();
})().catch((e) => { console.error('threw:', e); process.exit(1); });
