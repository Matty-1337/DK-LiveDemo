// discovery-probe-v2
//
// Runs inside livedemo-backend via `railway ssh`. Creates an empty story,
// pushes 2 screens with synthetic HTML + 1px PNG, snapshots Mongo before
// and after publish, and dumps everything as JSON to stdout.
//
// Env it reads: MONGO_URI (or DB_URI), LIVEDEMO_MCP_PASSWORD,
// LIVEDEMO_WORKSPACE_ID (fallback to 69ea79a8d7a9e7a66f4a784c).

const http = require('node:http');
const { MongoClient, ObjectId } = require('mongodb');

const EMAIL = 'mcp@deltakinetics.io';
const PWD = process.env.LIVEDEMO_MCP_PASSWORD;
const WS_ID = process.env.LIVEDEMO_WORKSPACE_ID || '69ea79a8d7a9e7a66f4a784c';
const MONGO_URI = process.env.MONGO_URI || process.env.DB_URI;

if (!PWD) { console.error('missing LIVEDEMO_MCP_PASSWORD'); process.exit(1); }
if (!MONGO_URI) { console.error('missing MONGO_URI/DB_URI'); process.exit(1); }

// Tiny 1x1 gray PNG, base64
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(
      { host: 'localhost', port: 3005, path, method, headers, timeout: 60_000 },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          let parsed;
          try { parsed = d ? JSON.parse(d) : null; } catch { parsed = d; }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function redact(obj) {
  // Recursively drop password-ish fields and anything that looks like a bearer
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/password|passwordHash|hash|secret/i.test(k)) out[k] = '[REDACTED]';
      else if (k === 'token' && typeof v === 'string' && v.length >= 32) out[k] = v.slice(0, 8) + '...' + v.slice(-6);
      else out[k] = redact(v);
    }
    return out;
  }
  return obj;
}

function buildScreenBody(idx, prospectName) {
  const html =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
    `<title>Probe Screen ${idx}</title></head><body>` +
    `<header data-probe-header>Screen ${idx} for ${prospectName}</header>` +
    `<main><h1>Probe Content ${idx}</h1>` +
    `<p>Synthetic HTML captured by discovery-probe-v2 on ${new Date().toISOString()}.</p>` +
    `<button data-action="primary">Primary</button>` +
    `</main></body></html>`;
  return {
    name: `probe-screen-${idx}`,
    content: html,
    imageData: TINY_PNG_B64,
    width: 1280,
    height: 800,
  };
}

