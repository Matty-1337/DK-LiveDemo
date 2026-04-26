# DK Player

Static React SPA that renders Delta Kinetics live demos. Built once with
Vite, served by Caddy from `proxy/` in this monorepo. See `docs/player.md`
for architecture and theming.

## Local dev

```bash
npm install
npm run dev
```

Vite dev server runs on `http://localhost:5173` and proxies `/api/*` to
`https://demo.deltakinetics.io` so you can render real demos without
running the backend locally. Open
`http://localhost:5173/livedemos/<storyId>` to render a real story.

## Build

```bash
npm run build
```

Outputs to `dist/`. The repo-root `proxy/Dockerfile` consumes this in a
multi-stage build.
