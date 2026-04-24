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

> ⚠ STILL UNVERIFIED — **populated screens.findOne() live capture**.
> Attempted this session (2026-04-24, Strategy C phase 1) via direct
> `POST /emptyStory` + `POST /screens` with a 1×1 placeholder PNG. Story
> was created (ID `69eab570d1622a2b258fc350`, confirmed in Mongo) but
> every `POST /screens` call returned 500 with backend log
> `AuthorizationHeaderMalformed` — the S3 `uploadImage()` helper couldn't
> authenticate to S3 before writing any Mongo doc. **The backend's
> AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are broken or stale.**
>
> As a result `db.screens.count() == 0` — the collection holds zero docs,
> so no live shape can be captured. The source-derived schema above is
> the best we have until the S3 creds are rotated. See
> `discovery-log.md` §Phase-4-followup and `docs/troubleshooting.md`.
>
> To resume once AWS creds are fixed:
> ```
> railway service livedemo-backend
> railway ssh "echo '$(base64 -w0 scripts/probe-v2.js)' | base64 -d | node"
> # → full POST /screens round-trip succeeds, dumps Mongo shape
> ```

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

⚠ **STILL UNVERIFIED — populated `screens.findOne()`.** Blocked by
broken AWS S3 credentials on `livedemo-backend`. See the "STILL
UNVERIFIED" note inside §screens above, plus
`docs/troubleshooting.md` §"Screen capture returns 500 /
AuthorizationHeaderMalformed". Resolve the S3 creds, re-run
`scripts/probe-v2.js`, and the source-derived schema above will be
cross-checked against a live doc.

⚠ **STILL UNVERIFIED — `publishedlivedemos` population trigger.** The
probe published an empty story (0 screens) and `publishedlivedemos`
remained count=0 three seconds after. This is expected (nothing to
publish without screens), but we have not yet seen a populated row.
Once the S3 creds are fixed and a story-with-screens is published,
re-check `publishedlivedemos.findOne({storyId: <probe>})` to confirm
the insertion trigger and the final row shape.
