// CoreTAP login flow.
//
// DOM inspected against https://coretap.deltakinetics.io/login on
// 2026-04-25 via browser/src/scripts/inspect-coretap-login.ts. The
// selectors below are the empirically-confirmed primary chains; the
// fallbacks accommodate future markup churn.
//
// Login is a React SPA — `networkidle` returns before the client-side
// route transition completes. We wait for the URL path to leave
// /login before considering auth done. Post-login lands on /dashboard;
// the demo-bot's tenant scope (Keval's "The Miami Beach Club", numeric
// id 8) is enforced server-side, so no client-side tenant switch is
// needed. CORETAP_DEMO_TENANT_ID is recorded for documentation only.
//
// Required Infisical secrets (loaded via src/lib/infisical.ts):
//   - CORETAP_LOGIN_URL         https://coretap.deltakinetics.io/login
//   - CORETAP_DEMO_BOT_EMAIL    demo-bot@deltakinetics.io
//   - CORETAP_DEMO_BOT_PASSWORD <32 hex chars, in Infisical>

import type { BrowserContext, Locator, Page } from 'playwright';
import { requireSecret, getSecret } from '../lib/infisical.js';
import { log } from '../lib/logger.js';
import { AuthError } from './registry.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const POST_SUBMIT_BUDGET_MS = 20_000;

export async function coretapAuth(ctx: BrowserContext): Promise<Page> {
  const loginUrl = requireSecret('CORETAP_LOGIN_URL');
  const email = requireSecret('CORETAP_DEMO_BOT_EMAIL');
  const password = requireSecret('CORETAP_DEMO_BOT_PASSWORD');
  const tenantId = getSecret('CORETAP_DEMO_TENANT_ID');

  const page = await ctx.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

  log.info('coretap: navigating to login', { loginUrl: redactUrl(loginUrl) });
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  const emailField = await firstPresent(page, [
    'input[type="email"]',           // primary — confirmed 2026-04-25
    '#email',                         // primary — confirmed 2026-04-25
    'input[autocomplete="email"]',    // primary — confirmed 2026-04-25
    'input[autocomplete="username"]',
    'input[name="email"]',
    '[data-testid="login-email"]',
  ]);
  if (!emailField) throw new AuthError('coretap: email input not found');
  await emailField.fill(email);

  const passwordField = await firstPresent(page, [
    'input[type="password"]',                    // primary — confirmed 2026-04-25
    '#password',                                  // primary — confirmed 2026-04-25
    'input[autocomplete="current-password"]',    // primary — confirmed 2026-04-25
    'input[name="password"]',
    '[data-testid="login-password"]',
  ]);
  if (!passwordField) throw new AuthError('coretap: password input not found');
  await passwordField.fill(password);

  const submitButton = await firstPresent(page, [
    'button[type="submit"]',          // primary — confirmed 2026-04-25
    'button:has-text("Sign in")',     // primary — confirmed 2026-04-25
    'button:has-text("Log in")',
    'button:has-text("Login")',
    'input[type="submit"]',
    '[data-testid="login-submit"]',
  ]);
  if (!submitButton) throw new AuthError('coretap: submit button not found');

  await submitButton.click();

  // Wait for the SPA route transition off /login. If we hit the timeout
  // budget without a redirect, capture in-page error text for the error
  // message and throw — that's almost always wrong creds or rate limit.
  try {
    await page.waitForURL(
      (url) => !url.pathname.includes('/login') && !url.pathname.includes('/signin'),
      { timeout: POST_SUBMIT_BUDGET_MS },
    );
  } catch {
    const errorTexts = (await page.evaluate(`(() => {
      var nodes = Array.from(document.querySelectorAll('[role=alert], .error, .text-red-500, .text-red-600, [class*="error"]'));
      return nodes.map(function(n){return (n.textContent||'').trim();}).filter(Boolean).slice(0, 5);
    })()`)) as string[];
    throw new AuthError(
      `coretap: login did not redirect within ${POST_SUBMIT_BUDGET_MS}ms; ` +
        `errors_visible=${JSON.stringify(errorTexts)} url=${page.url()}`,
    );
  }

  const landingPath = new URL(page.url()).pathname;
  log.info('coretap: authenticated', {
    landingPath,
    tenantConfigured: tenantId ? '[set]' : '[unset]',
  });

  // Wait for the dashboard's loading skeleton to clear — captures taken
  // immediately after redirect catch the skeleton state. Inspected
  // 2026-04-25: the page renders "Loading..." text inside h2 while data
  // streams in.
  await page
    .waitForFunction(
      `!Array.from(document.querySelectorAll('h2, [class*="skeleton"]')).some(function(n){return /loading/i.test((n.textContent||'').trim());})`,
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => undefined);

  return page;
}

async function firstPresent(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const sel of selectors) {
    const loc = page.locator(sel);
    if ((await loc.count().catch(() => 0)) > 0) return loc.first();
  }
  return null;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}
