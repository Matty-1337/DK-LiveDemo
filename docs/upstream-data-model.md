# Upstream LiveDemo — MongoDB Data Model

> Database: `livedemo`, replica set `rs0`.
> Schemas reconstructed from `src/models/*.js` in
> `livedemo/livedemo-backend:latest` (sha256 `6e63e427...5a43bb`).
> Document counts, sample shapes, and index lists for most collections
> were not captured live in this session — see UNVERIFIED block at the
> end for how to refresh them.

---

## Collection naming convention

Mongoose pluralizes model names by default. Known mappings:

| Model file | Collection name |
|---|---|
| `User.js` | `users` |
| `AuthToken.js` (+ `AuthToken_User.js` discriminator) | `authtokens` |
| `Workspace.js` | `workspaces` |
| `Story.js` | `stories` |
| `Screen.js` (+ `Screen_Page.js`, `Screen_Screenshot.js`, `Screen_Video.js` discriminators) | `screens` |
| `ScreenStep.js` | *embedded* in `screens.steps[]` — no own collection |
| `Form.js` | `forms` |
| `Lead.js` | `leads` |
| `Session.js` | `sessions` |
| `SessionEvent.js` | `sessionevents` |
| `Link.js` | `links` |
| `LiveDemo.js` | `livedemos` |
| `PublishedLiveDemo.js` | `publishedlivedemos` |
| `Audio.js` | `audios` |
| `CursorPositions.js` | `cursorpositions` |
| `AutoRecording.js` | `autorecordings` |

Other collections referenced in source: `autorecordingevents`, `cards`,
`charges`, `configs`, `contents`, `demoactivityevents`, `demosuggestions`,
`emails`, `hubspottokens`, `jobs`, `requests`, `screennavigations`,
`screenpagetransitions`, `screenscreenshottransitions`, `screentransitions`,
`screen_pages`, `screen_screenshots`, `screen_videos`, `scripts`, `steps`
(legacy/unused), `stepaudios`, `storycontents`, `subscriptions`, `tours`,
`tutorials`, `workspacemembers`, `zoomspanscreenshots`, `zoomspanvideos`,
plus the monq queue collection `jobs-monq`.

---

## users

Strict schema, timestamps on, discriminator key `userType`.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `email` | String | yes | — | unique, indexed |
| `password` | String | yes | — | bcrypt hash, 10 salt rounds, pre-save hook in `User.js` |
| `name` | String | no | `''` | |
| `workspaceMembers` | [ObjectId] → `WorkspaceMember` | no | `[]` | |
| `stripeCustomerId` | String | no | — | |
| `defaultCardId` | ObjectId → `Card` | no | — | |
| `cards` | [ObjectId] → `Card` | no | `[]` | |
| `deleted` | Boolean | no | `false` | |
| `timezone` | String | no | `''` | |
| `workspaces` | [ObjectId] → `Workspace` | no | `[]` | **source of truth for workspace membership** |
| `subscriptions` | [ObjectId] → `Subscription` | no | `[]` | |
| `googleProfile` | `GoogleProfile` subdoc | no | — | |
| `featureFlags.freeActivate` | Boolean | no | `true` | |
| `onboarding.goals` | [String enum `OnboardingGoalsTypes.ONBOARDING_GOALS`] | no | `[]` | |
| `userType` | String (discriminator) | no | — | |
| `createdAt`, `updatedAt` | Date | auto | — | |

**Sample shape** (captured from auth response, fields that come back over the wire):
```json
{
  "id":               "69ea6d7d10a3c3c5d93195b3",
  "email":            "mcp@deltakinetics.io",
  "name":             "DK MCP Bot",
  "timezone":         "",
  "workspaceMembers": []
}
```

---

## authtokens

Strict, timestamps on, discriminator key `type`.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `token` | String | **yes** | — | unique (Mongoose `unique:true`); 64 hex chars from `crypto.randomBytes(32)` |
| `type` | String | no | `'AuthToken'` | values: `'AuthToken'`, `'AuthToken_User'`, `'AuthToken_UserChangePassword'`, `'AuthToken_UserDirectInstall'` |
| `status` | String | no | `'active'` | values: `'active'`, `'expired'` |
| `userId` | String (intentional — stored as string, see `authUtils.js:createTokenForUser`) | yes in practice | — | points to `users._id.toString()` |
| `clientId` | String | no | `'customScopes'` | `createTokenForUser` sets `'publicClient'` |
| `authorizedInstances` | [String] | no | `[]` | |
| `scopes` | [String] | no | `[]` | |
| `createdAt`, `updatedAt` | Date | auto | — | |

