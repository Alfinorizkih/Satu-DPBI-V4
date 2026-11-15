import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { getDb, IS_DEMO_MODE } from './db';
import { hasPermission, resolveEffectivePermissions } from '../src/lib/rbac';
import type { AuthUser, DelegationRecord, ModuleCode, PermissionAction, RoleCode } from '../src/lib/types';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';
import { ROLE_LABELS } from '../src/lib/rbac';

const SESSION_COOKIE_NAME = IS_DEMO_MODE ? 'satu_dpbi_demo_sid' : 'satu_dpbi_sid';
const LOGIN_ATTEMPTS = new Map<string, { count: number; lockedUntil: number }>();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(key, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function checkLoginThrottle(key: string): { allowed: boolean; retryAfterSec: number } {
  const rec = LOGIN_ATTEMPTS.get(key);
  if (!rec) return { allowed: true, retryAfterSec: 0 };
  const now = Date.now();
  if (rec.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000) };
  }
  if (now - rec.lockedUntil > 5 * 60 * 1000) {
    LOGIN_ATTEMPTS.delete(key);
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordLoginFailure(key: string): void {
  const rec = LOGIN_ATTEMPTS.get(key) ?? { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    rec.lockedUntil = Date.now() + Math.min(15 * 60 * 1000, rec.count * 30 * 1000);
  }
  LOGIN_ATTEMPTS.set(key, rec);
}

export function clearLoginFailures(key: string): void {
  LOGIN_ATTEMPTS.delete(key);
}

export function getSessionPolicy(db: DatabaseSync): { ttlHours: number; idleMinutes: number } {
  const rows = db
    .prepare("SELECT key, value FROM system_settings WHERE key IN ('session_ttl_hours', 'idle_timeout_minutes')")
    .all() as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const ttlHours = Math.max(1, Math.min(168, Number(map.get('session_ttl_hours') ?? 24) || 24));
  const idleMinutes = Math.max(5, Math.min(480, Number(map.get('idle_timeout_minutes') ?? 45) || 45));
  return { ttlHours, idleMinutes };
}

export function createSession(
  db: DatabaseSync,
  userId: string,
  deviceLabel: string,
  ipAddress: string
): { rawToken: string; sessionId: string; expiresAt: string } {
  const { ttlHours } = getSessionPolicy(db);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, device_label, ip_address, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, userId, tokenHash, deviceLabel, ipAddress, expiresAt, now.toISOString(), now.toISOString());

  return { rawToken, sessionId, expiresAt };
}

export function rotateSession(
  db: DatabaseSync,
  oldSessionId: string | undefined,
  userId: string,
  deviceLabel: string,
  ipAddress: string
): { rawToken: string; sessionId: string; expiresAt: string } {
  if (oldSessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(oldSessionId);
  }
  return createSession(db, userId, deviceLabel, ipAddress);
}

function resolveCookieOptions(maxAgeMs?: number) {
  const rawSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite: 'lax' | 'none' | 'strict' =
    rawSameSite === 'none' || rawSameSite === 'strict' ? rawSameSite : 'lax';
  const secure =
    sameSite === 'none'
      ? process.env.ALLOW_INSECURE_COOKIE !== 'true'
      : process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true';
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    ...(domain ? { domain } : {}),
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export function setSessionCookie(res: Response, rawToken: string, maxAgeMs = 24 * 60 * 60 * 1000): void {
  res.cookie(SESSION_COOKIE_NAME, rawToken, resolveCookieOptions(maxAgeMs));
}

export function clearSessionCookie(res: Response): void {
  const opts = resolveCookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, opts);
}

