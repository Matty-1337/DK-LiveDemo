// Infisical credential loader.
//
// Strategy C §2.5 calls for a service token that's:
//   - read-only
//   - prod env only
//   - path-scoped to CORETAP_*, ATLASTAP_*, LIVEDEMO_*
//
// This module fetches every secret once at boot, caches in memory, and
// refreshes every REFRESH_INTERVAL_MS. Secrets are served via getSecret().
//
// If @infisical/sdk is unavailable or auth fails, we fall back to reading
// process.env — that keeps local dev workable without a service token.
//
// NOTE: the SDK surface has churned across versions. This module handles
// the current export (InfisicalSDK class with .auth().accessToken and
// .secrets().listSecrets). Adjust if the SDK ships a breaking change.

import { log } from './logger.js';

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

interface SecretMap {
  [k: string]: string;
}

interface InfisicalState {
  secrets: SecretMap;
  loadedAt: number | null;
  source: 'infisical' | 'env';
}

const state: InfisicalState = {
  secrets: {},
  loadedAt: null,
  source: 'env',
};

function getEnv(name: string): string | undefined {
  return process.env[name];
}

async function loadFromInfisical(): Promise<SecretMap | null> {
  // Two auth paths — the runtime picks whichever set of vars is populated:
  //   (A) Win32-style universal-auth: INFISICAL_UNIVERSAL_AUTH_CLIENT_ID +
  //       INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET. Recommended on this host.
  //   (B) Pre-minted access token: INFISICAL_TOKEN. Useful in CI.
  // Either way, we also need INFISICAL_PROJECT_ID and INFISICAL_API_URL
  // (alias INFISICAL_HOST for legacy compatibility).
  const token = getEnv('INFISICAL_TOKEN');
  const clientId = getEnv('INFISICAL_UNIVERSAL_AUTH_CLIENT_ID');
  const clientSecret = getEnv('INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET');
  const projectId = getEnv('INFISICAL_PROJECT_ID');
  const env = getEnv('INFISICAL_ENV') ?? 'prod';
  const host = getEnv('INFISICAL_API_URL') ?? getEnv('INFISICAL_HOST');

  const havePathA = !!(clientId && clientSecret);
  const havePathB = !!token;
  if ((!havePathA && !havePathB) || !projectId || !host) {
    log.warn('infisical: missing auth (need universal-auth client_id+secret OR access token) and PROJECT_ID + API_URL/HOST — falling back to process.env');
    return null;
  }

  try {
    const mod = (await import('@infisical/sdk').catch(() => null)) as unknown as {
      InfisicalSDK?: new (opts: { siteUrl: string }) => InfisicalSDKLike;
    } | null;

    if (!mod || !mod.InfisicalSDK) {
      log.warn('infisical: @infisical/sdk not installed or shape changed; falling back to process.env');
      return null;
    }
    const siteUrl = host.startsWith('http') ? host : `https://${host}`;
    const client = new mod.InfisicalSDK({ siteUrl });
    await authenticate(client, { clientId, clientSecret, token });

    const list = await client.secrets().listSecrets({
      projectId,
      environment: env,
    });

    const map: SecretMap = {};
    for (const s of list.secrets ?? []) map[s.secretKey] = s.secretValue;
    log.info('infisical: loaded secrets', {
      count: Object.keys(map).length,
      env,
      authMethod: havePathA ? 'universal-auth' : 'access-token',
    });
    return map;
  } catch (err) {
    log.warn('infisical: load failed, falling back to process.env', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

interface InfisicalSDKLike {
  auth: () => {
    accessToken?: (t: string) => Promise<unknown> | unknown;
    universalAuth?: { login: (a: { clientId: string; clientSecret: string }) => Promise<unknown> };
  };
  secrets: () => {
    listSecrets: (o: { projectId: string; environment: string }) => Promise<{ secrets: Array<{ secretKey: string; secretValue: string }> }>;
  };
}

async function authenticate(
  client: InfisicalSDKLike,
  creds: { clientId?: string; clientSecret?: string; token?: string },
): Promise<void> {
  const auth = client.auth();
  // Prefer universal-auth (the Win32-style flow) when credentials are present.
  if (creds.clientId && creds.clientSecret && auth.universalAuth) {
    await auth.universalAuth.login({ clientId: creds.clientId, clientSecret: creds.clientSecret });
    return;
  }
  // Fall back to access token.
  if (creds.token && typeof auth.accessToken === 'function') {
    await auth.accessToken(creds.token);
    return;
  }
  throw new Error('infisical: no compatible auth method on SDK for the credentials provided');
}

export async function loadSecrets(): Promise<void> {
  const infis = await loadFromInfisical();
  if (infis) {
    state.secrets = infis;
    state.source = 'infisical';
  } else {
    // Fallback: capture everything currently in process.env matching the
    // allowed prefixes so getSecret() can serve synchronously.
    const map: SecretMap = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (!v) continue;
      if (/^(CORETAP|ATLASTAP|LIVEDEMO)_/.test(k)) map[k] = v;
    }
    state.secrets = map;
    state.source = 'env';
  }
  state.loadedAt = Date.now();
}

export function getSecret(key: string): string | undefined {
  return state.secrets[key];
}

export function requireSecret(key: string): string {
  const v = getSecret(key);
  if (!v) throw new Error(`Missing secret ${key} (source=${state.source})`);
  return v;
}

export function secretsStatus(): { loadedAt: number | null; source: string; count: number } {
  return { loadedAt: state.loadedAt, source: state.source, count: Object.keys(state.secrets).length };
}

// Background refresh loop — call once after initial loadSecrets()
export function startRefreshLoop(): NodeJS.Timeout {
  return setInterval(() => {
    loadSecrets().catch((e) =>
      log.error('infisical: refresh failed', { error: e instanceof Error ? e.message : String(e) }),
    );
  }, REFRESH_INTERVAL_MS);
}