**No `expiresAt` field. No TTL index in source.** Tokens never expire unless
their status is flipped to `'expired'` by `postLogout.js`.

**Indexes (verified live on 2026-04-24):**
- `_id_`
- `token_1` **unique**

**No TTL index exists.** `authtokens.indexes()` returns exactly the two
above — no `expireAfterSeconds` anywhere. Tokens are long-lived until
their `status` flips to `'expired'` (see `auth-model.md`).

---

## workspaces

**Strict: false** (meaning ad-hoc fields are permitted to sneak in), timestamps
on, **typeKey `$type`** (because of mongoose-long).

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `name` | String | no | `''` | |
| `type` | String | no | `WorkspaceTypes.EMPTY = 'empty'` | values: `'empty'`, `'startup'`, `'pro'`, `'business'` |
| `integrations.hubspot` | Boolean | no | `false` | |
| `adminUser` | ObjectId → `User` | no | — | |
| `users` | [ObjectId → `User`] | no | `[]` | |
| `subscriptions` | [ObjectId → `Subscription`] | no | `[]` | |
| `liveDemos` | [ObjectId → `LiveDemo`] | no | `[]` | |
| `invitedEmails` | [String] | no | `[]` | |
| `library.pages` | [ObjectId → `Screen`] | no | `[]` | |
| `library.screenshots` | [ObjectId → `Screen`] | no | `[]` | |
| `library.videos` | [ObjectId → `Screen`] | no | `[]` | |
| `createdAt`, `updatedAt` | Date | auto | — | |

**Sample shape** (captured live during bootstrap, 2026-04-23):
```json
{
  "_id": "69ea79a8d7a9e7a66f4a784c",
  "name": "DK CoreTAP Demos",
  "type": "empty",
  "integrations": {"hubspot": false},
  "adminUser": "69ea6d7d10a3c3c5d93195b3",
  "users": ["69ea6d7d10a3c3c5d93195b3"],
  "subscriptions": [],
  "liveDemos": [],
  "invitedEmails": [],
  "library": {"pages": [], "screenshots": [], "videos": []},
  "createdAt": "2026-04-23T19:57:28.617Z",
  "updatedAt": "2026-04-23T19:57:28.617Z",
  "__v": 0
}
```

---

## stories

Strict, timestamps on.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `name` | String | no | — | |
| `workspaceId` | ObjectId → `Workspace` | no | — | |
| `userId` | ObjectId → `User` | no | — | |
| `screens` | [ObjectId → `Screen`] | no | `[]` | |
| `filePath` | String | no | `''` | on-disk JSON dump of `capturedEvents`, only for recorded stories |
| `status` | String | no | `'uploading'` | values: `'uploading'`, `'ready'`, `'failed'` |
| `demoSuggestionId` | ObjectId → `DemoSuggestion` | no | — | |
| `isPublished` | Boolean | no | `false` | |
| `type` | String | no | `'web'` | values: `'web'`, `'desktop'` |
| `capturedEvents` | Array (untyped) | no | — | rrweb event stream for recorded demos |
| `tabInfo` | Object (untyped) | no | — | |
| `windowMeasures` | Object (untyped) | no | — | e.g. `{innerWidth: 1920, innerHeight: 1080}` |
| `videoStartMs`, `videoEndMs` | Number | no | — | |
| `aspectRatio` | String | no | — | |
| `hasCursorPositions` | Boolean | no | — | |
| `content.contentStatus` | String | no | `''` | |
| `content.contentId` | ObjectId → `StoryContent` | no | — | |
| `custom.header.*`, `custom.theme.*`, `custom.misc.*`, `custom.background.*`, `custom.variables[]` | branding overrides | no | defaults in Mongoose schema | see `Story.js:215–257` |
| `thumbnailImageUrl` | String | no | `''` | |
| `links` | [String → `Link` (note: String, not ObjectId, because `Link._id` is a short-uuid)] | no | `[]` | |
| `deletedAt` | Date | no | `null` | soft-delete flag |
| `createdAt`, `updatedAt` | Date | auto | — | |

