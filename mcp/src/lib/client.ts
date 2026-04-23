// LiveDemo upstream HTTP client. Rewritten against the verified route
// surface in docs/upstream-api.md. Every call targets a real route.
//
// Auth model (see docs/auth-model.md):
//   - Authorization: Bearer <LIVEDEMO_API_TOKEN>
//   - On 401: re-authenticate with LIVEDEMO_MCP_EMAIL/PASSWORD, swap the
//     in-memory token, retry the original request once. Do NOT persist the
//     new token — tokens are long-lived and the deployment pipeline owns
//     persistence.
//
// Error conventions (see docs/upstream-api.md "Error shapes"):
//   - 401 is unambiguous "unauthorized"; everything else must be read via
//     response.data. Validation errors come back as 500 with the validation
//     payload in the body. Workspace access denied comes back as 500 with
//     {"error": "..."}.

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  isAxiosError,
} from 'axios';
import {
  AuthState,
  authenticate,
  initialAuthState,
} from './auth.js';
import type {
  CreateEmptyStoryRequest,
  CreateEmptyStoryResponse,
  CreateFormRequest,
  CreateLinkRequest,
  CreateScreenRequest,
  CreateStepRequest,
  CreateWorkspaceResponse,
  Form,
  Lead,
  ObjectIdString,
  PatchFormRequest,
  PatchStepRequest,
  PublishRequest,
  Screen,
  ScreenStep,
  SessionsResponse,
  Story,
  StoryLink,
  Workspace,
} from '../types/upstream.js';

export interface ApiErrorPayload {
  status: number;
  message: string;
  data?: unknown;
  route?: string;
}

export class LiveDemoApiError extends Error {
  status: number;
  data?: unknown;
  route?: string;
  constructor(p: ApiErrorPayload) {
    super(`[LiveDemo ${p.status}${p.route ? ' ' + p.route : ''}] ${p.message}`);
    this.name = 'LiveDemoApiError';
    this.status = p.status;
    this.data = p.data;
    this.route = p.route;
  }
}

const DEFAULT_BASE_URL = 'http://livedemo-backend.railway.internal:3005';

export class LiveDemoClient {
  private http: AxiosInstance;
  private readonly baseURL: string;
  private state: AuthState;
  private refreshing: Promise<void> | null = null;

