// One-shot DOM inspector for the CoreTAP login page. Lets us audit the
// real selectors before tightening browser/src/auth/coretap.ts.
//
// Usage (from browser/):
//   $env:CORETAP_LOGIN_URL = 'https://coretap.deltakinetics.io/login'
//   $env:CORETAP_DEMO_BOT_EMAIL = 'demo-bot@deltakinetics.io'
//   $env:CORETAP_DEMO_BOT_PASSWORD = '<from infisical>'
//   npx tsx src/scripts/inspect-coretap-login.ts
//
// Outputs: a JSON dump of every <input>, <button>, and <form> on the
// login page, plus a follow-up dump after a successful submit (URL,
// title, ready-marker selectors). Writes scripts/output/login-shot.png
// for visual inspection.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = process.env.CORETAP_LOGIN_URL || 'https://coretap.deltakinetics.io/login';
const EMAIL = process.env.CORETAP_DEMO_BOT_EMAIL || '';
const PWD = process.env.CORETAP_DEMO_BOT_PASSWORD || '';

if (!EMAIL || !PWD) {
  console.error('missing CORETAP_DEMO_BOT_EMAIL / CORETAP_DEMO_BOT_PASSWORD in env');
  process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'output');
mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  console.log(`→ goto ${URL}`);
  const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  console.log(`  status: ${resp?.status()}`);
  console.log(`  url:    ${page.url()}`);
  console.log(`  title:  ${await page.title()}`);

  await page.screenshot({ path: join(outDir, 'login-page.png'), fullPage: true });

  // Dump every input + button + form for selector planning.
  // NOTE: keep this evaluate() callback fully self-contained — no helper
  // functions, no closures over typed names — tsx adds a __name() runtime
  // helper that doesn't exist in the page context and crashes the eval.
  const dom = await page.evaluate(`(() => {
    function dump(el) {
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        name: el.name || null,
        type: el.type || null,
        placeholder: el.placeholder || null,
        autocomplete: el.getAttribute && el.getAttribute('autocomplete'),
        ariaLabel: el.getAttribute && el.getAttribute('aria-label'),
        dataTestId: el.getAttribute && el.getAttribute('data-testid'),
        text: (el.textContent || '').trim().slice(0, 80),
        className: typeof el.className === 'string' ? el.className : null,
      };
    }
    return {
      inputs: Array.from(document.querySelectorAll('input')).map(dump),
      buttons: Array.from(document.querySelectorAll('button, [role=button], input[type=submit]')).map(dump),
      forms: Array.from(document.querySelectorAll('form')).map(dump),
      anchors: Array.from(document.querySelectorAll('a'))
        .filter(function (a) { return /sign|login|forgot|password|register/i.test(a.textContent || ''); })
        .map(dump),
    };
  })()`) as { inputs: unknown[]; buttons: unknown[]; forms: unknown[]; anchors: unknown[] };
  writeFileSync(join(outDir, 'login-dom.json'), JSON.stringify(dom, null, 2));
  console.log(`  wrote ${join(outDir, 'login-dom.json')}`);
  console.log(`  inputs: ${dom.inputs.length}, buttons: ${dom.buttons.length}, forms: ${dom.forms.length}`);
  console.log(`  inputs detail:`);
  for (const i of dom.inputs) console.log(`    - ${JSON.stringify(i)}`);
  console.log(`  buttons detail:`);
  for (const b of dom.buttons) console.log(`    - ${JSON.stringify(b)}`);

  // Try the placeholder-style selector chain from auth/coretap.ts to see if it works
  const candidates = {
    email: ['input[name="email"]', 'input[type="email"]', '#email', '[data-testid="login-email"]', 'input[autocomplete="email"]', 'input[autocomplete="username"]'],
    password: ['input[name="password"]', 'input[type="password"]', '#password', '[data-testid="login-password"]', 'input[autocomplete="current-password"]'],
    submit: ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Sign in")', 'button:has-text("Login")', 'input[type="submit"]', '[data-testid="login-submit"]'],
  };
  const found: Record<string, string[]> = {};
  for (const [key, sels] of Object.entries(candidates)) {
    found[key] = [];
    for (const s of sels) {
      const n = await page.locator(s).count().catch(() => 0);
      if (n > 0) found[key].push(`${s} (${n} match)`);
    }
  }
  console.log(`  selector probe results:`);
  console.log(JSON.stringify(found, null, 2));

  // Attempt actual login
  console.log(`→ attempting login as ${EMAIL}`);
  const emailSel = found.email[0]?.split(' ')[0];
  const pwdSel = found.password[0]?.split(' ')[0];
  const submitSel = found.submit[0]?.split(' ')[0];
  if (!emailSel || !pwdSel || !submitSel) {
    console.error(`✗ missing selector — email=${emailSel} pwd=${pwdSel} submit=${submitSel}`);
    await browser.close();
    process.exit(1);
  }
  await page.fill(emailSel, EMAIL);
  await page.fill(pwdSel, PWD);
  await page.click(submitSel);

  // SPA logins commit the redirect via client-side router; networkidle
  // returns too early. Race three signals: URL change, error toast, or
  // a visible dashboard marker (anything we'd expect post-login).
  console.log(`→ awaiting login resolution (15s budget)`);
  const result = await Promise.race([
    page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/signin'), { timeout: 15000 }).then(() => 'redirected'),
    page.locator('text=/invalid|incorrect|wrong|denied|fail/i').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error-message-visible'),
    page.waitForTimeout(15000).then(() => 'timeout'),
  ]).catch((e) => `threw:${e instanceof Error ? e.message : String(e)}`);
  console.log(`  resolution: ${result}`);

  console.log(`→ post-login state`);
  console.log(`  url:    ${page.url()}`);
  console.log(`  title:  ${await page.title()}`);
  await page.screenshot({ path: join(outDir, 'post-login.png'), fullPage: true });

  // Capture any error/toast text on the page for diagnostics
  const errorTexts = await page.evaluate(`(() => {
    var nodes = Array.from(document.querySelectorAll('[role=alert], .error, .text-red-500, .text-red-600, [class*="error"]'));
    return nodes.map(function(n) { return (n.textContent || '').trim(); }).filter(Boolean).slice(0, 10);
  })()`) as string[];
  if (errorTexts.length) console.log(`  error texts on page: ${JSON.stringify(errorTexts)}`);

  // Sample the dashboard DOM for ready-marker selectors and any tenant-switch widget
  const post = await page.evaluate(`(() => {
    var dataTestIds = Array.from(document.querySelectorAll('[data-testid]'))
      .slice(0, 50)
      .map(function (el) { return el.getAttribute('data-testid'); });
    var headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .slice(0, 20)
      .map(function (el) { return (el.textContent || '').trim(); });
    var navItems = Array.from(document.querySelectorAll('nav a, [role=navigation] a'))
      .slice(0, 30)
      .map(function (a) { return { text: (a.textContent || '').trim(), href: a.getAttribute('href') }; });
    return { dataTestIds: dataTestIds, headings: headings, navItems: navItems };
  })()`) as { dataTestIds: (string | null)[]; headings: string[]; navItems: { text: string; href: string | null }[] };
  writeFileSync(join(outDir, 'post-login-dom.json'), JSON.stringify(post, null, 2));
  console.log(`  testids found: ${post.dataTestIds.filter(Boolean).length}`);
  console.log(`  first headings: ${post.headings.slice(0, 5).join(' | ')}`);
  console.log(`  first nav items: ${post.navItems.slice(0, 8).map((n) => n.text).join(' | ')}`);

  await browser.close();
  console.log('✓ inspection complete');
})().catch((e) => {
  console.error('threw:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
