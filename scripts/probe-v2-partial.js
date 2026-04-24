// discovery-probe-v2 — partial capture after S3 auth break blocks
// the full screen-creation path. Snapshots Story (existing), attempts
// publish on the empty story, captures mongo state + indexes.

const http = require('node:http');
const { MongoClient, ObjectId } = require('mongodb');

const STORY_ID = process.env.PROBE_STORY_ID || '69eab570d1622a2b258fc350';
const EMAIL = 'mcp@deltakinetics.io';
const PWD = process.env.LIVEDEMO_MCP_PASSWORD;
const WS_ID = process.env.LIVEDEMO_WORKSPACE_ID || '69ea79a8d7a9e7a66f4a784c';
const MONGO_URI = process.env.MONGO_URI || process.env.DB_URI;

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(
      { host: 'localhost', port: 3005, path, method, headers, timeout: 30_000 },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          let parsed; try { parsed = d ? JSON.parse(d) : null; } catch { parsed = d; }
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
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/password|hash|secret/i.test(k)) out[k] = '[REDACTED]';
      else if (k === 'token' && typeof v === 'string' && v.length >= 32) out[k] = v.slice(0, 8) + '...' + v.slice(-6);
      else out[k] = redact(v);
    }
    return out;
  }
  return obj;
}

(async () => {
  const result = { ok: false, steps: [] };
  const step = (label, data) => { result.steps.push({ label, at: new Date().toISOString(), data }); console.error('STEP:', label); };

  try {
    // 1. Auth
    const auth = await req('POST', '/users/password-authenticate', { email: EMAIL, password: PWD });
    const token = auth.body?.token;
    if (!token) throw new Error('auth failed');
    step('auth', { status: auth.status });

    // 2. Mongo — pre-publish snapshot of the existing story + all collections
    const mongo = new MongoClient(MONGO_URI);
    await mongo.connect();
    const db = mongo.db();
    const sOid = new ObjectId(STORY_ID);

    const preStory = await db.collection('stories').findOne({ _id: sOid });
    const preScreens = await db.collection('screens').find({ storyId: sOid }).toArray();
    const prePublishedLD = await db.collection('publishedlivedemos').findOne({ storyId: sOid });
    const workspace = await db.collection('workspaces').findOne({ _id: new ObjectId(WS_ID) });
    const sampleAuthToken = await db.collection('authtokens').findOne({ status: 'active' });

    const collectionsList = (await db.listCollections().toArray()).map((c) => c.name).sort();
    const indexesToGrab = ['users','authtokens','workspaces','stories','screens','forms','leads','sessions','sessionevents','links','publishedlivedemos','livedemos','demoactivityevents','audios','cursorpositions','autorecordings'];
    const indexes = {};
    for (const name of indexesToGrab) {
      try { indexes[name] = await db.collection(name).indexes(); } catch { indexes[name] = null; }
    }
    const counts = {};
    for (const name of collectionsList) {
      try { counts[name] = await db.collection(name).estimatedDocumentCount(); } catch { counts[name] = -1; }
    }

    step('mongo_pre_publish', {
      story: redact(preStory),
      screens: redact(preScreens),
      publishedLiveDemo: redact(prePublishedLD),
      workspace: redact(workspace),
      sampleAuthToken: redact(sampleAuthToken),
      collectionsList,
      collectionCounts: counts,
      indexes,
    });

    // 3. Publish — even though no screens, see what /publish does
    const pub = await req('POST', `/workspaces/${WS_ID}/stories/${STORY_ID}/publish`, { isPublished: true }, token);
    step('publish', { status: pub.status, body: redact(pub.body) });

    // Wait a sec for any worker to populate publishedlivedemos
    await new Promise((r) => setTimeout(r, 3000));

    // 4. Mongo — post-publish
    const postStory = await db.collection('stories').findOne({ _id: sOid });
    const postPublishedLD = await db.collection('publishedlivedemos').findOne({ storyId: sOid });
    const postLiveDemo = await db.collection('livedemos').findOne({ workspaceId: new ObjectId(WS_ID) });
    step('mongo_post_publish', {
      story: redact(postStory),
      publishedLiveDemo: redact(postPublishedLD),
      liveDemo: redact(postLiveDemo),
    });

    // 5. API GET story (what the frontend player reads)
    const apiStory = await req('GET', `/workspaces/${WS_ID}/stories/${STORY_ID}`, null, token);
    step('api_get_story', { status: apiStory.status, body: redact(apiStory.body) });

    // 6. Create a story link
    const link = await req('POST', `/workspaces/${WS_ID}/stories/${STORY_ID}/links`, { name: 'probe-v2-link' }, token);
    step('create_link', { status: link.status, body: link.body });

    // 7. Ping the public demo URL to see if it 200s for an empty published story
    // (done from within container so DNS resolves)
    const publicUrl = `https://demo.deltakinetics.io/livedemos/${STORY_ID}`;
    try {
      const https = require('node:https');
      const publicStatus = await new Promise((res, rej) => {
        https.get(publicUrl, { timeout: 10_000 }, (r) => res({ status: r.statusCode })).on('error', rej).on('timeout', () => rej(new Error('timeout')));
      });
      step('public_url', { url: publicUrl, ...publicStatus });
    } catch (e) {
      step('public_url', { url: publicUrl, error: e.message });
    }

    await mongo.close();
    result.ok = true;
    result.storyId = STORY_ID;
    result.workspaceId = WS_ID;
    result.publicUrl = publicUrl;
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    result.error = err.message;
    result.stack = err.stack;
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
})();