  constructor(baseURL?: string, token?: string) {
    this.baseURL = baseURL ?? process.env.LIVEDEMO_API_URL ?? DEFAULT_BASE_URL;
    this.state = initialAuthState();
    if (token) this.state.token = token;
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
      // Inspect every status; we handle validation-as-500 ourselves.
      validateStatus: () => true,
    });
  }

  /* ---------------- Internal request plumbing ---------------- */

  private authHeaders(): Record<string, string> {
    return this.state.token ? { Authorization: `Bearer ${this.state.token}` } : {};
  }

  private async refreshToken(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const authRes = await authenticate(this.baseURL);
      this.state = {
        token: authRes.token,
        userId: authRes.id,
        refreshedAt: Date.now(),
      };
    })();
    try {
      await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  private async raw<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.http.request<T>({
        ...config,
        headers: { ...this.authHeaders(), ...(config.headers ?? {}) },
      });
    } catch (err: unknown) {
      if (isAxiosError(err) && !err.response) {
        // Network / timeout — surface as 0-status LiveDemoApiError
        throw new LiveDemoApiError({
          status: 0,
          message: err.message || 'Network error',
          route: `${config.method ?? 'GET'} ${config.url ?? ''}`,
        });
      }
      throw err;
    }
  }

  private async request<T>(config: AxiosRequestConfig, allowRetry = true): Promise<T> {
    const res = await this.raw<T>(config);
    if (res.status === 401 && allowRetry) {
      // Only path the upstream uses for "unauthorized" — see docs/auth-model.md
      await this.refreshToken();
      return this.request<T>(config, false);
    }
    if (res.status >= 200 && res.status < 300) return res.data;

    // Everything else: surface structured error. Read response.data — the
    // backend puts validation failures and access-denied messages here.
    const data = res.data as unknown;
    const msg =
      (typeof data === 'object' && data && 'error' in (data as Record<string, unknown>)
        ? String((data as { error: unknown }).error)
        : undefined) ||
      (typeof data === 'object' && data && 'message' in (data as Record<string, unknown>)
        ? String((data as { message: unknown }).message)
        : undefined) ||
      (typeof data === 'string' && data) ||
      `HTTP ${res.status}`;
    throw new LiveDemoApiError({
      status: res.status,
      message: msg,
      data,
      route: `${config.method ?? 'GET'} ${config.url ?? ''}`,
    });
  }

  /* ---------------- Auth ---------------- */

  /** Force a token refresh. Returns the new token. */
  async reauthenticate(): Promise<string> {
    await this.refreshToken();
    return this.state.token;
  }

  get token(): string {
    return this.state.token;
  }

  /* ---------------- Workspaces ---------------- */

  listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>({ method: 'GET', url: '/workspaces' });
  }

  getWorkspace(workspaceId: ObjectIdString): Promise<Workspace> {
    return this.request<Workspace>({ method: 'GET', url: `/workspaces/${encodeURIComponent(workspaceId)}` });
  }

  createWorkspace(name: string): Promise<CreateWorkspaceResponse> {
    return this.request<CreateWorkspaceResponse>({ method: 'POST', url: '/workspaces', data: { name } });
  }

  /* ---------------- Stories ---------------- */

  listStories(workspaceId: ObjectIdString): Promise<Story[]> {
    return this.request<Story[]>({
      method: 'GET',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/stories`,
    });
  }

  getStory(workspaceId: ObjectIdString, storyId: ObjectIdString): Promise<Story> {
    return this.request<Story>({
      method: 'GET',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/stories/${encodeURIComponent(storyId)}`,
    });
  }

  /** Create an empty story (no screens). */
  createEmptyStory(body: CreateEmptyStoryRequest): Promise<CreateEmptyStoryResponse> {
    return this.request<CreateEmptyStoryResponse>({
      method: 'POST',
      url: '/emptyStory',
      data: body,
    });
  }

  /** Soft-delete a story (sets deletedAt). Returns the updated doc. */
  deleteStory(workspaceId: ObjectIdString, storyId: ObjectIdString): Promise<Story> {
    return this.request<Story>({
      method: 'DELETE',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/stories/${encodeURIComponent(storyId)}`,
    });
  }

  publishStory(
    workspaceId: ObjectIdString,
    storyId: ObjectIdString,
    body: PublishRequest,
  ): Promise<Story> {
    return this.request<Story>({
      method: 'POST',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/stories/${encodeURIComponent(storyId)}/publish`,
      data: body,
    });
  }

  /* ---------------- Screens ---------------- */

  /**
   * Create a screen (Screen_Page) in a story.
   * Requires backend AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY to be set —
   * the handler uploads imageData (base64 PNG) to S3 and writes content
   * HTML to disk under STORIES_FOLDER.
   */
  createScreen(
    workspaceId: ObjectIdString,
    storyId: ObjectIdString,
    body: CreateScreenRequest,
  ): Promise<Screen> {
    return this.request<Screen>({
      method: 'POST',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/stories/${encodeURIComponent(storyId)}/screens`,
      data: body,
    });
  }

  /* ---------------- Steps (embedded in screens) ---------------- */

  createStep(
    workspaceId: ObjectIdString,
    storyId: ObjectIdString,
    screenId: ObjectIdString,
    body: CreateStepRequest,
  ): Promise<ScreenStep> {
    return this.request<ScreenStep>({
      method: 'POST',
      url:
        `/workspaces/${encodeURIComponent(workspaceId)}` +
        `/stories/${encodeURIComponent(storyId)}` +
        `/screens/${encodeURIComponent(screenId)}/steps`,
      data: body,
    });
  }

  patchStep(
    workspaceId: ObjectIdString,
    storyId: ObjectIdString,
    screenId: ObjectIdString,
    stepId: ObjectIdString,
    body: PatchStepRequest,
  ): Promise<Screen> {
    return this.request<Screen>({
      method: 'PATCH',
      url:
        `/workspaces/${encodeURIComponent(workspaceId)}` +
        `/stories/${encodeURIComponent(storyId)}` +
        `/screens/${encodeURIComponent(screenId)}` +
        `/steps/${encodeURIComponent(stepId)}`,
      data: body,
    });
  }

  deleteStep(
    workspaceId: ObjectIdString,
    storyId: ObjectIdString,
    screenId: ObjectIdString,
    stepId: ObjectIdString,
  ): Promise<Record<string, never>> {
    return this.request<Record<string, never>>({
      method: 'DELETE',
      url:
        `/workspaces/${encodeURIComponent(workspaceId)}` +
        `/stories/${encodeURIComponent(storyId)}` +
        `/screens/${encodeURIComponent(screenId)}` +
        `/steps/${encodeURIComponent(stepId)}`,
    });
  }

  /* ---------------- Forms ---------------- */

  createForm(workspaceId: ObjectIdString, body: CreateFormRequest): Promise<Form> {
    return this.request<Form>({
      method: 'POST',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/forms`,
      data: body,
    });
  }

  patchForm(
    workspaceId: ObjectIdString,
    formId: ObjectIdString,
    body: PatchFormRequest,
  ): Promise<Form> {
    return this.request<Form>({
      method: 'PATCH',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/forms/${encodeURIComponent(formId)}`,
      data: body,
    });
  }

  /* ---------------- Story links ---------------- */

  createStoryLink(
    workspaceId: ObjectIdString,
    storyId: ObjectIdString,
    body: CreateLinkRequest = {},
  ): Promise<StoryLink> {
    return this.request<StoryLink>({
      method: 'POST',
      url:
        `/workspaces/${encodeURIComponent(workspaceId)}` +
        `/stories/${encodeURIComponent(storyId)}/links`,
      data: body,
    });
  }

  listStoryLinks(workspaceId: ObjectIdString, storyId: ObjectIdString): Promise<StoryLink[]> {
    return this.request<StoryLink[]>({
      method: 'GET',
      url:
        `/workspaces/${encodeURIComponent(workspaceId)}` +
        `/stories/${encodeURIComponent(storyId)}/links`,
    });
  }

  /* ---------------- Analytics ---------------- */

  getWorkspaceSessions(
    workspaceId: ObjectIdString,
    params: { viewType?: '48H' | '7D' | '30D'; limit?: number; page?: number } = {},
  ): Promise<SessionsResponse> {
    return this.request<SessionsResponse>({
      method: 'GET',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/sessions`,
      params: { viewType: params.viewType ?? '30D', limit: params.limit ?? 10, page: params.page ?? 1 },
    });
  }

  getWorkspaceLeads(
    workspaceId: ObjectIdString,
    viewType: '48H' | '7D' | '30D' = '30D',
  ): Promise<Lead[]> {
    return this.request<Lead[]>({
      method: 'GET',
      url: `/workspaces/${encodeURIComponent(workspaceId)}/leads`,
      params: { viewType },
    });
  }
}

// Singleton for tool handlers. Lazy-init so env is available when instantiated.
let _client: LiveDemoClient | null = null;
export function getClient(): LiveDemoClient {
  if (!_client) _client = new LiveDemoClient();
  return _client;
}

// For tests — reset the singleton.
export function __resetClient(): void {
  _client = null;
}

export { isAxiosError };
export type { AxiosError };
