// Dry-run of runGenerate() with a mocked browser-client.
// Does NOT hit the real backend or browser service — it stubs both.
// Used to validate Phase 6 orchestration logic before real creds exist.

process.env.LIVEDEMO_PRODUCTS_JSON =
  process.env.LIVEDEMO_PRODUCTS_JSON || '../config/products.json';
process.env.LIVEDEMO_WORKSPACE_ID =
  process.env.LIVEDEMO_WORKSPACE_ID || '69ea79a8d7a9e7a66f4a784c';
process.env.LIVEDEMO_API_TOKEN =
  process.env.LIVEDEMO_API_TOKEN || 'dry-run-token';

const { runGenerate } = require('../dist/tools/generate.js');
const clientModule = require('../dist/lib/client.js');
const browserModule = require('../dist/lib/browser-client.js');

// --- Mock the browser capture ---
browserModule.__resetBrowserClient();
const captureCalls = [];
browserModule.getBrowserClient = function () {
  return {
    async capture(req) {
      captureCalls.push(req);
      const screens = req.navigationPlan.map((step, i) => ({
        html: `<html><body>probe screen ${i} for ${req.module}</body></html>`,
        pngBase64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC',
        width: 1280,
        height: 800,
        pageTitle: `Page ${i + 1} — ${step.path}`,
        capturedAt: new Date().toISOString(),
        source: { path: step.path, note: step.note },
      }));
      return {
        ok: true,
        product: req.product,
        module: req.module,
        screens,
        timings: { authMs: 1200, perScreenMs: screens.map(() => 800), totalMs: 5000 },
      };
    },
    async health() { return { ok: true }; },
    async ready() { return { ready: true, poolSize: 3, targetSize: 3 }; },
  };
};

// --- Mock the LiveDemo client ---
clientModule.__resetClient();
const apiCalls = [];
let storyCounter = 0;
let screenCounter = 0;
let stepCounter = 0;
function oid() { return 'a'.repeat(20) + (++storyCounter).toString(16).padStart(4, '0'); }
function oidScreen() { return 'b'.repeat(20) + (++screenCounter).toString(16).padStart(4, '0'); }
function oidStep() { return 'c'.repeat(20) + (++stepCounter).toString(16).padStart(4, '0'); }

clientModule.getClient = function () {
  return {
    async createEmptyStory(body) {
      apiCalls.push({ fn: 'createEmptyStory', body });
      return { _id: oid() };
    },
    async createScreen(ws, sid, body) {
      apiCalls.push({ fn: 'createScreen', ws, sid, name: body.name, len: { content: body.content.length, img: body.imageData.length } });
      return { _id: oidScreen(), storyId: sid, workspaceId: ws, index: screenCounter - 1, type: 'Screen_Page', steps: [], customTransitions: [], name: body.name, imageUrl: 'https://s3.fake/placeholder.png', width: body.width, height: body.height, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    },
    async createStep(ws, sid, scid, body) {
      apiCalls.push({ fn: 'createStep', ws, sid, scid, body });
      return { _id: oidStep(), index: body.index, view: body.view, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    },
    async patchStep(ws, sid, scid, stepid, body) {
      apiCalls.push({ fn: 'patchStep', ws, sid, scid, stepid, bodyKeys: Object.keys(body), popupTitle: body.view?.popup?.title });
      return { _id: scid, storyId: sid, workspaceId: ws, steps: [], type: 'Screen_Page', index: 0, name: '', customTransitions: [], createdAt: '', updatedAt: '' };
    },
    async publishStory(ws, sid, body) {
      apiCalls.push({ fn: 'publishStory', ws, sid, body });
      return { _id: sid, isPublished: body.isPublished, status: 'ready', workspaceId: ws, userId: 'mock', name: 'mock', screens: [], type: 'web', deletedAt: null, createdAt: '', updatedAt: '' };
    },
    async createStoryLink(ws, sid, body) {
      apiCalls.push({ fn: 'createStoryLink', ws, sid, body });
      return { _id: 'abc-xyz-123', name: body?.name || '', workspaceId: ws, storyId: sid, variables: [], createdAt: '', updatedAt: '' };
    },
    async deleteStory(ws, sid) {
      apiCalls.push({ fn: 'deleteStory', ws, sid });
      return { _id: sid, deletedAt: new Date().toISOString(), workspaceId: ws, userId: 'mock', name: 'mock', screens: [], type: 'web', status: 'ready', isPublished: false, createdAt: '', updatedAt: '' };
    },
  };
};

// --- Run ---
(async () => {
  console.log('=== dry-run: coretap/overview with personalization ===');
  const result = await runGenerate({
    product: 'coretap',
    module: 'overview',
    prospect: { name: 'Johnny\'s Tavern', location: 'Dallas, TX', context: 'Sports bar, 80 seats' },
  });
  console.log(JSON.stringify(result, null, 2));

  console.log('\n=== capture calls ===');
  console.log(JSON.stringify(captureCalls.map(c => ({ product: c.product, module: c.module, baseUrl: c.baseUrl, steps: c.navigationPlan.length })), null, 2));

  console.log('\n=== API calls (fn + key fields) ===');
  for (const c of apiCalls) console.log(' ', JSON.stringify(c));

  console.log('\n=== personalization spot-check ===');
  const withName = apiCalls.filter(c => c.fn === 'patchStep' && typeof c.popupTitle === 'string');
  console.log('patchStep popup titles:');
  for (const c of withName) console.log('  -', c.popupTitle);
  const personalized = withName.some(c => c.popupTitle.includes('Johnny'));
  console.log('personalization injected:', personalized ? 'YES ✓' : 'NO ✗');

  if (!result.ok) { console.error('FAIL'); process.exit(1); }
  if (!personalized) { console.error('personalization did not fire'); process.exit(1); }
  console.log('\n✓ PASS');
})().catch((e) => { console.error('threw:', e); process.exit(1); });
