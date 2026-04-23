# Upstream LiveDemo Backend — API Reference

> Source of truth for MCP server tooling. Route table extracted verbatim from
> `src/server.js` in `livedemo/livedemo-backend:latest`
> (sha256 `6e63e427ac9f602a9057f6d20c2a0094b2e849c33b75c4d69b0eac85b05a43bb`).
> Request bodies taken from Joi validators in `src/helpers/validators/**`.
> Response shapes taken from handlers in `src/handlers/**`. Bootstrap flow
> (§Core resources → "Auth + bootstrap") was exercised live.

---

## Auth model summary

User-issued opaque bearer tokens, 64-hex-char, no expiry (see
[`auth-model.md`](auth-model.md)). Send as `Authorization: Bearer <token>`.
`PRIVATE_AUTH_TOKEN` is dead code — do **not** use it anywhere.

## Conventions

- **Base URL (internal):** `http://livedemo-backend.railway.internal:3005`
- **Auth header:** `Authorization: Bearer <token>` required for all resource
  routes (exceptions: `POST /users`, `POST /users/password-authenticate`,
  `POST /leads/forms/:formId`, `GET /tutorials/search`, `GET /oembed`,
  `GET /preview/:storyId`, `GET /livedemos/:storyId`, and the Google OAuth
  callback routes).
- **Content-Type:** `application/json` for all JSON bodies; `multipart/form-data`
  for upload routes.
- **CORS:** every handler emits `Access-Control-Allow-Origin: *` and
  `Access-Control-Allow-Headers: ClientId,Authorization,Content-Type,Accept`.
- **Error shape:** inconsistent — see "Error shapes" at the bottom. Most
  handlers return status-plus-header on failure with an **empty body** or a
  body like `{"error":"<message>"}` or `{"errors":{...}}`.
- **Validation:** Joi `@hapi/joi` schemas. Validator failure returns status
  `500` with body `JSON.stringify(validationResult)` — yes, 500, not 400.
  (See `livedemoHelpers.js:validateBody`.)

## Route table (verbatim from `src/server.js`)

Auth legend: 🔒 = authenticated (calls `helpers.authReq`); 🌐 = public (no
auth); 📎 = file upload (multer).

