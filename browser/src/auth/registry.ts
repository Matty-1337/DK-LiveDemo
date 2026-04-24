// Maps a product id (from config/products.json) to its Playwright
// auth function. Register new products here.

import type { BrowserContext, Page } from 'playwright';

export interface AuthOptions {
  /** Called with a fresh BrowserContext. Must leave the context authenticated
   *  and return the Page left pointing at a post-login URL. */
  productId: string;
}

export type AuthFn = (ctx: BrowserContext) => Promise<Page>;

const registry = new Map<string, AuthFn>();

export function registerAuth(productId: string, fn: AuthFn): void {
  registry.set(productId, fn);
}

export function getAuthFn(productId: string): AuthFn {
  const fn = registry.get(productId);
  if (!fn) throw new AuthError(`No auth function registered for productId=${productId}`);
  return fn;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Register known auth functions. Imports at the bottom so the functions can
// reference AuthError above.
import { coretapAuth } from './coretap.js';
registerAuth('coretap', coretapAuth);

// Smoke-test auth: no-op "login" that just opens a new page. Used by
// src/scripts/smoke-test.ts to validate the capture flow against a public
// URL (e.g. example.com) without needing product credentials.
registerAuth('stub-public', async (ctx) => {
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  return page;
});

// AtlasTAP is pending — see config/products.json and docs/products-catalog.md.
// Register its auth fn here once the bot account exists.