export function getSessionTokenFromReq(req: Request): string | null {
  const fromCookie = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie.length >= 32) {
    return fromCookie;
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

export function hydrateAuthUser(db: DatabaseSync, userRow: Record<string, unknown>): AuthUser {
  const role = userRow.role as RoleCode;
  const userId = String(userRow.id);
  const delegationsRows = db
    .prepare(
      `SELECT id, delegate_user_id, delegate_name, grantor_user_id, grantor_name,
              module, action, province_code, starts_at, ends_at, reason, status
       FROM delegations
       WHERE delegate_user_id = ? AND status = 'aktif'`
    )
    .all(userId) as Record<string, unknown>[];

  const activeDelegations: DelegationRecord[] = delegationsRows.map((d) => ({
    id: String(d.id),
    delegateUserId: String(d.delegate_user_id),
    delegateName: String(d.delegate_name),
    grantorUserId: String(d.grantor_user_id),
    grantorName: String(d.grantor_name),
    module: d.module as ModuleCode,
    action: d.action as PermissionAction,
    provinceCode: d.province_code ? String(d.province_code) : null,
    startsAt: String(d.starts_at),
    endsAt: String(d.ends_at),
    reason: String(d.reason),
    status: d.status as 'aktif' | 'dicabut' | 'kedaluwarsa',
  }));

  const provCode = userRow.province_code ? String(userRow.province_code) : null;
  const provName = provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : null;

  return {
    id: userId,
    email: String(userRow.email),
    fullName: String(userRow.full_name),
    role,
    roleLabel: ROLE_LABELS[role] ?? role,
    bidang: userRow.bidang ? String(userRow.bidang) : null,
    provinceCode: provCode,
    provinceName: provName,
    batchId: userRow.batch_id ? String(userRow.batch_id) : null,
    personnelId: userRow.personnel_id ? String(userRow.personnel_id) : null,
    accountStatus: userRow.account_status as AuthUser['accountStatus'],
    alumniAccessExpiresAt: userRow.alumni_access_expires_at
      ? String(userRow.alumni_access_expires_at)
      : null,
    permissions: resolveEffectivePermissions(role, activeDelegations),
    activeDelegations,
  };
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
  sessionId?: string;
}

export function resolveOptionalAuth(
  req: AuthenticatedRequest,
  res: Response
): {
  user: AuthUser;
  sessionId: string;
  expiresAt: string;
  idleMinutes: number;
  expiredReason?: 'expired' | 'idle' | 'pending' | 'inactive';
} | { user: null; expiredReason: 'expired' | 'idle' | 'pending' | 'inactive' } | null {
  const token = getSessionTokenFromReq(req);
  if (!token) return null;

  const db = getDb();
  const tokenHash = sha256(token);
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as Record<string, unknown> | undefined;

  if (!row) {
    clearSessionCookie(res);
    return { user: null, expiredReason: 'expired' };
  }

  const { idleMinutes } = getSessionPolicy(db);
  const nowMs = Date.now();
  const expiresAtStr = String(row.expires_at);
  const lastSeenMs = Date.parse(String(row.last_seen_at || row.created_at));

  if (Date.parse(expiresAtStr) < nowMs) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(String(row.session_id));
    clearSessionCookie(res);
    return { user: null, expiredReason: 'expired' };
  }

  if (Number.isFinite(lastSeenMs) && nowMs - lastSeenMs > idleMinutes * 60 * 1000) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(String(row.session_id));
    clearSessionCookie(res);
    return { user: null, expiredReason: 'idle' };
  }

  if (row.account_status === 'menunggu_persetujuan') {
    return { user: null, expiredReason: 'pending' };
  }

  if (row.account_status === 'nonaktif' || row.account_status === 'terkunci') {
    clearSessionCookie(res);
    return { user: null, expiredReason: 'inactive' };
  }

  if (row.role === 'alumni' && row.alumni_access_expires_at) {
    if (Date.parse(String(row.alumni_access_expires_at)) < nowMs) {
      return { user: null, expiredReason: 'inactive' };
    }
  }

  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    String(row.session_id)
  );

  return {
    sessionId: String(row.session_id),
    expiresAt: expiresAtStr,
    idleMinutes,
    user: hydrateAuthUser(db, row),
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = getSessionTokenFromReq(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.', code: 401 });
    return;
  }

  const db = getDb();
  const tokenHash = sha256(token);
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as Record<string, unknown> | undefined;

  if (!row) {
    clearSessionCookie(res);
    res.status(419).json({ error: 'Sesi Anda tidak valid atau telah dicabut. Silakan masuk kembali.', code: 419 });
    return;
  }

  const { idleMinutes } = getSessionPolicy(db);
  const nowMs = Date.now();
  const lastSeenMs = Date.parse(String(row.last_seen_at || row.created_at));

  if (Date.parse(String(row.expires_at)) < nowMs) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(String(row.session_id));
    clearSessionCookie(res);
    res.status(419).json({ error: 'Sesi Anda telah kedaluwarsa. Silakan masuk kembali.', code: 419 });
    return;
  }

  if (Number.isFinite(lastSeenMs) && nowMs - lastSeenMs > idleMinutes * 60 * 1000) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(String(row.session_id));
    clearSessionCookie(res);
    res.status(419).json({ error: 'Sesi diakhiri otomatis karena tidak ada aktivitas sesuai kebijakan keamanan.', code: 419 });
    return;
  }

  if (row.account_status === 'menunggu_persetujuan') {
    res.status(403).json({ error: 'Akun Anda masih menunggu persetujuan Sekretariat Nasional.', code: 403, accountStatus: 'menunggu_persetujuan' });
    return;
  }

  if (row.account_status === 'nonaktif' || row.account_status === 'terkunci') {
    clearSessionCookie(res);
    res.status(403).json({ error: 'Akun dinonaktifkan atau terkunci oleh administrator.', code: 403 });
    return;
  }

  if (row.role === 'alumni' && row.alumni_access_expires_at) {
    if (Date.parse(String(row.alumni_access_expires_at)) < nowMs) {
      res.status(403).json({
        error: 'Masa akses arsip Alumni 30 hari telah berakhir. Hubungi Sekretariat Nasional untuk perpanjangan resmi.',
        code: 403,
      });
      return;
    }
  }

  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    String(row.session_id)
  );

  req.sessionId = String(row.session_id);
  req.authUser = hydrateAuthUser(db, row);
  next();
}

