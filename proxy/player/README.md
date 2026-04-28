# DK Player

Static React SPA that renders Delta Kinetics live demos. Built once with
Vite; colocated under `proxy/player/` so Railway can build with service
Root Directory = `proxy`. See `docs/player.md` for architecture and theming.

## Local dev

```bash
npm install
npm run dev
```

From this directory: Vite runs on `http://localhost:5173` and proxies `/api/*` to
`https://demo.deltakinetics.io`. Open `http://localhost:5173/livedemos/<storyId>`.

## Build

```bash
npm run build
```

Outputs to `dist/`. The multi-stage [`../Dockerfile`](../Dockerfile) runs this
inside Docker; local image build from repo root:

```bash
docker build -f proxy/Dockerfile proxy
```