---

## screens

Strict, timestamps on, discriminator key `type`. Actual documents are
discriminators: `Screen_Page`, `Screen_Screenshot`, `Screen_Video`.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `name` | String | no | `''` | |
| `storyId` | ObjectId → `Story` | no | — | |
| `userId` | ObjectId → `User` | no | — | |
| `workspaceId` | ObjectId → `Workspace` | no | — | |
| `type` | String | no | `'Screen_Screenshot'` | values from `ScreenTypes`: `'Screen_Page'`, `'Screen_Screenshot'`, `'Screen_Video'` |
| `steps` | [**`ScreenStepSchema` subdocs**] | no | `[]` | embedded — see shape below |
| `customTransitions` | [`ScreenTransitionSchema` subdocs] | no | `[]` | |
| `index` | Number | no | — | 0-based ordering in the story |
| `imageUrl` | String | no | — | S3 URL of the screenshot (for `Screen_Page`) |
| `createdAt`, `updatedAt` | Date | auto | — | |

> The discriminator on `type` lets `Screen_Page` add `contentPath`, `width`,
> `height`, while `Screen_Video` adds `videoUrl`, `startTime`, `endTime`,
> `playbackRate`. The MCP does **not** currently need to distinguish them —
> treat as one polymorphic collection.

✅ **VERIFIED LIVE — populated screens doc captured 2026-04-24** via
`discovery-probe-v3` after the backend was switched to
`ghcr.io/matty-1337/dk-livedemo-backend:v1` (patched image with DK's
S3 bucket). Two screens created under story
`69ead984bd17ad58c2117777`; full raw output at
`docs/_probe-v3-raw.json`. Shape of the persisted Screen_Page doc:

```json
{
  "_id":         "69ead984bd17ad58c211777d",
  "name":        "probe-screen-1",        // [validated]
  "storyId":     "69ead984bd17ad58c2117777",  // [server-generated from URL]
  "userId":      "69ea6d7d10a3c3c5d93195b3",  // [server-generated from auth]
  "workspaceId": "69ea79a8d7a9e7a66f4a784c",  // [server-generated from URL]
  "type":        "Screen_Page",           // [server-generated discriminator]
  "index":       0,                       // [server-generated from story.screens.length]
  "imageUrl":    "https://dk-livedemo-cdn.s3.us-east-1.amazonaws.com/story-images/<uuid>.png",
                                          // [server-generated — S3 PUT result URL]
  "contentPath": "/<storyId>/<screenId>.html",
                                          // [server-generated — RELATIVE to STORIES_FOLDER]
  "width":       1280,                    // [validated]
  "height":      800,                     // [validated]
  "customTransitions": [],                // [server-generated default `[]`]
  "steps": [                              // ⚠ AUTO-SEEDED — see below
    { /* default popup step, see schema in next section */ }
  ],
  "createdAt": "2026-04-24T02:46:28.935Z",
  "updatedAt": "2026-04-24T02:46:28.935Z",
  "__v": 0
}
```

**⚠ Auto-seeded default step — critical for the MCP generator.**
`postScreens.js` creates a default `ScreenStep` on **every new screen**:
`view.viewType: "popup"`, `view.content: "<p>Welcome to our
StoryDemo!</p>"`, `view.popup.title: "Title"`, `view.popup.description:
"<p>Description</p>"`, `view.popup.buttons: []`. The current
`mcp/src/tools/generate.ts` flow does `POST /steps` which creates a
SECOND step. Fix: either (a) `PATCH` the auto-seeded `steps[0]`
directly, or (b) `DELETE` the default step before creating a
personalized one. Option (a) is simpler and is the recommended
approach. Tracked as a follow-up TODO in `generate.ts`.

**Field classifications (answers the "Joi vs player delta" question):**