### Auth + users
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/users` | 🌐 | `postUsers.js` |
| GET  | `/users` | 🔒 | `getUsers.js` |
| PATCH | `/users` | 🔒 | `patchUsers.js` |
| POST | `/users/password-authenticate` | 🌐 | `postPasswordAuthenticate.js` |
| POST | `/users/token-authenticate` | 🌐 | `postTokenAuthenticate.js` |
| POST | `/users/refreshToken` | 🌐 | `postRefreshToken.js` |
| POST | `/users/logout` | 🔒 | `postLogout.js` |
| POST | `/users/forgotPassword` | 🌐 | `postForgotPassword.js` |
| POST | `/users/sendChangePasswordEmail` | 🌐 | `postSendChangePasswordEmail.js` |
| POST | `/users/changePassword` | 🌐 | `postChangePassword.js` |
| POST | `/users/closeAccount` | 🔒 | `postCloseAccount.js` |
| GET  | `/users/cards` | 🔒 | `getUsersCards.js` |
| GET  | `/users/auth/google-link` | 🌐 | `getUsersAuthGoogleLink.js` |
| GET  | `/users/auth/google-callback` | 🌐 | `getUsersAuthGoogleCallback.js` |
| POST | `/users/auth/google-one-tap` | 🌐 | `postUsersAuthGoogleOneTap.js` |

### Workspaces
| M | Path | Auth | Handler |
|---|---|---|---|
| GET  | `/workspaces` | 🔒 | `getWorkspaces.js` |
| POST | `/workspaces` | 🔒 | `postCreateWorkspace.js` |
| GET  | `/workspaces/:workspaceId` | 🔒 | `getWorkspaceById.js` |
| PATCH | `/workspaces/:workspaceId` | 🔒 | `patchWorkspace.js` |
| PATCH | `/workspaces/:workspaceId/integrations` | 🔒 | `patchWorkspaceIntegrations.js` |
| DELETE | `/workspaces/:workspaceId` | 🔒 | `deleteWorkspace.js` |
| POST | `/workspaces/:workspaceId/addUser` | 🔒 | `postWorkspaceAddUser.js` |
| POST | `/workspaces/:workspaceId/removeUser` | 🔒 | `postWorkspaceRemoveUser.js` |
| GET  | `/workspaces/:workspaceId/library` | 🔒 | `getWorkspaceLibrary.js` |
| GET  | `/workspaces/:workspaceId/voices` | 🔒 | `getWorkspaceVoices.js` |
| GET  | `/workspaces/:workspaceId/hubspot/forms` | 🔒 | `getWorkspaceHubspotForms.js` |

### Stories (a "demo" in MCP-speak === a "story" in the backend)
| M | Path | Auth | Handler |
|---|---|---|---|
| GET  | `/workspaces/:workspaceId/stories` | 🔒 | `getStories.js` |
| GET  | `/workspaces/:workspaceId/stories/:storyId` | 🔒 | `getStoryById.js` |
| POST | `/stories` | 🔒 | `postStories.js` — the recording-extension endpoint |
| POST | `/desktopStories` | 🔒 | `postDesktopStories.js` |
| POST | `/emptyStory` | 🔒 | `postEmptyStory.js` — **programmatic creation** |
| POST | `/inProgressStory` | 🔒 | `postInProgressStory.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId` | 🔒 | `patchStory.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId` | 🔒 | `deleteStory.js` — soft delete (sets `deletedAt`) |
| POST | `/workspaces/:workspaceId/stories/:storyId/publish` | 🔒 | `postStoryPublish.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/updateScreenOrder` | 🔒 | `postStoryUpdateScreenOrder.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/aiText` | 🔒 | `postStoryAIText.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/aiVoice` | 🔒 | `postStoryAIVoice.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/generateAiVoice` | 🔒 | `postGenerateAIVoice.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/generateStoryContent` | 🔒 | `postGenerateStoryContent.js` |
| GET  | `/workspaces/:workspaceId/stories/:storyId/preview` | 🔒 | `getStoryPreview.js` |
| GET  | `/preview/:storyId` | 🌐 | `getPreviewStory.js` |
| GET  | `/livedemos/:storyId` | 🌐 | `getLiveDemoPreview.js` |
| GET  | `/oembed` | 🌐 | `getLiveDemoOEmbed.js` |

### Screens (belong to a story; **not** independently addressable)
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/stories/:storyId/screens` | 🔒 | `postScreens.js` — **requires real HTML + base64 PNG, uploads to S3** |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId` | 🔒 | `patchScreen.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/popups` | 🔒 | `patchScreenPopups.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId` | 🔒 | `deleteScreen.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/copy` | 🔒 | `postScreenCopy.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/createScreenFromFrame` | 🔒 | `postCreateScreenFromFrame.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/editText` | 🔒 | `postScreenEditText.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screenUpload` | 🔒📎 | `postScreenUpload.js` |
| GET  | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/preview` | 🔒 | `getScreenPreview.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/transitions` | 🔒 | `postTransitions.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/transitions/:transitionId` | 🔒 | `deleteTransition.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/transitions/:transitionId` | 🔒 | `patchTransition.js` |

### Steps (embedded inside a screen, NOT a separate collection)
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps` | 🔒 | `postSteps.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId` | 🔒 | `patchStep.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId` | 🔒 | `deleteStep.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId/uploadAudio` | 🔒📎 | `postStepUploadAudio.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId/audios` | 🔒 | `postStepAudio.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId/audios/:audioId` | 🔒 | `deleteStepAudio.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId/zoomSpans` | 🔒 | `postStepZoomSpans.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId/zoomSpans/:zoomSpanId` | 🔒 | `patchStepZoomSpan.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId/zoomSpans/:zoomSpanId` | 🔒 | `deleteStepZoomSpan.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/zoomSpans` | 🔒 | `postZoomSpans.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/zoomSpans/:zoomSpanId` | 🔒 | `patchZoomSpan.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/screens/:screenId/zoomSpans/:zoomSpanId` | 🔒 | `deleteZoomSpan.js` |

### Forms + leads
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/forms` | 🔒 | `postForms.js` |
| PATCH | `/workspaces/:workspaceId/forms/:formId` | 🔒 | `patchForm.js` |
| POST | `/leads/forms/:formId` | 🌐 (captcha-gated) | `postLeadsForm.js` — note: the route in `server.js` has a trailing slash (`/leads/forms/:formId/`), but Express treats both forms as the same. Prefer no trailing slash for consistency with every other route. |
| GET  | `/workspaces/:workspaceId/leads` | 🔒 | `getWorkspaceLeads.js` |

