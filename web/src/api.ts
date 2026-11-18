import createClient from 'openapi-fetch';
import type { paths } from '../../server/src/twala/schema';

export type * from '../../shared/types';

export interface AppError {
  source?: 'twala' | 'app';
  status?: number;
  code: string;
  message: string;
  requestId?: string | null;
  details?: unknown;
}

export class RequestFailed extends Error {
  constructor(readonly error: AppError) {
    super(error.message);
  }
}

// Typed from Twala's OpenAPI document; the app server adds the key and forwards the call.
export const twala = createClient<paths>({ baseUrl: '/api/twala' });

export async function call<D>(pending: Promise<{ data?: D; error?: unknown; response: Response }>): Promise<D> {
  const { data, error, response } = await pending;
  if (response.ok) return data as D;
  const body = (error ?? {}) as Partial<AppError>;
  throw new RequestFailed({ status: response.status, code: body.code ?? `http_${response.status}`, message: body.message ?? `Request failed with ${response.status}`, ...body });
}

// The app server's own routes: status, API log and received webhooks.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new RequestFailed(body ?? { source: 'app', code: 'http_error', message: `Request failed with ${response.status}` });
  return body as T;
}
