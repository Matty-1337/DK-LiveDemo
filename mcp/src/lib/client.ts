import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiErrorPayload {
  status: number;
  message: string;
  data?: unknown;
}

export class LiveDemoApiError extends Error {
  status: number;
  data?: unknown;
  constructor(payload: ApiErrorPayload) {
    super(`[LiveDemo ${payload.status}] ${payload.message}`);
    this.name = 'LiveDemoApiError';
    this.status = payload.status;
    this.data = payload.data;
  }
}

const DEFAULT_BASE_URL = 'http://livedemo-backend:3005';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LiveDemoClient {
  private http: AxiosInstance;

  constructor(baseURL?: string, token?: string) {
    const resolvedBase = baseURL ?? process.env.LIVEDEMO_API_URL ?? DEFAULT_BASE_URL;
    const resolvedToken = token ?? process.env.LIVEDEMO_API_TOKEN ?? '';

    this.http = axios.create({
      baseURL: resolvedBase,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
      },
    });

    this.http.interceptors.response.use(
      (r) => r,
      (error: AxiosError) => {
        const status = error.response?.status ?? 0;
        const data = error.response?.data;
        const message =
          (data as { message?: string } | undefined)?.message ??
          error.message ??
          'Unknown LiveDemo API error';
        return Promise.reject(new LiveDemoApiError({ status, message, data }));
      },
    );
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res: AxiosResponse<T> = await this.http.request<T>(config);
        return res.data;
      } catch (err) {
        lastErr = err;
        const status = err instanceof LiveDemoApiError ? err.status : 0;
        const retriable = status >= 500 && status < 600;
        if (!retriable || attempt === MAX_RETRIES) break;
        await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
      }
    }
    throw lastErr;
  }

  get<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  post<T>(url: string, body?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data: body });
  }

  put<T>(url: string, body?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data: body });
  }

  patch<T>(url: string, body?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data: body });
  }

  delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }
}

let _client: LiveDemoClient | null = null;
export function getClient(): LiveDemoClient {
  if (!_client) _client = new LiveDemoClient();
  return _client;
}
