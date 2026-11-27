const DRAFT_PREFIX = 'satu_dpbi_draft:';

export interface StoredDraft<T> {
  data: T;
  savedAt: string;
}

function buildKey(userId: string | undefined | null, routeKey: string): string | null {
  if (!userId) return null;
  return `${DRAFT_PREFIX}${userId}:${routeKey}`;
}

export function saveOfflineDraft<T>(userId: string | undefined | null, routeKey: string, data: T): string | null {
  const key = buildKey(userId, routeKey);
  if (!key || typeof window === 'undefined') return null;
  const savedAt = new Date().toISOString();
  try {
    const payload: StoredDraft<T> = { data, savedAt };
    window.localStorage.setItem(key, JSON.stringify(payload));
    return savedAt;
  } catch {
    return null;
  }
}

export function loadOfflineDraft<T>(userId: string | undefined | null, routeKey: string): StoredDraft<T> | null {
  const key = buildKey(userId, routeKey);
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineDraft(userId: string | undefined | null, routeKey: string): void {
  const key = buildKey(userId, routeKey);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function clearAllUserDrafts(userId: string | undefined | null): void {
  if (!userId || typeof window === 'undefined') return;
  const userPrefix = `${DRAFT_PREFIX}${userId}:`;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(userPrefix)) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
