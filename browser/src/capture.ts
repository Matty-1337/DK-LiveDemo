// Core capture flow.
//
// Takes a capture request — product, module, navigationPlan — and
// returns { html, pngBase64, width, height, pageTitle, capturedAt }
// per screen. Does NOT create LiveDemo stories or screens — that's the
// MCP orchestrator's job. This service only renders pixels.
//
// Guarantees:
//   - One browser pool slot used per capture (not per screen)
//   - Context discarded after capture (isolates auth cookies)
//   - Hard timeout enforced via Promise.race
//   - hideSelectors (defaults + per-step) injected as CSS BEFORE screenshot

import type { Page } from 'playwright';
import { BrowserPool } from './pool.js';
import { getAuthFn } from './auth/registry.js';
import { log } from './lib/logger.js';

export interface NavStep {
  path: string;
  waitFor?: 'networkidle' | string;
  hideSelectors?: string[];
  note?: string;
}

export interface CaptureRequest {
  product: string;
  module: string;
  navigationPlan: NavStep[];
  /** Product base URL; each nav step's `path` is resolved against this. */
  baseUrl: string;
  /** Default hideSelectors merged with per-step ones. */
  defaultHideSelectors?: string[];
  /** Seconds. Server enforces an upper bound of 120s regardless. */
  timeoutSeconds?: number;
}

export interface CapturedScreen {
  html: string;
  pngBase64: string;
  width: number;
  height: number;
  pageTitle: string;
  capturedAt: string;
  source: { path: string; note?: string };
}

export interface CaptureResult {
  ok: true;
  product: string;
  module: string;
  screens: CapturedScreen[];
  timings: { authMs: number; perScreenMs: number[]; totalMs: number };
}

const HARD_TIMEOUT_MS = 120_000; // server-side cap per Strategy C §2

export async function runCapture(pool: BrowserPool, req: CaptureRequest): Promise<CaptureResult> {
  const start = Date.now();
  const soft = (req.timeoutSeconds ?? 90) * 1000;
  const deadline = Math.min(soft, HARD_TIMEOUT_MS);

  const capturePromise = pool.withContext(async (ctx) => {
    // ---- Auth ----
    const authStart = Date.now();
    const authFn = getAuthFn(req.product);
    const page = await authFn(ctx);
    const authMs = Date.now() - authStart;
    log.info('capture: auth complete', { product: req.product, authMs });

    // ---- Each navigation step ----
    const screens: CapturedScreen[] = [];
    const perScreenMs: number[] = [];
    const defaultHide = req.defaultHideSelectors ?? [];

    for (const step of req.navigationPlan) {
      const stepStart = Date.now();
      const url = joinUrl(req.baseUrl, step.path);
      log.info('capture: nav', { module: req.module, url, waitFor: step.waitFor ?? 'networkidle' });

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForReady(page, step.waitFor);

      const hideList = [...defaultHide, ...(step.hideSelectors ?? [])];
      if (hideList.length) await hideElements(page, hideList);

      const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
      const pngBuf = await page.screenshot({ fullPage: true, type: 'png' });
      const pngBase64 = pngBuf.toString('base64');
      const html = await page.content();
      const pageTitle = await page.title();

      screens.push({
        html,
        pngBase64,
        width: viewport.width,
        height: viewport.height,
        pageTitle,
        capturedAt: new Date().toISOString(),
        source: { path: step.path, note: step.note },
      });
      perScreenMs.push(Date.now() - stepStart);
    }

    return { screens, authMs, perScreenMs };
  });

  // Hard timeout wrapper
  const result = await Promise.race([
    capturePromise,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`capture: deadline ${deadline}ms exceeded`)), deadline),
    ),
  ]);

  return {
    ok: true,
    product: req.product,
    module: req.module,
    screens: result.screens,
    timings: {
      authMs: result.authMs,
      perScreenMs: result.perScreenMs,
      totalMs: Date.now() - start,
    },
  };
}

async function waitForReady(page: Page, waitFor?: 'networkidle' | string): Promise<void> {
  if (!waitFor || waitFor === 'networkidle') {
    await page.waitForLoadState('networkidle').catch(() => undefined);
    return;
  }
  // Assume a selector otherwise
  await page.waitForSelector(waitFor, { timeout: 15_000 }).catch(() => undefined);
}

async function hideElements(page: Page, selectors: string[]): Promise<void> {
  // One CSS injection for all — style tag appended to <head>.
  const css = selectors.map((s) => `${s} { visibility: hidden !important; }`).join('\n');
  await page.addStyleTag({ content: css }).catch(() => undefined);
}

function joinUrl(base: string, path: string): string {
  if (/^https?:/i.test(path)) return path;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanBase + cleanPath;
}
