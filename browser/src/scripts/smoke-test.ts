// Local smoke test for the browser service.
//
// Hits http://localhost:$PORT with /health, /ready, and a minimal /capture
// request aimed at a public page (no auth required — uses a stub product
// so CoreTAP credentials aren't needed for the smoke test).
//
// Run locally:
//   INFISICAL_TOKEN=... npm run dev          (terminal 1)
//   npm run smoke                            (terminal 2)
//
// For a credential-free smoke, override the product registration at the
// top of this file (see STUB_PRODUCT usage).

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 3200);
const BASE = `http://localhost:${PORT}`;

async function jfetch<T = unknown>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body: body as T };
}

async function main(): Promise<void> {
  console.log('→ GET /health');
  const h = await jfetch(`${BASE}/health`);
  console.log(`  status=${h.status} body=${JSON.stringify(h.body)}`);
  if (h.status !== 200) throw new Error('health check failed');

  console.log('→ GET /ready');
  const r = await jfetch(`${BASE}/ready`);
  console.log(`  status=${r.status} body=${JSON.stringify(r.body)}`);

  console.log('→ POST /capture (stub — public page, no auth)');
  const capture = await jfetch(`${BASE}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: 'stub-public',
      module: 'smoke',
      baseUrl: 'https://example.com',
      navigationPlan: [
        { path: '/', waitFor: 'networkidle', note: 'example.com root' },
      ],
      timeoutSeconds: 30,
    }),
  });
  console.log(`  status=${capture.status}`);
  const body = capture.body as { ok?: boolean; screens?: Array<{ pngBase64: string; width: number; height: number; pageTitle: string }> } | { ok: false; phase: string; message: string };

  if ('ok' in body && body.ok) {
    const dir = join(dirname(fileURLToPath(import.meta.url)), 'output');
    mkdirSync(dir, { recursive: true });
    const screens = body.screens ?? [];
    for (let i = 0; i < screens.length; i++) {
      const s = screens[i]!;
      writeFileSync(join(dir, `smoke-${i}.png`), Buffer.from(s.pngBase64, 'base64'));
      console.log(`  screen ${i}: title="${s.pageTitle}" ${s.width}x${s.height} — written to ${dir}`);
    }
    console.log('✓ smoke test PASSED');
  } else {
    console.error('✗ capture returned error:', JSON.stringify(body, null, 2));
    console.error('note: if phase=auth, this is expected when running against the real coretap authFn without credentials. Use product=stub-public as above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('smoke test threw:', err instanceof Error ? err.message : err);
  process.exit(1);
});
