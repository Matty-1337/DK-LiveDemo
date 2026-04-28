// livedemo-browser HTTP entry. Fastify on :3200 (Railway sets $PORT).
//
// Routes (Strategy C §2):
//   GET  /health  → { ok: true }
//   GET  /ready   → { ready: bool, poolSize, targetSize, ... }
//   POST /capture → { ok: true, screens: [...], timings: {...} }  |
//                   { ok: false, phase, message } on failure

import Fastify from 'fastify';
import { BrowserPool } from './pool.js';
import { runCapture, CaptureRequest } from './capture.js';
import { log } from './lib/logger.js';
import { loadSecrets, secretsStatus, startRefreshLoop } from './lib/infisical.js';
// Side-effect import: registers coretap auth in the registry.
import './auth/registry.js';

const PORT = Number(process.env.PORT ?? 3200);
const POOL_SIZE = Number(process.env.BROWSER_POOL_SIZE ?? 3);

async function main(): Promise<void> {
  log.info('boot: starting', { port: PORT, poolSize: POOL_SIZE });

  // Load secrets before anything else so auth functions have access.
  await loadSecrets();
  const refreshHandle = startRefreshLoop();

  const pool = new BrowserPool({ targetSize: POOL_SIZE });
  await pool.init();

  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });

  app.get('/health', async () => ({ ok: true }));

  app.get('/ready', async () => {
    const st = pool.status();
    const sec = secretsStatus();
    return {
      ready: pool.ready(),
      poolSize: st.poolSize,
      targetSize: st.targetSize,
      inUse: st.inUse,
      crashes: st.crashes,
      secrets: { source: sec.source, count: sec.count, loadedAt: sec.loadedAt },
    };
  });

  app.post<{ Body: CaptureRequest }>('/capture', async (req, reply) => {
    const body = req.body;
    if (!body || !body.product || !body.module || !Array.isArray(body.navigationPlan) || !body.baseUrl) {
      reply.status(400);
      return {
        ok: false as const,
        phase: 'unknown' as const,
        product: body?.product ?? '',
        module: body?.module ?? '',
        message: 'missing required fields: product, module, baseUrl, navigationPlan[]',
      };
    }
    try {
      const result = await runCapture(pool, body);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const phase =
        msg.includes('deadline') ? 'timeout' :
        msg.startsWith('coretap:') || msg.includes('AuthError') ? 'auth' :
        msg.includes('pool.acquire') ? 'pool-exhausted' :
        'unknown';
      log.error('capture failed', { product: body.product, module: body.module, phase, message: msg });
      reply.status(500);
      return {
        ok: false as const,
        phase,
        product: body.product,
        module: body.module,
        message: msg,
      };
    }
  });

  const shutdown = async (signal: string) => {
    log.info('shutdown: received', { signal });
    clearInterval(refreshHandle);
    await app.close().catch(() => undefined);
    await pool.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: PORT, host: '0.0.0.0' });
  log.info('boot: listening', { port: PORT, poolReady: pool.ready(), secrets: secretsStatus() });
}

main().catch((err) => {
  log.error('boot: fatal', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
