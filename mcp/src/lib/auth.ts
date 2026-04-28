// Lazy re-auth helper. The upstream issues long-lived opaque tokens (see
// docs/auth-model.md). On a 401 we re-run /users/password-authenticate
// using the bot-account credentials from env, swap the in-memory token,
// and let the caller retry once.

import axios, { AxiosInstance } from 'axios';
import type { AuthResponse } from '../types/upstream.js';

export interface AuthState {
  token: string;
  userId: string | null;
  refreshedAt: number | null; // ms epoch of most recent refresh
}

const DEFAULT_EMAIL = 'mcp@deltakinetics.io';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export async function authenticate(baseURL: string): Promise<AuthResponse> {
  const email = process.env.LIVEDEMO_MCP_EMAIL ?? DEFAULT_EMAIL;
  const password = requireEnv('LIVEDEMO_MCP_PASSWORD');
  const http: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });
  const res = await http.post<AuthResponse>('/users/password-authenticate', { email, password });
  if (!res.data?.token) {
    throw new Error('Upstream /users/password-authenticate did not return a token field');
  }
  return res.data;
}

export function initialAuthState(): AuthState {
  return {
    token: process.env.LIVEDEMO_API_TOKEN ?? '',
    userId: null,
    refreshedAt: null,
  };
}