export function requireSafeOrigin(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    next();
    return;
  }
  const xRequestedWith = req.headers['x-requested-with'];
  if (xRequestedWith === 'SATU-DPBI') {
    next();
    return;
  }
  const referer = req.headers.referer;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host === host) {
        next();
        return;
      }
      res.status(403).json({ error: 'Permintaan lintas origin (CSRF) ditolak.', code: 403 });
      return;
    } catch {
      res.status(400).json({ error: 'Header Origin tidak valid.', code: 400 });
      return;
    }
  }
  if (referer && host) {
    try {
      if (new URL(referer).host === host) {
        next();
        return;
      }
      res.status(403).json({ error: 'Referer tidak sesuai origin aplikasi.', code: 403 });
      return;
    } catch {
      res.status(400).json({ error: 'Header Referer tidak valid.', code: 400 });
      return;
    }
  }
  next();
}

export function requirePermission(module: ModuleCode, action: PermissionAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: 'Autentikasi diperlukan.', code: 401 });
      return;
    }
    if (!hasPermission(user.permissions, module, action)) {
      res.status(403).json({
        error: `Akses ditolak: Anda tidak memiliki izin '${action}' pada modul '${module}'.`,
        code: 403,
      });
      return;
    }
    next();
  };
}

export function inspectFileMagicBytes(
  buffer: Buffer,
  declaredMime: string,
  originalName: string
): { valid: boolean; detectedMime: string; reason?: string } {
  if (buffer.length < 4) {
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'Berkas terlalu kecil atau rusak.' };
  }
  const ext = originalName.split('.').pop()?.toLowerCase() ?? '';

  // PDF: %PDF-
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    if (ext !== 'pdf') {
      return { valid: false, detectedMime: 'application/pdf', reason: 'Ekstensi berkas tidak cocok dengan isi PDF.' };
    }
    return { valid: true, detectedMime: 'application/pdf' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (!['jpg', 'jpeg'].includes(ext)) {
      return { valid: false, detectedMime: 'image/jpeg', reason: 'Ekstensi tidak cocok dengan berkas JPEG.' };
    }
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    if (ext !== 'png') {
      return { valid: false, detectedMime: 'image/png', reason: 'Ekstensi tidak cocok dengan berkas PNG.' };
    }
    return { valid: true, detectedMime: 'image/png' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    if (ext !== 'webp') {
      return { valid: false, detectedMime: 'image/webp', reason: 'Ekstensi tidak cocok dengan berkas WebP.' };
    }
    return { valid: true, detectedMime: 'image/webp' };
  }

  // CSV plain text
  if (ext === 'csv' && (declaredMime === 'text/csv' || declaredMime === 'application/vnd.ms-excel' || declaredMime === 'text/plain')) {
    return { valid: true, detectedMime: 'text/csv' };
  }

  return {
    valid: false,
    detectedMime: 'unknown',
    reason: 'Format berkas ditolak. Hanya PDF, JPG, JPEG, PNG, WebP, atau CSV yang lolos validasi signature MIME.',
  };
}

export function writeAuditLog(
  db: DatabaseSync,
  actor: { id: string; fullName: string; role: string },
  action: string,
  targetType: string,
  targetId: string,
  outcome: 'berhasil' | 'ditolak' | 'gagal' = 'berhasil',
  contextNote = ''
): void {
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, target_type, target_id, outcome, context_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    actor.id,
    actor.fullName,
    actor.role,
    action,
    targetType,
    targetId,
    outcome,
    contextNote,
    new Date().toISOString()
  );
}

export function writeActivityTimeline(
  db: DatabaseSync,
  category: string,
  title: string,
  description: string,
  actorName: string,
  provinceCode: string | null = null,
  batchId: string | null = null,
  relatedPath = '/dashboard'
): void {
  db.prepare(
    `INSERT INTO activity_timeline (id, category, title, description, province_code, batch_id, actor_name, related_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    category,
    title,
    description,
    provinceCode,
    batchId,
    actorName,
    relatedPath,
    new Date().toISOString()
  );
}

export function recordSystemError(
  db: DatabaseSync,
  httpStatus: number,
  route: string,
  err: unknown
): string {
  const ref = `ERR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  try {
    const msg = err instanceof Error ? err.message : String(err || 'Unknown internal error');
    db.prepare(
      `INSERT INTO system_errors (id, reference_code, http_status, route, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), ref, httpStatus, route.slice(0, 160), msg.slice(0, 500), new Date().toISOString());
  } catch {
    // ignore secondary logging failure
  }
  return ref;
}
