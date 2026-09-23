/**
 * NOVAADMIN — API client
 * ------------------------------------------------------------------
 * Every module in `src/services/*` talks through this client. While
 * `config.api.useMocks` is `true` requests are answered from `src/data/*`
 * with a small artificial latency so loading states are visible. Flip the
 * flag (or set `window.NOVA_ADMIN_API`) and the exact same calls go out as
 * real `fetch` requests with the same method/verb contract:
 *
 *   GET    /resource           → list
 *   GET    /resource/:id       → one
 *   POST   /resource           → create
 *   PUT    /resource/:id       → replace
 *   PATCH  /resource/:id       → partial update
 *   DELETE /resource/:id       → remove
 *
 * Nothing in the UI layer imports `src/data` directly — this keeps the
 * template backend-agnostic and makes swapping in a real API a one-line job.
 */
import { config } from '../config/config.js';

/** Raised for every non-2xx response so callers can branch on `error.status`. */
export class ApiError extends Error {
  constructor(message, { status = 500, code = 'api_error', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Honours an `AbortSignal` around an otherwise synchronous mock read. */
function assertNotAborted(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

export const apiConfig = {
  get baseUrl() {
    return window.NOVA_ADMIN_API?.baseUrl ?? config.api.baseUrl;
  },
  get timeout() {
    return window.NOVA_ADMIN_API?.timeout ?? config.api.timeout;
  },
  get useMocks() {
    return window.NOVA_ADMIN_API?.useMocks ?? config.api.useMocks;
  },
};

function buildUrl(path, query) {
  const base = apiConfig.baseUrl.replace(/\/$/, '');
  const url = new URL(`${base}/${String(path).replace(/^\//, '')}`, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  return url;
}

/**
 * Real HTTP transport with timeout + tolerant error parsing.
 * Mock answers never reach this function.
 */
export async function http(method, path, { body, query, signal, headers } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), apiConfig.timeout);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(buildUrl(path, query), {
      method: method.toUpperCase(),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? safeParse(text) : null;

    if (!response.ok) {
      throw new ApiError(payload?.message ?? `درخواست با خطای ${response.status} برگشت.`, {
        status: response.status,
        code: payload?.code ?? 'http_error',
        details: payload,
      });
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('زمان انتظار پاسخ سرور به پایان رسید.', { status: 408, code: 'timeout' });
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError('ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.', { status: 0, code: 'network_error' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
}

/**
 * Transport used by mock-backed services.
 * `resolver` receives `{ method, id, body, query }` and returns plain data.
 */
export async function mock(method, resource, { id, body, query, resolver, signal, latency = [120, 380] } = {}) {
  const [min, max] = latency;
  await delay(min + Math.random() * (max - min));
  assertNotAborted(signal);
  try {
    return await resolver({ method, id, body, query, signal });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message ?? 'خطای نامشخص در لایه داده', {
      status: 500,
      code: 'mock_error',
      details: { resource },
    });
  }
}

/** Single entry point used by services — picks mock or HTTP transparently. */
export function call(method, resource, options = {}) {
  const { id, query, resolver } = options;
  const path = id ? `${resource}/${id}` : resource;
  if (apiConfig.useMocks && resolver) {
    return mock(method, resource, options);
  }
  const methodFor = { list: 'GET', get: 'GET', create: 'POST', update: 'PUT', patch: 'PATCH', remove: 'DELETE' }[method] ?? 'GET';
  return http(methodFor, path, { body: options.body, query, signal: options.signal });
}

export default { call, http, mock, apiConfig, ApiError };