| Field | Source | Required for player? |
|---|---|---|
| `name` | `[validated]` | yes |
| `content` (goes to disk as HTML file) | `[validated]` | read via `contentPath` |
| `imageData` (goes to S3 as PNG) | `[validated]` | served via `imageUrl` |
| `width`, `height` | `[validated]` | yes |
| `_id`, `createdAt`, `updatedAt`, `__v` | `[server-generated]` | read-only |
| `storyId`, `workspaceId`, `userId` | `[server-generated]` | joins/access |
| `type` (discriminator) | `[server-generated]` | yes — player mode |
| `index` | `[server-generated]` | yes — ordering |
| `imageUrl` | `[server-generated]` | **yes** — the player renders this |
| `contentPath` | `[server-generated]` | yes — HTML lookup |
| `steps` | `[server-gen default]` then client-patched | yes — tutorial tour |
| `customTransitions` | `[server-gen default `[]`]` | optional |

**Conclusion:** the Joi validator's 5 fields (`name, content, imageData,
width, height`) are the complete client-side contract. The MCP's
browser service must produce exactly those. Every other field is
server-generated and MUST NOT be sent.

---

## screens.steps[] (embedded ScreenStep subdoc)

Strict, timestamps on.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | auto | auto | each step has its own id even though embedded |
| `index` | Number | no | — | |
| `view.viewType` | String | no | `'hotspot'` | `'hotspot'`, `'pointer'`, `'popup'`, `'none'` |
| `view.pointer.selector` | String | no | `''` | CSS selector |
| `view.pointer.selectorLocation` | `{positionX,positionY,width,height}` | no | `{200,200,150,50}` | |
| `view.pointer.placement` | String | no | `'auto'` | |
| `view.hotspot.frameX` | Number | no | 200 | |
| `view.hotspot.frameY` | Number | no | 200 | |
| `view.hotspot.placement` | String | no | `'auto'` | |
| `view.popup.type` | String | no | `'popup'` | `'popup'`, `'form'`, `'start'`, `'iframe'` |
| `view.popup.formId` | ObjectId → `Form` | no | `null` | attached by `POST /workspaces/:ws/forms` when `type === 'step'` |
| `view.popup.showOverlay` | Boolean | no | `false` | |
| `view.popup.title` | String | no | `'Title'` | |
| `view.popup.description` | String | no | `'<p>Description</p>'` | HTML |
| `view.popup.alignment` | String | no | `'center'` | `'center'`, `'left'`, `'right'` |
| `view.popup.buttons[]` | [{index,text,gotoType,gotoWebsite,gotoScreen,textColor,backgroundColor}] | no | — | `gotoType`: `'screen'` \| `'website'` \| `'next'` \| `'none'` |
| `view.content` | String | no | `''` | |
| `view.nextButtonText` | String | no | `'Next'` | |
| `view.showStepNumbers` | Boolean | no | `true` | |
| `view.showHeader` | Boolean | no | `false` | |
| `view.showFooter` | Boolean | no | `false` | |
| `zoomSpan` | `ZoomSpanScreenshotSchema` subdoc | no | — | |
| `stepAudioId` | ObjectId → `Audio` | no | `null` | |
| `elementData.targetHTML` | String | no | `''` | |
| `elementData.targetElementType` | String | no | `'element'` | |
| `elementData.targetText` | String | no | `''` | |
| `autoPlayConfig.enabled` | Boolean | no | `false` | |
| `autoPlayConfig.type` | String | no | `'auto'` | `'auto'` or `'manual'` |
| `autoPlayConfig.delay` | Number | no | 2 | seconds |
| `action.actionType` | String | no | `'NextButton'` | `'NextButton'`, `'ElementClick'` |
| `action.selector` | String | no | `''` | |
| `createdAt`, `updatedAt` | Date | auto | — | |

**Default step seeded by `POST .../steps` with `viewType === 'popup'`** (from
`postSteps.js:596–626`):
```json
{
  "index": 0,
  "view": {
    "viewType": "popup",
    "content": "<p>New step</p>",
    "popup": {
      "type": "popup", "title": "Title", "description": "<p>Description</p>",
      "alignment": "center", "showOverlay": true,
      "buttons": [{"index":0, "text":"Next", "gotoType":"next", "gotoScreen":"<nextScreenId>"}]
    }
  }
}
```

---

## forms

Strict, timestamps on.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `index` | Number | no | — | |
| `type` | String | no | `''` | `'step'`, `'transition'`, `'hubspot'` |
| `fields[]` | `[{label, name, type, required, typeData}]` | no | `[]` | `type` default `'shortText'` |
| `hubspot.formId` | String | no | `''` | |
| `hubspot.portalId` | String | no | `''` | |
| `hubspot.embedVersion` | Number | no | `2` | |
| `title` | String | no | `'Get in touch with us'` | |
| `workspaceId` | ObjectId → `Workspace` | no | — | |
| `storyId` | ObjectId → `Story` | no | — | |
| `stepId` | ObjectId → `ScreenStep` | no | — | |
| `transitionId` | ObjectId → `ScreenTransition` | no | — | |
| `liveDemoId` | ObjectId → `LiveDemo` | no | — | |
| `screenId` | ObjectId → `Screen` | no | — | |
| `leads` | ObjectId → `Lead` | no | — | *singular in schema, but `postLeadsForm.js` uses `$push:{leads:...}` — likely a bug in the schema; treat as array in practice* |

---

## leads

Strict, timestamps on.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `formId` | ObjectId → `Form` | no | — | |
| `storyId` | ObjectId → `Story` | no | — | |
| `liveDemoId` | ObjectId → `LiveDemo` | no | — | |
| `screenId` | ObjectId → `screenId` (typo in ref — see Screens) | no | — | |
| `workspaceId` | ObjectId → `Workspace` | no | — | |
| `sessionId` | ObjectId → `Session` | no | — | |
| `data` | Object (free-form — the submitted form values) | no | — | |
| `createdAt`, `updatedAt` | Date | auto | — | |

---

## sessions

Strict, timestamps on.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `workspaceId` | ObjectId → `Workspace` | no | — | |
| `storyId` | ObjectId → `Story` | no | — | |
| `clientIpData` | Object (free-form: `{ip, country, city, region, flag.emoji, ...}`) | no | — | |
| `startTimestamp` | Number (ms epoch) | no | — | |
| `endTimestamp` | Number (ms epoch) | no | — | |
| `duration` | Number (ms) | no | — | |
| `eventsClickCount` | Number | no | `0` | |
| `stepsCount` | Number | no | — | |
| `dropOffStep` | Number | no | — | |
| `didPlay` | Boolean | no | `false` | |
| `didComplete` | Boolean | no | `false` | |
| `createdAt`, `updatedAt` | Date | auto | — | |

---

## sessionevents

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | yes | auto | |
| `eventData.type` | Number | no | — | rrweb event type |
| `eventData.data` | Object (free-form) | no | — | |
| `eventData.dataSource` | Number | no | — | |
| `eventData.dataType` | Number | no | — | |
| `eventData.timestamp` | Number | no | — | |
| `stepIndex` | Number | no | `0` | |
| `sessionId` | ObjectId → `Session` | no | — | |
| `workspaceId` | ObjectId → `Workspace` | no | — | |
| `storyId` | ObjectId → `Story` | no | — | |

---

## links

Strict, timestamps on. **`_id` is a String** (short-uuid), NOT ObjectId.

| Field | BSON Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | String | yes | `short.generate()` | e.g. `"abc12def-345"` |
| `name` | String | no | — | |
| `workspaceId` | ObjectId → `Workspace` | no | — | |
| `storyId` | ObjectId → `Story` | no | — | |
| `variables[]` | `[{name, value}]` | no | — | |

---

## livedemos + publishedlivedemos

Both strict, timestamps on. `livedemos` represents a rendered demo instance;
`publishedlivedemos` the public URL routing record.

| Collection | Key fields |
|---|---|
| `livedemos` | `_id`, `name`, `url`, `workspaceId`, `status` (`'populated'`/`'updating'`), `path`, `sessionRecordingId`, `publishedLiveDemoId` → `PublishedLiveDemo`, `requests[]`, `firstDoc`, `manifest`, `localStorage`, `cookies`, `visible`, `scripts[]`, `tours[]` |
| `publishedlivedemos` | `_id`, `url`, `workspaceId`, `path`, `liveDemoId` |

---

## Collection counts captured at discovery time

Before bootstrap (from a prior partial probe):
- 0 users, 0 workspaces, 0 stories, 0 screens, 0 publishedlivedemos (empty DB).

After bootstrap:
- `users`: 1 (`mcp@deltakinetics.io`, `_id = 69ea6d7d10a3c3c5d93195b3`)
- `workspaces`: **3** — one auto-created by signup (`"DK's workspace"`), one
  created during a prior bootstrap attempt (`"Delta Kinetics"`), and one
  created during Phase 0 of this session (`"DK CoreTAP Demos"`,
  `_id = 69ea79a8d7a9e7a66f4a784c`, use this one).
- `authtokens`: at least 1 active (token `2a163442...e1d0d2`). Earlier
  attempts may have left additional active tokens for the same user.
- `stories`, `screens`, `forms`, `leads`, `sessions`: **0** as of bootstrap
  completion.

After Strategy C Phase 1 probe (2026-04-24):
- `users`: 1 (unchanged)
- `workspaces`: 3 (unchanged)
- `authtokens`: **5** (4 new tokens issued during probe/test flows)
- `stories`: **3** — includes `discovery-probe-v2` (`_id = 69eab570d1622a2b258fc350`),
  an empty story left published for reference.
- `links`: 0 → 1 (one story link created for probe story)
- `screens`, `forms`, `leads`, `sessions`, `publishedlivedemos`, `livedemos`:
  **still 0** (screen creation blocked by S3 auth failure — see STILL UNVERIFIED
  note in §screens above)

After Strategy C Phase 1 follow-up probe (2026-04-24, discovery-probe-v3,
run against patched backend `ghcr.io/matty-1337/dk-livedemo-backend:v1`
with DK-owned S3 bucket live):

- `stories`: 3 → **5** (probe-v3 added `discovery-probe-v3` story id `69ead984bd17ad58c2117777`)
- `screens`: 0 → **2** (two probe screens; first live populated-shape capture)
- `links`: 1 → **2**
- `authtokens`: 5 → **6** (probe-v3 auth)
- `publishedlivedemos`, `livedemos`: **still 0** (see next §)

---

## Verification status

✓ **Indexes for every collection of interest — verified live 2026-04-24.**
Captured via `db.<name>.indexes()` inside the livedemo-backend container.
Results inlined in the relevant sections above; full dump in
`discovery-log.md` §Phase-4-followup. Short version:

| Collection | Non-default indexes |
|---|---|
| `users` | `email_1` **unique** |
| `authtokens` | `token_1` **unique**, **no TTL** |
| `cursorpositions` | `storyId_1` |
| everything else | none beyond `_id_` |

✓ **Legacy/unused collections — verified empty.** Both `steps` and
`screensteps` collections exist in Mongo but both have count 0. Source
code (`postSteps.js`, `patchStep.js`) writes only to `screens.$.steps[]`
embedded subdocs. The separate collections are vestigial and can be
ignored — no code path reads or writes them.

✓ **Populated `screens.findOne()` — verified live 2026-04-24.** Full doc
shape + field classifications captured in §screens above. The patched
backend image successfully uploaded two screens to
`dk-livedemo-cdn.s3.us-east-1.amazonaws.com/story-images/*`.

⚠ **STILL UNVERIFIED — `publishedlivedemos` population trigger.** Even
with real screens, publishing the story did NOT populate
`publishedlivedemos` or `livedemos` (both count=0 three seconds after
`POST /publish`). The public URL
`https://demo.deltakinetics.io/livedemos/69ead984bd17ad58c2117777`
nevertheless returns 200 — the frontend player reads directly from
`stories.screens` + `screens.imageUrl`, not from `publishedlivedemos`.

**Revised hypothesis:** `publishedlivedemos` and `livedemos` are NOT
populated by `/publish` at all. They're used by a different feature
— likely embedded/iframed demos served at a different URL pattern
(`/l/<shortId>`? or a legacy livedemo player). Until we need that
feature, treat both collections as inert. When we do need it, trace the
population path by grep-ing source for `PublishedLiveDemo.create` /
`LiveDemo.create`.

Closed: what we care about for Strategy C — screens visible on the
public demo URL — works via `/publish` alone.
the insertion trigger and the final row shape.
