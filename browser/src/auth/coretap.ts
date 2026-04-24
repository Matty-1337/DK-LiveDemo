// CoreTAP login flow.
//
// Gating: requires the following Infisical secrets (loaded by
// src/lib/infisical.ts):
//   - CORETAP_LOGIN_URL         e.g. https://app.htxtap.com/login
//   - CORETAP_DEMO_BOT_EMAIL    demo-bot@deltakinetics.io
//   - CORETAP_DEMO_BOT_PASSWORD (generated)
//   - CORETAP_DEMO_TENANT_ID    (optional; used for post-login tenant switch)
//
// The actual selectors below are placeholders aligned with common SaaS
// login patterns. They will need adjustment once Matty provides access
// to the demo tenant and we can inspect app.htxtap.com/login's DOM.

import type { BrowserContext, Page } from 'playwright';
import { requireSecret, getSecret } from '../lib/infisical.js';
import { log } from '../lib/logger.js';
import { AuthError } from './registry.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export async function coretapAuth(ctx: BrowserContext): Promise<Page> {
  const loginUrl = requireSecret('CORETAP_LOGIN_URL');
  const email = requireSecret('CORETAP_DEMO_BOT_EMAIL');
  const password = requireSecret('CORETAP_DEMO_BOT_PASSWORD');
  const tenantId = getSecret('CORETAP_DEMO_TENANT_ID');

  const page = await ctx.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

  log.info('coretap: navigating to login', { loginUrl: redactUrl(loginUrl) });
  await page.goto(loginUrl, { waitUntil: 'networkidle' });

  // Fill email — tries multiple common selectors; adjust after real DOM inspection.
  const emailField = await firstPresent(page, [
    'input[name="email"]',
    'input[type="email"]',
    '#email',
    '[data-testid="login-email"]',
  ]);
  if (!emailField) throw new AuthError('coretap: email input not found');
  await emailField.fill(email);

  const passwordField = await firstPresent(page, [
    'input[name="password"]',
    'input[type="password"]',
    '#password',
    '[data-testid="login-password"]',
  ]);
  if (!passwordField) throw new AuthError('coretap: password input not found');
  await passwordField.fill(password);

  const submitButton = await firstPresent(page, [
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Sign in")',
    '[data-testid="login-submit"]',
  ]);
  if (!submitButton) throw new AuthError('coretap: submit button not found');

  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }),
    submitButton.click(),
  ]);

  // Heuristic: if the URL path still contains /login after submit, assume
  // credentials were rejected. Real integration may require a better
  // signal (e.g. waiting for a /dashboard URL or a data-testid).
  const postUrl = new URL(page.url());
  if (postUrl.pathname.includes('/login') || postUrl.pathname.includes('/signin')) {
    const bodyText = await page.textContent('body').catch(() => null);
    throw new AuthError(
      `coretap: still on login page after submit (url=${postUrl.pathname}); ` +
        `body excerpt="${(bodyText ?? '').slice(0, 200)}"`,
    );
  }

  // Optional tenant switch — if the product surfaces a tenant picker and
  // we know which tenant we want, navigate or click through to it here.
  if (tenantId) {
    // Placeholder — actual tenant-switch URL/flow TBD post-provisioning.
    log.info('coretap: tenant switch pending DOM inspection', { tenantId: '<set>' });
  }

  log.info('coretap: authenticated', { landingPath: postUrl.pathname });
  return page;
}

async function firstPresent(page: Page, selectors: string[]) {
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