(async () => {
  const result = { ok: false, steps: [] };
  const step = (label, data) => { const entry = { label, at: new Date().toISOString(), data }; result.steps.push(entry); console.error('STEP:', label); };

  try {
    // 1. Auth
    const auth = await req('POST', '/users/password-authenticate', { email: EMAIL, password: PWD });
    if (auth.status !== 200 || !auth.body?.token) throw new Error(`auth failed status=${auth.status} body=${JSON.stringify(auth.body).slice(0, 200)}`);
    const token = auth.body.token;
    step('auth', { status: auth.status, tokenPreview: token.slice(0, 8) + '...' + token.slice(-6) });

    // 2. Create empty story
    const es = await req('POST', '/emptyStory', {
      name: 'discovery-probe-v2',
      workspaceId: WS_ID,
      windowMeasures: { innerWidth: 1280, innerHeight: 800 },
      aspectRatio: 1.6,
    }, token);
    if (es.status !== 200) throw new Error(`emptyStory failed status=${es.status} body=${JSON.stringify(es.body).slice(0, 400)}`);
    const storyId = es.body._id;
    step('emptyStory', { status: es.status, body: es.body });

    // 3. Two screens
    const s1 = await req('POST', `/workspaces/${WS_ID}/stories/${storyId}/screens`, buildScreenBody(1, 'Probe Bar & Grill'), token);
    step('screen1', { status: s1.status, body: s1.body });
    if (s1.status >= 400) throw new Error(`screen1 failed status=${s1.status}`);

    const s2 = await req('POST', `/workspaces/${WS_ID}/stories/${storyId}/screens`, buildScreenBody(2, 'Probe Bar & Grill'), token);
    step('screen2', { status: s2.status, body: s2.body });
    if (s2.status >= 400) throw new Error(`screen2 failed status=${s2.status}`);

    // 4. MONGO snapshot PRE-publish
    const mongo = new MongoClient(MONGO_URI);
    await mongo.connect();
    const db = mongo.db();
    const sOid = new ObjectId(storyId);
    const preStory = await db.collection('stories').findOne({ _id: sOid });
    const preScreens = await db.collection('screens').find({ storyId: sOid }).sort({ index: 1 }).toArray();
    const prePublishedLD = await db.collection('publishedlivedemos').findOne({ storyId: sOid });
    const workspace = await db.collection('workspaces').findOne({ _id: new ObjectId(WS_ID) });
    const sampleAuthToken = await db.collection('authtokens').findOne({ status: 'active' });
    const screensIndexes = await db.collection('screens').indexes();
    const storiesIndexes = await db.collection('stories').indexes();
    const authtokensIndexes = await db.collection('authtokens').indexes();
    const workspacesIndexes = await db.collection('workspaces').indexes();
    const publishedlivedemosIndexes = await db.collection('publishedlivedemos').indexes();
    const livedemosIndexes = await db.collection('livedemos').indexes();
    const formsIndexes = await db.collection('forms').indexes();
    const linksIndexes = await db.collection('links').indexes();
    const leadsIndexes = await db.collection('leads').indexes();
    const sessionsIndexes = await db.collection('sessions').indexes();
    const collectionsList = (await db.listCollections().toArray()).map((c) => c.name).sort();

    step('pre_publish_mongo', {
      story: redact(preStory),
      screens: redact(preScreens),
      publishedLiveDemo: redact(prePublishedLD),
      workspace: redact(workspace),
      sampleAuthToken: redact(sampleAuthToken),
      indexes: {
        stories: storiesIndexes,
        screens: screensIndexes,
        authtokens: authtokensIndexes,
        workspaces: workspacesIndexes,
        publishedlivedemos: publishedlivedemosIndexes,
        livedemos: livedemosIndexes,
        forms: formsIndexes,
        links: linksIndexes,
        leads: leadsIndexes,
        sessions: sessionsIndexes,
      },
      collectionsList,
    });

    // 5. Publish
    const pub = await req('POST', `/workspaces/${WS_ID}/stories/${storyId}/publish`, { isPublished: true }, token);
    step('publish', { status: pub.status, body: redact(pub.body) });
    if (pub.status >= 400) throw new Error(`publish failed status=${pub.status}`);

    // Give workers a moment — in case publishedlivedemos is populated via queue
    await new Promise((r) => setTimeout(r, 3000));

    // 6. MONGO snapshot POST-publish
    const postStory = await db.collection('stories').findOne({ _id: sOid });
    const postScreens = await db.collection('screens').find({ storyId: sOid }).sort({ index: 1 }).toArray();
    const postPublishedLD = await db.collection('publishedlivedemos').findOne({ storyId: sOid });
    const postLiveDemo = await db.collection('livedemos').findOne({ workspaceId: new ObjectId(WS_ID) });
    step('post_publish_mongo', {
      story: redact(postStory),
      screens: redact(postScreens),
      publishedLiveDemo: redact(postPublishedLD),
      liveDemoSample: redact(postLiveDemo),
    });

    // 7. Also GET the story via API to see what the frontend reads
    const apiStory = await req('GET', `/workspaces/${WS_ID}/stories/${storyId}`, null, token);
    step('api_get_story', { status: apiStory.status, body: redact(apiStory.body) });

    // 8. Also list workspace stories via API
    const apiStories = await req('GET', `/workspaces/${WS_ID}/stories`, null, token);
    step('api_list_stories', { status: apiStories.status, count: Array.isArray(apiStories.body) ? apiStories.body.length : null });

    // 9. Also create a story link for share-URL verification
    const link = await req('POST', `/workspaces/${WS_ID}/stories/${storyId}/links`, { name: 'probe-v2-link' }, token);
    step('create_link', { status: link.status, body: link.body });

    await mongo.close();
    result.ok = true;
    result.storyId = storyId;
    result.workspaceId = WS_ID;
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    result.error = err.message;
    result.stack = err.stack;
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
})();
