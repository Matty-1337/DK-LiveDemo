// HTTP client for the livedemo-browser capture service.
//
// Deployment contract (Strategy C §1):
//   - Service URL: http://livedemo-browser.railway.internal:3200
//   - Internal-only, no public domain
//   - Endpoints: GET /health, GET /ready, POST /capture
//
// This client is typed against the request/response shapes the
// livedemo-browser service will implement in Phase 3. It's safe to wire
// up now — tools that use it will error predictably if the service is
// not yet deployed.

import axios, { AxiosInstance, isAxiosError } from 'axios';

const DEFAULT_BASE_URL = 'http://livedemo-browser.railway.internal:3200';

export interface NavigationStep {
  /** Path relative to the product's baseUrl, e.g. "/dashboard?view=revenue". */
  path: string;
  /** Either "networkidle" or a CSS selector to await. Default "networkidle". */
  waitFor?: 'networkidle' | string;
  /** Optional selector list to hide at capture time (toasts, clocks, etc). */
  hideSelectors?: string[];
  /** Free-form note for logs. */
  note?: string;
}

export interface CaptureRequest {
  /** Which product — drives authFn selection inside browser service. */
  product: string;
  /** Module identifier — for logging/telemetry only. */
  module: string;
  /** Navigation plan, in order. One capture per step. */
  navigationPlan: NavigationStep[];
  /** Soft ceiling, seconds. Server also has a hard ceiling. */
  timeoutSeconds?: number;
}

export interface CapturedScreen {
  /** Full HTML page source at capture time. Feeds POST /screens.content. */
  html: string;
  /** Base64-encoded PNG. Feeds POST /screens.imageData. */
  pngBase64: string;
  /** Viewport width in px. */
  width: number;
  /** Viewport height in px. */
  height: number;
  /** document.title at capture time. Used for screen.name. */
  pageTitle: string;
  /** ISO-8601 timestamp. */
  capturedAt: string;
  /** The nav step that produced this screen, for debugging. */
  source: { path: string; note?: string };
}

export interface CaptureResponse {
  ok: true;
  product: string;
  module: string;
  screens: CapturedScreen[];
  timings: {
    authMs: number;
    perScreenMs: number[];
    totalMs: number;
  };
}

export interface CaptureErrorResponse {
  ok: false;
  phase: 'auth' | 'navigate' | 'screenshot' | 'pool-exhausted' | 'timeout' | 'unknown';
  product: string;
  module: string;
  message: string;
  capturedBeforeFail?: number;
}

export class BrowserClientError extends Error {
  phase: string;
  status: number;
  constructor(phase: string, message: string, status: number) {
    super(`[browser ${status} ${phase}] ${message}`);
    this.name = 'BrowserClientError';
    this.phase = phase;
    this.status = status;
  }
}

export class BrowserClient {
  private http: AxiosInstance;
  private readonly baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL ?? process.env.LIVEDEMO_BROWSER_URL ?? DEFAULT_BASE_URL;
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 90_000, // total client-side ceiling; server enforces its own
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  }

  async health(): Promise<{ ok: boolean }> {
    const res = await this.http.get('/health');
    return { ok: res.status === 200 && !!res.data?.ok };
  }

  async ready(): Promise<{ ready: boolean; poolSize?: number; targetSize?: number }> {
    const res = await this.http.get('/ready');
    if (res.status !== 200) return { ready: false };
    return {
      ready: !!res.data?.ready,
      poolSize: res.data?.poolSize,
      targetSize: res.data?.targetSize,
    };
  }

  async capture(req: CaptureRequest): Promise<CaptureResponse> {
    try {
      const res = await this.http.post<CaptureResponse | CaptureErrorResponse>('/capture', req);
      if (res.status >= 200 && res.status < 300 && (res.data as CaptureResponse).ok) {
        return res.data as CaptureResponse;
      }
      const errData = res.data as CaptureErrorResponse | undefined;
      throw new BrowserClientError(
        errData?.phase ?? 'unknown',
        errData?.message ?? `HTTP ${res.status}`,
        res.status,
      );
    } catch (err: unknown) {
      if (err instanceof BrowserClientError) throw err;
      if (isAxiosError(err)) {
        throw new BrowserClientError(
          'network',
          err.message,
          err.response?.status ?? 0,
        );
      }
      throw err;
    }
  }
}

let _bc: BrowserClient | null = null;
export function getBrowserClient(): BrowserClient {
  if (!_bc) _bc = new BrowserClient();
  return _bc;
}
export function __resetBrowserClient(): void {
  _bc = null;
}
