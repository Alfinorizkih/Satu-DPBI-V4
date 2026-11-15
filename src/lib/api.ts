export class ApiError extends Error {
  status: number;
  referenceId?: string;
  accountStatus?: string;

  constructor(message: string, status: number, referenceId?: string, accountStatus?: string) {
    super(message);
    this.status = status;
    this.referenceId = referenceId;
    this.accountStatus = accountStatus;
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

async function performFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    const res = await fetch(apiUrl(url), {
      ...init,
      credentials: 'include',
      headers: {
        'X-Requested-With': 'SATU-DPBI',
        ...(init.headers || {}),
      },
    });
    apiHandlers.onNetworkError?.(false);
    return res;
  } catch (err) {
    apiHandlers.onNetworkError?.(true);
    throw new ApiError(
      'Koneksi jaringan terputus atau server sedang tidak dapat dijangkau. Periksa koneksi internet Anda.',
      0
    );
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
        data?.accountStatus
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
  const res = await performFetch(url, {});
  return handleResponse<T>(res, skipSessionCallback);
}

export async function apiPost<T>(url: string, body?: unknown, skipSessionCallback = false): Promise<T> {
  const res = await performFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res, skipSessionCallback);
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await performFetch(url, {
    method: 'PATCH',
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
  const res = await performFetch('/api/files/upload', {
    method: 'POST',
    body: fd,
  });
  return handleResponse(res);
}
