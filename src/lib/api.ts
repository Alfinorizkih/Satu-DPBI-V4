export class ApiError extends Error {
  status: number;
  referenceId?: string;
  accountStatus?: string;
  conflict?: boolean;
  latestRecord?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    referenceId?: string,
    accountStatus?: string,
    conflict?: boolean,
    latestRecord?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.referenceId = referenceId;
    this.accountStatus = accountStatus;
    this.conflict = conflict;
    this.latestRecord = latestRecord;
  }
}

interface ApiHandlers {
  onSessionExpired?: (reason?: string) => void;
  onNetworkError?: (offline: boolean) => void;
}

const apiHandlers: ApiHandlers = {};

export function setApiHandlers(handlers: ApiHandlers): void {
  apiHandlers.onSessionExpired = handlers.onSessionExpired;
  apiHandlers.onNetworkError = handlers.onNetworkError;
}

export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function generateIdempotencyKey(prefix = 'dpbi'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function performFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(url), {
      ...init,
      signal: init.signal ?? controller.signal,
      credentials: 'include',
      headers: {
        'X-Requested-With': 'SATU-DPBI',
        ...(init.headers || {}),
      },
    });
    apiHandlers.onNetworkError?.(false);
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        'Permintaan melebihi batas waktu tunggu (20 detik). Data Anda belum dikirim ulang — silakan coba kembali.',
        408
      );
    }
    apiHandlers.onNetworkError?.(true);
    throw new ApiError(
      'Koneksi jaringan terputus atau server sedang tidak dapat dijangkau. Periksa koneksi internet Anda.',
      0
    );
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function handleResponse<T>(res: Response, skipSessionCallback = false): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 419 && !skipSessionCallback) {
        apiHandlers.onSessionExpired?.(data?.error);
      }
      throw new ApiError(
        data?.error || 'Terjadi kesalahan pada server.',
        res.status,
        data?.referenceId,
        data?.accountStatus,
        Boolean(data?.conflict),
        data?.latestRecord
      );
    }
    return data as T;
  }
  if (!res.ok) {
    if (res.status === 419 && !skipSessionCallback) {
      apiHandlers.onSessionExpired?.('Sesi Anda telah berakhir.');
    }
    throw new ApiError(`Permintaan gagal dengan status ${res.status}.`, res.status);
  }
  return (await res.text()) as unknown as T;
}

export async function apiGet<T>(url: string, skipSessionCallback = false): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await performFetch(url, {});
      if (attempt === 0 && (res.status === 502 || res.status === 503 || res.status === 504)) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      return await handleResponse<T>(res, skipSessionCallback);
    } catch (err) {
      lastErr = err;
      if (attempt === 0 && err instanceof ApiError && err.status === 0) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  skipSessionCallback = false,
  options?: { idempotencyKey?: string }
): Promise<T> {
  const res = await performFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res, skipSessionCallback);
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  options?: { idempotencyKey?: string }
): Promise<T> {
  const res = await performFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await performFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await performFetch(url, {
    method: 'DELETE',
  });
  return handleResponse<T>(res);
}

export async function apiUploadFile(
  file: File,
  moduleName: string
): Promise<{ fileId: string; fileName: string; mimeType: string; sizeBytes: number; deduplicated: boolean }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('module', moduleName);
  const res = await performFetch(
    '/api/files/upload',
    {
      method: 'POST',
      body: fd,
    },
    35000
  );
  return handleResponse(res);
}