### Sessions + analytics
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/stories/:storyId/sessions` | 🔒 | `postStorySession.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/sessions/:sessionId/events` | 🔒 | `postStorySessionEvents.js` |
| GET  | `/workspaces/:workspaceId/stories/:storyId/sessions/:sessionId/events` | 🔒 | `getStorySessionEvents.js` |
| GET  | `/workspaces/:workspaceId/stories/:storyId/sessions` | 🔒 | `getStorySessions.js` |
| GET  | `/workspaces/:workspaceId/sessions` | 🔒 | `getWorkspaceSessions.js` |

### Story links (shareable URLs)
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/stories/:storyId/links` | 🔒 | `postStoryLinks.js` |
| GET  | `/workspaces/:workspaceId/stories/:storyId/links` | 🔒 | `getStoryLinks.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/links/:linkId` | 🔒 | `patchStoryLink.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/links/:linkId` | 🔒 | `deleteStoryLink.js` |

### Custom story styling
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/stories/:storyId/custom/header/uploadImage` | 🔒📎 | `postCustomHeaderUploadImage.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/custom/theme/uploadWatermarkImage` | 🔒📎 | `postCustomThemeUploadWatermarkImage.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/custom/header` | 🔒 | `postCustomHeader.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/custom/theme` | 🔒 | `postCustomTheme.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/custom/misc` | 🔒 | `postCustomMisc.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/custom/background` | 🔒 | `postCustomBackground.js` |
| POST | `/workspaces/:workspaceId/stories/:storyId/custom/variables` | 🔒 | `postCustomVariables.js` |
| PATCH | `/workspaces/:workspaceId/stories/:storyId/custom/variables/:varId` | 🔒 | `patchCustomVariables.js` |
| DELETE | `/workspaces/:workspaceId/stories/:storyId/custom/variables/:varId` | 🔒 | `deleteCustomVariables.js` |

### Workspace library assets
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/library/uploadScreenshot` | 🔒📎 | `postWorkspaceLibraryUploadScreenshot.js` |
| POST | `/workspaces/:workspaceId/library/uploadVideo` | 🔒📎 | `postWorkspaceLibraryUploadVideo.js` |

