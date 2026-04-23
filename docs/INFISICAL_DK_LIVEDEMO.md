# Infisical project `dk-livedemo`

Create the project in the Infisical UI (or your self-hosted instance) with environments **`dev`** and **`prod`**.

## Production (`prod`) — mirror into Railway

Use these **names**; values show what was set on Railway for DK-LiveDemo (replace `OPENAI_API_KEY` / `STRIPE_SECRET_KEY` with real keys from your vault — never commit them).

| Secret | Value / note |
|--------|----------------|
| `OPENAI_API_KEY` | Your OpenAI key |
| `STRIPE_SECRET_KEY` | Your Stripe `sk_test_` or live key |
| `PRIVATE_AUTH_TOKEN` | Generate with `openssl rand -hex 32`; must match Railway `livedemo-backend` |
| `MCP_AUTH_TOKEN` | Generate with `openssl rand -hex 32`; must match Railway `livedemo-mcp` |
| `MONGO_URI` | `mongodb://livedemo-mongo.railway.internal:27017/livedemo_app` |
| `LIVEDEMO_API_URL` | `http://livedemo-backend.railway.internal:3005` |
| `LIVEDEMO_API_TOKEN` | Same as `PRIVATE_AUTH_TOKEN` |
| `SERVER_URL` | `https://livedemo-proxy-production.up.railway.app` |
| `APP_URL` | `https://livedemo-proxy-production.up.railway.app` |
| `API_URL` | `https://livedemo-proxy-production.up.railway.app` |
| `MCP_PUBLIC_URL` | `https://livedemo-mcp-production.up.railway.app` |
| `LANDING_URL` | Optional: public marketing URL |

## Sync to Railway (after `infisical login`)

```bash
# Example: push prod secrets to a service (repeat per service with appropriate subset)
infisical export --env prod --format dotenv --path / 2>/dev/null | railway variables set -s livedemo-backend --service ...
```

Use the Infisical → Railway integration if enabled, or export per service manually.

## Local `dev`

Copy the same structure; use `LIVEDEMO_API_URL=http://localhost:3005`, local tokens, and `MONGO_URI` pointing at your Docker `mongo` service for `infisical run --env dev -- docker compose -f local/docker-compose.yml up`.
