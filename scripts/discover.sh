#!/bin/bash
# Runs inside livedemo-backend container via railway ssh.
# Emits sectioned output that the caller redirects into the discovery log.

set +e
cd /home/app

sec() { printf "\n\n===== %s =====\n" "$1"; }

sec "ENV_SUMMARY"
env | grep -iE "PORT|MONGO|PRIVATE_AUTH|NODE_ENV|ENABLE_API|ENABLE_CONSUMER" | sort

sec "authReq_source"
sed -n '280,365p' src/helpers/livedemoHelpers.js

sec "authHelpers_full"
cat src/helpers/authHelpers.js

sec "AuthTokenTypes"
cat src/constants/AuthTokenTypes.js 2>/dev/null

sec "AuthTokenStatuses"
cat src/constants/AuthTokenStatuses.js 2>/dev/null

sec "ResponseCodes"
cat src/constants/ResponseCodes.js 2>/dev/null

for f in postEmptyStory postStories postInProgressStory postScreens postSteps patchStep deleteStep postStoryPublish postForms patchForm postLeadsForm getStoryById getWorkspaceSessions getWorkspaceLeads deleteStory postStoryUpdateScreenOrder postStoryLinks postScreenCopy patchScreen postStoryAIVoice postGenerateAIVoice; do
  sec "HANDLER:$f"
  cat src/handlers/$f.js 2>/dev/null | sed -n '1,180p'
done

for m in User AuthToken Workspace Story Screen Step ScreenStep Form Lead Session SessionEvent Link PublishedLiveDemo LiveDemo Content; do
  sec "MODEL:$m"
  cat src/models/$m.js 2>/dev/null | head -200
done

sec "MODEL_INDEX"
cat src/models/index.js | head -120

sec "VALIDATORS_createWorkspace"
cat src/helpers/validators/oldLambdaRoutes/workspaces/createWorkspace.js 2>/dev/null

sec "VALIDATORS_userValidators"
grep -A 30 "validateSignupForm\|validateLoginForm" src/helpers/validators/userValidators.js 2>/dev/null | head -80

sec "LIST_VALIDATORS_STORIES"
ls src/helpers/validators/stories 2>/dev/null
ls src/helpers/validators/forms 2>/dev/null

sec "MONGOSH_COLLECTIONS"
node -e '
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient(process.env.MONGO_URI || process.env.DB_URI);
  await c.connect();
  const db = c.db();
  const cols = await db.listCollections().toArray();
  for (const col of cols) {
    try {
      const cnt = await db.collection(col.name).estimatedDocumentCount();
      let sample = null;
      if (cnt > 0) {
        sample = await db.collection(col.name).findOne({}, {});
        // redact password-ish fields
        if (sample) {
          for (const k of Object.keys(sample)) {
            if (/password|hash|secret/i.test(k)) sample[k] = "[REDACTED]";
          }
        }
      }
      console.log("---COLLECTION", col.name, "count="+cnt, "---");
      console.log(JSON.stringify(sample, null, 2));
    } catch(e) { console.log("err", col.name, e.message); }
  }
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
'

sec "MONGOSH_INDEXES"
node -e '
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient(process.env.MONGO_URI || process.env.DB_URI);
  await c.connect();
  const db = c.db();
  for (const col of ["users","authtokens","workspaces","stories","screens","forms","leads","sessions","sessionevents","links","publishedlivedemos","livedemos"]) {
    try {
      const idx = await db.collection(col).indexes();
      console.log("---IDX", col, "---");
      console.log(JSON.stringify(idx, null, 2));
    } catch(e) {}
  }
  await c.close();
})();
'

sec "DONE"
