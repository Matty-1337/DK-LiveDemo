// Browser pool lifecycle.
//
// Contract (Strategy C §2):
//   - Keep a warm pool of N headless Chromium browsers
//   - Round-robin allocation; blocks when all are busy
//   - Auto-replace on crash (browser.on('disconnected') → relaunch)
//   - ready() = true when pool is full
//
// Each "slot" is a Browser instance. Capture uses a fresh
// BrowserContext per capture (to isolate cookies / storage), then
// disposes the context. The Browser itself persists across captures.

import { Browser, BrowserContext, chromium } from 'playwright';
import { log } from './lib/logger.js';

export interface PoolOptions {
  targetSize: number;
  launchArgs?: string[];
}

interface Slot {
  id: number;
  browser: Browser | null;
  inUse: boolean;
  startedAt: number | null;
  crashes: number;
}

export class BrowserPool {
  private slots: Slot[];
  private targetSize: number;
  private launchArgs: string[];
  private waiters: Array<(slot: Slot) => void> = [];
  private stopped = false;

  constructor(opts: PoolOptions) {
    this.targetSize = opts.targetSize;
    this.launchArgs = opts.launchArgs ?? [
      '--disable-dev-shm-usage', // avoid /dev/shm size issues on Railway
      '--no-sandbox',            // pwuser already non-root; but some sandboxes still need this
    ];
    this.slots = Array.from({ length: this.targetSize }, (_, i) => ({
      id: i,
      browser: null,
      inUse: false,
      startedAt: null,
      crashes: 0,
    }));
  }

  async init(): Promise<void> {
    await Promise.all(this.slots.map((s) => this.launchSlot(s)));
    log.info('pool: initialized', { size: this.targetSize });
  }

  private async launchSlot(slot: Slot): Promise<void> {
    try {
      slot.browser = await chromium.launch({ headless: true, args: this.launchArgs });
      slot.startedAt = Date.now();
      slot.browser.on('disconnected', () => {
        log.warn('pool: browser disconnected, relaunching', { slot: slot.id, crashes: slot.crashes });
        slot.browser = null;
        slot.crashes += 1;
        if (!this.stopped) {
          void this.launchSlot(slot).catch((e) =>
            log.error('pool: relaunch failed', { slot: slot.id, error: e instanceof Error ? e.message : String(e) }),
          );
        }
      });
    } catch (err) {
      log.error('pool: launch failed', { slot: slot.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  ready(): boolean {
    return this.slots.every((s) => s.browser !== null);
  }

  status(): { poolSize: number; targetSize: number; inUse: number; crashes: number } {
    return {
      poolSize: this.slots.filter((s) => s.browser !== null).length,
      targetSize: this.targetSize,
      inUse: this.slots.filter((s) => s.inUse).length,
      crashes: this.slots.reduce((a, s) => a + s.crashes, 0),
    };
  }

  /** Acquire a slot. Resolves when one is free. Must be followed by release(). */
  async acquire(timeoutMs = 30_000): Promise<Slot> {
    const free = this.slots.find((s) => !s.inUse && s.browser !== null);
    if (free) {
      free.inUse = true;
      return free;
    }
    return new Promise<Slot>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(waiter);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error(`pool.acquire timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const waiter = (slot: Slot) => {
        clearTimeout(timer);
        slot.inUse = true;
        resolve(slot);
      };
      this.waiters.push(waiter);
    });
  }

  release(slot: Slot): void {
    slot.inUse = false;
    const next = this.waiters.shift();
    if (next && slot.browser !== null) next(slot);
  }

  /** Convenience — acquire, run fn with a fresh context, release. */
  async withContext<T>(
    fn: (ctx: BrowserContext, browser: Browser) => Promise<T>,
    acquireTimeoutMs = 30_000,
  ): Promise<T> {
    const slot = await this.acquire(acquireTimeoutMs);
    const browser = slot.browser;
    if (!browser) {
      this.release(slot);
      throw new Error(`pool.withContext: slot ${slot.id} has no browser`);
    }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      return await fn(ctx, browser);
    } finally {
      await ctx.close().catch(() => undefined);
      this.release(slot);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await Promise.all(
      this.slots.map(async (s) => {
        if (s.browser) await s.browser.close().catch(() => undefined);
        s.browser = null;
      }),
    );
    log.info('pool: stopped');
  }
}