### Auto-recordings (alternate ingestion path)
| M | Path | Auth | Handler |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/auto-recordings` | 🔒 | `postAutoRecordings.js` |
| GET  | `/workspaces/:workspaceId/auto-recordings/:autoRecordingId` | 🔒 | `getAutoRecordingById.js` |
| POST | `/workspaces/:workspaceId/auto-recordings/:autoRecordingId/events` | 🔒 | `postAutoRecordingsEvents.js` |
| POST | `/workspaces/:workspaceId/auto-recordings/:autoRecordingId/complete` | 🔒 | `postAutoRecordingsComplete.js` |
| POST | `/workspaces/:workspaceId/demo-suggestions/:demoSuggestionId/generate-livedemo` | 🔒 | `postDemoSuggestionsGenerateLiveDemo.js` |

### Billing + payments (irrelevant to MCP but documented for completeness)
| M | Path | Auth | Handler |
|---|---|---|---|
| GET  | `/subscriptions` | 🔒 | `getSubscriptions.js` |
| PATCH | `/subscriptions/:subscriptionId` | 🔒 | `patchSubscription.js` |
| GET  | `/cards` | 🔒 | `getCards.js` |
| DELETE | `/cards/:cardId` | 🔒 | `deleteCard.js` |
| GET  | `/charges` | 🔒 | `getCharges.js` |
| POST | `/payments/charge` | 🔒 | `postPaymentCharge.js` |
| POST | `/payments/freeActivate` | 🔒 | `postPaymentFreeActivate.js` |
| POST | `/payments/afterPayment` | 🔒 | `postPaymentAfterPayment.js` |
| POST | `/payments/chargeInternal` | 🌐 | `postPaymentChargeInternal.js` |
| POST | `/verifyPaymentCharge` | 🌐 | `postVerifyPaymentCharge.js` |
| POST | `/jobs/finalizeSubscription` | 🌐 | job-worker only |
| POST | `/jobs/cancelSubscription` | 🌐 | job-worker only |
| POST | `/jobs/expireSubscriptions` | 🌐 | job-worker only |

### Misc
| M | Path | Auth | Handler |
|---|---|---|---|
| GET  | `/` | 🌐 | health check — returns 200 empty |
| GET  | `/tutorials/search` | 🌐 | `getTutorialsSearch.js`; query params `q=<term>` and `featured=true`; IP-rate-limited 5 req/s. |
| POST | `/authorize-instance` | 🔒 | `postAuthorizeInstance.js` |
| POST | `/instance-authenticate` | 🌐 | `postInstanceAuthenticate.js` |
| GET  | `/integrations/hubspot-callback` | 🌐 | OAuth callback |

---

## Critical route details for the MCP rewrite

Below are the exact contracts for every route the MCP server needs to call.

### POST /users/password-authenticate  (bootstrap, token acquisition)
**Auth:** none.
**Request:**
```json
{ "email": "<string>", "password": "<string, length ≥ 1>" }
```
**Response 200:**
```json
{
  "id": "<ObjectId string>",
  "email": "<string>",
  "timezone": "<string or ''>",
  "name": "<string>",
  "token": "<64-hex>",
  "workspaceMembers": [],
  "redirectPath": "/onboarding" | "/"
}
```
**Error 400:** body `{"error":"Incorrect Email Or Password"}` or similar.
**Verified by:** bootstrap in `discovery-log.md` §Phase-0. ✓

### GET /workspaces  (list all workspaces the user belongs to)
**Auth:** Bearer.
**Request:** no body.
**Response 200:** JSON array of workspace documents (full schema, see
`upstream-data-model.md` §workspaces).
**Verified by:** bootstrap. ✓

### POST /workspaces  (create a workspace; adds it to user's `workspaces`)
**Auth:** Bearer.
**Request:** `{ "name": "<string, required>" }` (Joi: `createWorkspaceValidator`).
**Response 200:**
```json
{
  "workspaces":   [ /* the user's full updated workspace list */ ],
  "newWorkspace": { /* the single new workspace doc */ }
}
```
> The new workspace id is at **`newWorkspace._id`**, not at the top level.
**Verified by:** bootstrap captured `newWorkspace._id = 69ea79a8d7a9e7a66f4a784c`. ✓

### GET /workspaces/:workspaceId/stories  (list demos in a workspace)
**Auth:** Bearer + `validateUserHasAccessToWorkspace`.
**Query params:** unknown (no validator); `getStories.js` reads `req.query` but
most handlers ignore it.
**Response 200:** JSON array of story documents (see data-model doc).

### GET /workspaces/:workspaceId/stories/:storyId  (fetch a full demo)
**Auth:** Bearer.
**Response 200:** the Story document with `screens` populated and nested
`steps.view.popup.formId`, `steps.view.popup.buttons.gotoScreen`,
`steps.stepAudioId`, `customTransitions.gotoScreen`, plus a `cursorPositions`
array attached. Screens are returned pre-sorted by `index`.
**Source:** `getStoryById.js:1509–1552`.

### POST /emptyStory  (programmatic demo creation — **MCP's main entry point**)
**Auth:** Bearer.
**Request (Joi, all other fields optional):**
```json
{
  "name":           "<string, required>",
  "workspaceId":    "<ObjectId string, required>",
  "screenshots":    {},
  "tabInfo":        {},
  "windowMeasures": { "innerWidth": 1920, "innerHeight": 1080 },
  "aspectRatio":    1.777
}
```
**Response 200:** `{ "_id": "<new story ObjectId>" }`
**Notes:**
- Persists a Story doc with `status: 'ready'`, `screens: []`, and sets
  `userId` to the caller's user.
- **Does not create any screens.** Steps cannot be added until at least one
  screen exists — and creating screens programmatically requires real HTML
  content and a base64 PNG (see next entry).

### POST /workspaces/:workspaceId/stories/:storyId/screens
**Auth:** Bearer + workspace-access.
**Request (Joi, ALL required):**
```json
{
  "name":      "<string>",
  "content":   "<full HTML page source, string>",
  "imageData": "<base64 PNG bytes, string>",
  "width":     1920,
  "height":    1080
}
```
**Response 200:** the newly-created `Screen_Page` document (includes
`_id`, `storyId`, `index`, `imageUrl`, pre-seeded `steps[0]`).
**Side effects (from `postScreens.js`):**
1. Decodes `imageData` and uploads to S3 via `helpers.uploadImage` — requires
   valid `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` on the backend.
2. Writes the HTML content to disk at
   `$STORIES_FOLDER/<storyId>/<screenId>.html`. Disk path must exist and be
   writable.
3. Pushes `newScreen._id` into `stories.screens` and `workspaces.library.pages`.
**Practical implication for MCP:** Programmatic screen creation is *technically*
possible but operationally heavy (base64 encode a 200 KB+ PNG per screen + ship
the full HTML). The correct MCP architecture is to either (a) operate only on
stories that already have screens (created via the recording Chrome extension
or the in-app recorder), or (b) clone an existing template story's screens
into a new story. There is no lightweight "create a placeholder screen" route.

### POST /workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps
**Auth:** Bearer + workspace-access.
**Request (Joi):**
```json
{
  "index": 0,
  "view":  { "viewType": "popup" | "hotspot" | "pointer" }
}
```
**Behavior:** Handler looks up all screens in the story to compute the
"next" screen for a popup's default Next button. For `viewType === "popup"`,
it seeds `view.popup = { type:'popup', title:'Title', description:'<p>Description</p>',
alignment:'center', showOverlay:true, buttons:[{text:'Next', gotoType:'next',
gotoScreen:<nextScreen._id>}] }`.
**Response 200:** the newly-created `ScreenStep` document (including its
generated `_id`). This step is **embedded** in the Screen, not a standalone
doc.

### PATCH /workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId
**Auth:** Bearer + workspace-access.
**Request (Joi, all fields optional — pass only what you want to update):**
```json
{
  "view": {
    "viewType": "popup" | "hotspot" | "pointer",
    "content":  "<HTML>",
    "pointer":  { "selector":"#foo", "selectorLocation": {positionX,positionY,width,height}, "placement":"top" },
    "hotspot":  { "frameX":200, "frameY":200, "placement":"auto" },
    "popup":    {
      "type":"popup", "showOverlay":true, "title":"...", "description":"<p>...</p>",
      "alignment":"center", "buttons":[{index,text,gotoType,gotoWebsite,gotoScreen,textColor,backgroundColor}]
    },
    "placement":"auto", "showHeader":false, "showFooter":false,
    "showStepNumbers":true, "nextButtonText":"Next"
  },
  "action": { "actionType":"NextButton"|"ElementClick", "selector":"#foo" },
  "autoPlayConfig": { "enabled":false, "type":"auto"|"manual", "delay":2 },
  "stepAudioId": "<ObjectId string>"
}
```
**Response 200:** the re-queried Screen document with `steps.view.popup.formId`,
`steps.view.popup.buttons.gotoScreen`, and `steps.stepAudioId` populated.

### DELETE /workspaces/:workspaceId/stories/:storyId/screens/:screenId/steps/:stepId
**Auth:** Bearer + workspace-access.
**Request:** no body.
**Response 200:** body `{}`. `$pull`s the step out of `screens.steps`.

### POST /workspaces/:workspaceId/stories/:storyId/publish
**Auth:** Bearer + workspace-access.
**Request:** `{ "isPublished": true | false }` (Joi required).
**Response 200:** the full Story document with `screens` populated (including
`steps.view.formId`, `customTransitions.gotoScreen`).
**Side effects:** flips `story.isPublished`. Does **not** create a
`publishedlivedemos` row by itself — that appears to be a separate concern
managed by the jobs worker. (UNVERIFIED: the direct cause-and-effect between
`/publish` and `publishedlivedemos` was not traced in this session; the
schema exists (see data-model) but the population path was not mapped.)

### POST /workspaces/:workspaceId/stories/:storyId/updateScreenOrder
**Auth:** Bearer + workspace-access.
**Request:** `{ "screens": [ { "_id":"<screenId>", "index": 0 }, ... ] }`
**Response 200:** empty body. Issues a `bulkWrite` of `updateOne` ops.

### POST /workspaces/:workspaceId/forms  (create a lead-capture form)
**Auth:** Bearer + workspace-access.
**Request (Joi):**
```json
{
  "type":         "step",               // Joi.valid(FormTypes.STEP) — only 'step' accepted here
  "storyId":     "<ObjectId string, optional>",
  "screenId":    "<ObjectId string, required if attaching to step>",
  "stepId":      "<ObjectId string, required if attaching to step>",
  "transitionId":"<ObjectId string, optional>"
}
```
**Response 200:** the created Form document. When `type === 'step'`, the
handler **also** attaches the form by setting
`screens.steps.$.view.popup.formId` on the matching step.
**Fields seeded by default:** `{title:'Get in touch with us', fields:[
{label:'Name', name:'name', required:true}, {label:'Email', name:'email',
required:true} ]}`. Use `PATCH /workspaces/:ws/forms/:formId` to rename or
change fields.

### PATCH /workspaces/:workspaceId/forms/:formId
**Auth:** Bearer + workspace-access.
**Request (Joi, all optional):**
```json
{
  "title": "<string>",
  "type":  "step" | "hubspot",
  "hubspot": { "formId":"<string>", "portalId":"<string>", "embedVersion":2 }
}
```
**Response 200:** the updated Form.

### POST /workspaces/:workspaceId/stories/:storyId/links
**Auth:** Bearer + workspace-access.
**Request (Joi):** `{ "name": "<string or empty>" }` (all other variables
ignored by the current validator).
**Response 200:** the created Link document. `_id` is a short-uuid (not a
Mongo ObjectId), e.g. `"abc123de-fgh"`.

### DELETE /workspaces/:workspaceId/stories/:storyId
**Auth:** Bearer + workspace-access.
**Request:** no body.
**Response 200:** the updated story with `deletedAt` timestamp set (soft delete).
**Note:** `getStoryById` filters with `deletedAt: null`, so a soft-deleted
story is invisible to reads.

### GET /workspaces/:workspaceId/sessions  (analytics — session overview)
**Auth:** Bearer + workspace-access.
**Query params:**
- `viewType`: `"48H"` | `"7D"` | `"30D"` (default `"30D"`)
- `limit`:    integer ≥ 1 (default 10)
- `page`:     integer ≥ 1 (default 1)
**Response 200:**
```json
{
  "storyDocs": [ {...story fields + computed metrics...} ],
  "sessionDocs": [ {_id, storyId, duration, stepsCount, dropOffStep, didPlay, didComplete, clientIpData, ...} ],
  "meta": {
    "pagination": {
      "currentPage": 1, "itemsPerPage": 10, "totalItems": N,
      "totalPages": N, "hasNextPage": bool, "hasPreviousPage": bool
    }
  }
}
```
(UNVERIFIED against a live response because no session data existed at
discovery time. Shape taken directly from `getWorkspaceSessions.js`.)

### GET /workspaces/:workspaceId/leads  (analytics — captured leads)
**Auth:** Bearer + workspace-access.
**Query params:** `viewType` (as above).
**Response 200:** JSON array of Lead documents with `storyId` populated
(name only) and `sessionId` populated (country/flag only). Sorted
`createdAt` desc.

### POST /leads/forms/:formId
**Auth:** no Bearer, but **captcha-gated** — requires `captchaToken` in the
body, validated against Google reCAPTCHA (`CAPTCHA_SECRET_KEY`).
**Request:**
```json
{ "captchaToken": "<recaptcha token>", "name": "...", "email": "...", ... }
```
Only field names declared in `Form.fields` are accepted; all are validated by
`validator.isEmail` (for `email`) or length 3–255 (for `name`).
**Response 200:** the Form with `leads` array pushed.
**MCP relevance:** the MCP probably never calls this — it's the public
end-user-submits-a-lead-form endpoint used by the embedded demo page.

---

## Error shapes (learned from source, partially verified)

| Source | Code | Body |
|---|---|---|
| Missing `Authorization` | 401 | *empty body* |
| Malformed `Authorization` (no `Bearer `) | 401 | *empty body* |
| Token not in DB | 401 | *empty body* |
| Joi validation failure | **500** | `JSON.stringify({error, value, details})` — note this returns **500 for bad input**, not 400 |
| `validateUserHasAccessToWorkspace` fails | **500** | `{"error":"<message>"}` |
| Signup duplicate email | 400 | `{"errors":{"error":"DUPLICATE_EMAIL"}}` |
| Login bad creds | 400 | `{"error":"Incorrect Email Or Password"}` |
| Generic handler throw | 500 | `''` or `{"error":"<message>"}` |
| Story/screen/step not found | varies | often 500 with error message |

**Key takeaway for MCP error handling:** do **not** map on status code alone.
A 500 can mean bad input (validator fail), access denied (workspace check),
or a genuine server error. Always read `response.data` and surface it.
A 401 is unambiguously "re-authenticate".

## Pagination

Only `GET /workspaces/:wsId/sessions` implements page-limit pagination. Other
list endpoints (`/workspaces/:wsId/stories`, `/workspaces/:wsId/leads`) return
full arrays.

## Admin/internal routes

`/payments/chargeInternal`, `/jobs/*`, `/authorize-instance`,
`/instance-authenticate` look like internal/worker-only paths but have no
distinct auth layer — they're `🌐 public` in Express's routing table. Do not
expose any of them through MCP.
