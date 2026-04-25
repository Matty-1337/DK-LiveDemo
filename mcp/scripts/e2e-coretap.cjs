// End-to-end smoke test — runs from inside the Railway network (so
// internal DNS works). Calls the MCP generator's runGenerate() directly
// against the LIVE backend + LIVE browser service. No mocks.
//
// Usage (inside `railway ssh --service livedemo-mcp`):
//   node /tmp/e2e-coretap.cjs
//
// Or from outside via `railway run --service livedemo-mcp`:
//   npm run build && railway ssh "node /tmp/e2e-coretap.cjs"

const path = require('node:path');

(async () => {
  const t0 = Date.now();

  // Load the MCP generator from the deployed dist/
  const distRoot = process.env.MCP_DIST || '/app/mcp/dist';
  process.env.LIVEDEMO_PRODUCTS_JSON =
    process.env.LIVEDEMO_PRODUCTS_JSON || '/app/config/products.json';

  let runGenerate;
  try {
    ({ runGenerate } = require(path.join(distRoot, 'tools', 'generate.js')));
  } catch (e) {
    console.error('FATAL: cannot load generate.js from', distRoot, '-', e.message);
    process.exit(1);
  }

  const prospect = {
    name: process.env.E2E_PROSPECT_NAME || 'Smoke Test Bar',
    location: process.env.E2E_PROSPECT_LOCATION || 'Dallas, TX',
    context: process.env.E2E_PROSPECT_CONTEXT || 'Sports bar, 80 seats, weekend-heavy',
  };

  console.log('=== livedemo_generate_demo: coretap/overview ===');
  console.log('prospect:', prospect);
  console.log('workspace:', process.env.LIVEDEMO_WORKSPACE_ID);
  console.log('backend:', process.env.LIVEDEMO_API_URL);
  console.log('browser:', process.env.LIVEDEMO_BROWSER_URL || '(default)');

  const result = await runGenerate({
    product: 'coretap',
    module: 'overview',
    prospect,
  });

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('\ntotal wall time:', Date.now() - t0, 'ms');

  if (!result.ok) {
    console.error('\n✗ FAIL — phase=' + result.phase);
    process.exit(1);
  }
  console.log('\n✓ PASS — public URL:', result.url);
})().catch((e) => {
  console.error('threw:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
