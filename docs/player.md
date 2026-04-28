# DK Player

Static React SPA that renders Delta Kinetics live demos. Built once with
Vite; sources live in `proxy/player/` and ship inside the `livedemo-proxy` image.

---

## Architecture

```
Prospect (browser)
      │
      ▼
demo.deltakinetics.io          (Caddy in livedemo-proxy)
      │
      ├──► /livedemos/:storyId   →  static SPA (index.html + /assets/*)
      │       react-router → <Player storyId={…}>
      │       calls /api/v1/demos/:storyId
      │
      └──► /api/v1/demos/:id     →  reverse_proxy livedemo-backend:3005
                                    rewrites to /preview/:id
                                    (public 🌐 route, no auth)
                                       │
                                       ▼
                                    Mongo `stories` doc with populated
                                    screens[] and steps[] (popup payload)
```

The player is **static**. Zero Node runtime, zero ongoing compute cost
beyond Caddy. Every visitor request to `/livedemos/*` gets the same
~180KB bundle from disk; the only dynamic request is the JSON fetch.

---

## How rendering works

1. `<App>` (`src/App.tsx`) mounts `<BrowserRouter>` and matches
   `/livedemos/:storyId` to `<Player>`.
2. `<Player>` (`src/Player.tsx`) calls `fetchDemo(storyId)` from
   `src/lib/api.ts` → `GET /api/v1/demos/:storyId`.
3. The response is a `Story` (see `src/lib/types.ts` — mirrors the
   upstream Mongo schema documented in `docs/upstream-data-model.md`).
   Screens are sorted by `index`.
4. `<Player>` keeps a `current` index in state, renders one
   `<ScreenCanvas>` for `screens[current]`.
5. `<ScreenCanvas>` renders `screen.imageUrl` as a full-bleed background
   and overlays a `<Popup>` for `screen.steps[0]` (the seeded popup the
   personalizer fills in — see "auto-seeded default step" in
   `docs/upstream-data-model.md`).
6. `<Popup>` renders `popup.title` (gradient text), `popup.description`
   (sanitized HTML from the personalizer — `dangerouslySetInnerHTML`),
   and the popup's primary button. Button behaviour:
   - `gotoType === 'website'` → external link in a new tab (this is the
     final-screen CTA, e.g. cal.com/matty-dk).
   - `'next' | 'screen' | 'none'` → advance to the next screen.
7. `<Navigation>` (bottom-center floating bar) shows ← Prev / progress
   dots / Next →. Keyboard nav: ←/→/space.

---

## How to add a feature

1. Add the component to `src/components/`.
2. Wire it into `<Player>` or `<ScreenCanvas>` as needed.
3. Style with the CSS variables in `src/styles/tokens.css`. **Do not
   hardcode colors, fonts, or radii** — anything one-off goes through a
   token first.
4. `npm run build` and inspect bundle size. Budget: keep the gzipped JS
   under 100KB. Currently ~56KB.
5. Push to git; Railway builds `proxy/Dockerfile` with context `proxy/`.

---

## How to theme

`src/styles/tokens.css` is the single source of truth. The DK brand
palette lives there as CSS variables:

- `--dk-bg`, `--dk-bg-elevated`, `--dk-surface`
- `--dk-cyan`, `--dk-magenta`, `--dk-gradient` (the canonical 90deg cyan→blue
  gradient used on titles)
- `--dk-text-primary`, `--dk-text-secondary`, `--dk-text-muted`
- `--dk-radius`, `--dk-radius-lg`, `--dk-shadow`, `--dk-shadow-popup`
- `--dk-font-sans`, `--dk-font-mono`

To re-skin the player for a non-DK product, change those variables only.
No component reaches around them.

`src/lib/theme.ts` mirrors the same tokens as a TS object for the rare
case a component needs a token at runtime.

---

## Local dev

```bash
cd proxy/player
npm install
npm run dev   # http://localhost:5173
```

Vite proxies `/api/*` to `https://demo.deltakinetics.io` (configured in
`vite.config.ts`), so you can render real demos against production data
without running the backend locally:

```
http://localhost:5173/livedemos/<storyId>
```

---

## Deploy

Deploy by pushing to `main` or your feature branch: Railway builds
[`proxy/Dockerfile`](../proxy/Dockerfile) with Docker context **`proxy/`**
(see [`railway.toml`](../railway.toml)). The image runs `npm run build` in
`proxy/player` during the Docker build — no separate `railway up` step.

---

## TODO: bump capture resolution

The browser service (`/browser`) currently captures screens at
**1280×800**. The desktop player is now full-bleed, so on 1920+ displays
those captures are upscaled and look slightly soft. Mitigated for now
with `image-rendering: crisp-edges` on `.dk-canvas__bg`, but the real
fix is to capture at native desktop resolution (e.g. 1920×1200) in the
Playwright viewport config. Deferred because it requires regenerating
existing demos.

---

## What's intentionally not here

- **No auth, no editor, no recording UI.** This player only renders
  published demos. Demo creation and editing happen via the MCP
  (`livedemo-mcp`), not the player.
- **No analytics in v1.** Lead capture, view tracking, and session
  events still flow through the backend's existing endpoints if/when
  we want to wire them up — none of that was in scope for replacing
  the upstream player.
- **No SSR.** Static SPA. SEO/social previews use static OG tags from
  `index.html` plus a runtime `og:image` update once the demo loads.
