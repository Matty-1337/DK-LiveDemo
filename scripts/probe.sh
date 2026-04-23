#!/bin/bash
# Inside livedemo-backend. Dumps mongo collections + runs smoke tests.
set +e
cd /home/app

# Expects TOKEN and WS in the environment. Inject them via:
#   TOKEN=<infisical LIVEDEMO_API_TOKEN> WS=<LIVEDEMO_WORKSPACE_ID> bash probe.sh
TOKEN="${TOKEN:?TOKEN env var required — pull from Infisical LIVEDEMO_API_TOKEN}"
WS="${WS:?WS env var required — pull from Infisical LIVEDEMO_WORKSPACE_ID}"

node -e '
const http = require("http");
const { MongoClient } = require("mongodb");
const TOKEN = process.env.TOKEN;
const WS = process.env.WS;

function req(method, path, body, headers) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const h = Object.assign({"Content-Type":"application/json"}, headers || {});
    if (data) h["Content-Length"] = Buffer.byteLength(data);
    const r = http.request({host:"localhost",port:3005,path,method,headers:h}, r => {
      let d=""; r.on("data",c=>d+=c); r.on("end",()=>res({status:r.statusCode, body:d}));
    });
    r.on("error",rej); if (data) r.write(data); r.end();
  });
}

(async () => {
  const B = "Bearer "+TOKEN;

  console.log("=== SMOKE:1 GET /workspaces ===");
  console.log((await req("GET","/workspaces",null,{Authorization:B})).status);

  console.log("\n=== SMOKE:2 POST /emptyStory ===");
  const s = await req("POST","/emptyStory",{name:"discovery-probe-1",workspaceId:WS},{Authorization:B});
  console.log("status:",s.status); console.log(s.body);
  let storyId = null; try { storyId = JSON.parse(s.body)._id; } catch {}

  console.log("\n=== SMOKE:3 GET /workspaces/:ws/stories/:sid ===");
  const gs = await req("GET",`/workspaces/${WS}/stories/${storyId}`,null,{Authorization:B});
  console.log("status:",gs.status); console.log(gs.body.slice(0,600));

  console.log("\n=== SMOKE:4 POST screens (empty body to elicit validator shape) ===");
  const v1 = await req("POST",`/workspaces/${WS}/stories/${storyId}/screens`,{},{Authorization:B});
  console.log("status:",v1.status); console.log(v1.body.slice(0,600));

  console.log("\n=== SMOKE:5 POST /workspaces/:ws/forms (no body) ===");
  const v2 = await req("POST",`/workspaces/${WS}/forms`,{},{Authorization:B});
  console.log("status:",v2.status); console.log(v2.body.slice(0,600));

  console.log("\n=== SMOKE:6 POST publish true ===");
  const p = await req("POST",`/workspaces/${WS}/stories/${storyId}/publish`,{isPublished:true},{Authorization:B});
  console.log("status:",p.status); console.log(p.body.slice(0,800));

  console.log("\n=== SMOKE:7 POST story link ===");
  const l = await req("POST",`/workspaces/${WS}/stories/${storyId}/links`,{name:"discovery-link-1"},{Authorization:B});
  console.log("status:",l.status); console.log(l.body);

  console.log("\n=== SMOKE:8 GET /workspaces/:ws/sessions (analytics) ===");
  const se = await req("GET",`/workspaces/${WS}/sessions?viewType=30D&limit=5`,null,{Authorization:B});
  console.log("status:",se.status); console.log(se.body.slice(0,400));

  console.log("\n=== SMOKE:9 GET /workspaces/:ws/leads ===");
  const ld = await req("GET",`/workspaces/${WS}/leads?viewType=30D`,null,{Authorization:B});
  console.log("status:",ld.status); console.log(ld.body.slice(0,400));

  console.log("\n=== SMOKE:10 AUTH-FAIL no Bearer ===");
  const a1 = await req("GET","/workspaces");
  console.log("status:",a1.status); console.log(a1.body.slice(0,200));
  console.log("\n=== SMOKE:11 AUTH-FAIL bad token ===");
  const a2 = await req("GET","/workspaces",null,{Authorization:"Bearer nope"});
  console.log("status:",a2.status); console.log(a2.body.slice(0,200));

  // ---------- Mongo dump ----------
  console.log("\n\n===== MONGO_DUMP =====");
  const c = new MongoClient(process.env.MONGO_URI || process.env.DB_URI);
  await c.connect();
  const db = c.db();
  const cols = await db.listCollections().toArray();
  const names = cols.map(x=>x.name).sort();
  console.log("COLLECTIONS:", names.join(", "));
  for (const name of names) {
    try {
      const count = await db.collection(name).estimatedDocumentCount();
      let sample = null;
      if (count > 0) sample = await db.collection(name).findOne({});
      if (sample) for (const k of Object.keys(sample)) if (/password|hash|secret/i.test(k)) sample[k] = "[REDACTED]";
      const idx = await db.collection(name).indexes();
      console.log(`\n---COLLECTION ${name} count=${count}---`);
      console.log("indexes:", JSON.stringify(idx));
      console.log("sample:", JSON.stringify(sample, null, 2));
    } catch (e) { console.log("err", name, e.message); }
  }
  await c.close();
})().catch(e => { console.error("FATAL", e); process.exit(1); });
' 2>&1
