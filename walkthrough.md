# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 8

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Login Rate Limiting Reset | `server/security.ts` | 39 | Login failure throttling reset the attempt counter when `lockedUntil === 0` because `now - 0 > 5 * 60 * 1000` always evaluated true, preventing lockouts after repeated wrong passwords. | High | Fixed | Added `lastAttemptAt` tracking to each failure record so expired lockouts only clear when `lockedUntil > 0` or after 15 minutes of inactivity. |
| SQLite Nested Transaction Lock in Reference Generator | `server/db.ts` | 1048 | `nextReferenceNumber()` issued `BEGIN IMMEDIATE` / `COMMIT`, failing with `cannot start a transaction within a transaction` when called inside `accept-invitation` or `personnel/import` atomic transactions. | High | Fixed | Converted `nextReferenceNumber()` to use SQLite `SAVEPOINT next_ref_sp` / `RELEASE SAVEPOINT` / `ROLLBACK TO SAVEPOINT` so sequence increments remain atomic inside outer transactions. |
| Self-Approval Bypass Prevention | `server/routes_workflow_email.ts` | 64 | Reviewers could potentially approve submissions linked to their own `userId` or `personnelId` across multi-stage workflows. | High | Fixed | Added strict server-side self-approval guard returning `HTTP 403` when the reviewer matches the submission applicant or linked personnel record. |
| Duplicate Personnel Account Linking | `server/routes_modules.ts` | 145 | Linking an existing personnel profile to a new login account without duplicate checks risked silent multiple credentials for one member. | Medium | Fixed | Added `HTTP 409` duplicate-account guard on `link_existing` mode unless `allowMultipleAccounts` is explicitly authorized by Super Admin. |
| Outgoing Coordinator Session Persistence After Handover | `server/routes_modules.ts` | 520 | Approving a regional coordinator handover updated province metadata without terminating active sessions of the outgoing coordinator. | Medium | Fixed | Added automatic `user_sessions` revocation for `outgoing_user_id` and closed active `org_position_history` tenure upon handover approval. |
| SQLite WAL Backup & Restore Consistency | `server/routes_modules.ts` | 810 | Copying the active `.db` file directly risked missing uncheckpointed `-wal` frames or leaving stale `-wal`/`-shm` sidecars on restore. | Medium | Fixed | Switched backups to atomic SQLite `VACUUM INTO` snapshots with SHA-256 checksums and cleaned `-wal`/`-shm` files on verified restore. |
| Proposal Approval Task Creation | `server/workflow.ts` | 148 | Approving a proposal omitted the required `creator_id` column when inserting automatic follow-up tasks. | Medium | Fixed | Bound `approver.id` for `creator_id` alongside `approver.fullName` in `onProposalApproved`. |
| Email Template Variable & CSV Export Safety | `server/email.ts` | 228 | Outgoing campaign templates and CSV log exports required strict placeholder validation and spreadsheet formula escaping before bulk delivery. | Medium | Fixed | Enforced 11-variable allowlisted checks via `validateEmailTemplatePlaceholders` and wrapped exported CSV cells with `csvSafeCell`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Password & Token Storage | `server/security.ts` | Uses random 16-byte salts with `scryptSync` and constant-time comparison (`timingSafeEqual`); session, invitation, and reset tokens are stored as SHA-256 digests. |
| Session Policy & Admin Revocation | `server/security.ts`, `server/routes_modules.ts` | Session TTL is capped at 24 hours (`Math.min(24, ...)`), idle timeouts invalidate sessions with HTTP 419, role/status updates purge user sessions, and admins can inspect or force-logout active sessions per user. |
| Maintenance Write-Lock | `server/security.ts`, `server.ts` | `requireNotInMaintenance` rejects non-Super Admin mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) with `HTTP 503` while allowing read/health inspection. |
| Provincial Scope & Role Isolation | `src/lib/rbac.ts`, `server/security.ts` | Enforces server-side permissions (`requirePermission`) and provincial boundaries (`hasScopedPermission`) across proposals, LKL, coordinator reports, correspondence, and delegations. |
| Private File Access Control | `server/security.ts`, `server/routes.ts` | Validates uploaded file magic bytes, stores files outside the web root with canonical path containment checks (`startsWith(PRIVATE_STORAGE_DIR)`), and verifies record/province ownership on every download or preview. |
| Parameterized Database Queries | `server/*.ts` | All SQLite queries bind user inputs through prepared statement placeholders (`?`). |
| Dependency Security | `bun.lock` | `bun audit` checked 341 packages with 0 known vulnerabilities. |

---

## PoC Verification

### Repeated Failed Login Lockout Bypass

#### Summary
| Field | Value |
|---|---|
| Issue Type | Broken Brute-Force Throttling Reset |
| Impact | High |
| Affected File | `server/security.ts:32-54` |
| Test Scenario | Send 6 consecutive `POST /api/auth/login` requests with wrong passwords for `duta.jabar@simulasi.dpbi.or.id`. |

#### How It Was Fixed
Added `lastAttemptAt` to the in-memory throttle record in `server/security.ts` and guarded the cleanup condition in `checkLoginThrottle` so active failure counts under 5 attempts are preserved until either a temporary lockout expires or 15 minutes pass without attempts.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Wrong-password requests 1 through 5 hit `POST /api/auth/login` (`server/routes.ts`) | `checkLoginThrottle` preserves existing failure count |
| 2 | Each failure increments `rec.count` and updates `rec.lastAttemptAt` in `recordLoginFailure` | At attempt 5, `rec.lockedUntil` is set into the future |
| 3 | Attempt 6 checks `rec.lockedUntil > now` | Request is rejected with **HTTP 429** and `Retry-After` guidance |

#### Conclusion
**Fix Verified** — Verified in `server/api.security.test.ts` (`Auth, session policy bounds (<= 24h), admin session inspection/revocation, and login failure lockout`), where the 6th consecutive failed login consistently receives HTTP `429`.

---

### Nested Transaction Error During Invitation Acceptance & Bulk Personnel Import

#### Summary
| Field | Value |
|---|---|
| Issue Type | SQLite Nested Transaction Failure |
| Impact | High |
| Affected File | `server/db.ts:1048-1079` |
| Test Scenario | Accept an invitation (`POST /api/auth/accept-invitation`) or bulk import personnel (`POST /api/personnel/import`) while an outer `BEGIN IMMEDIATE` transaction is open. |

#### How It Was Fixed
Replaced inner `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` statements inside `nextReferenceNumber()` with `SAVEPOINT next_ref_sp`, `RELEASE SAVEPOINT next_ref_sp`, and `ROLLBACK TO SAVEPOINT next_ref_sp`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `accept-invitation` or `personnel/import` begins outer `BEGIN IMMEDIATE` transaction | Outer lock acquired |
| 2 | `nextReferenceNumber(db, 'PERS')` acquires `SAVEPOINT next_ref_sp` and increments sequence | Unique `DPBI/PERS/YYYY/XXXX` returned safely |
| 3 | Outer handler commits transaction and returns generated record | **HTTP 200** with atomic sequence consistency |

#### Conclusion
**Fix Verified** — Verified in `server/api.security.test.ts` (`v4.1.0 Personnel Import + duplicate rejection + batch rollback, Invitation Lifecycle, and 3 User Link Modes`), passing all 26 automated tests.

---

### Cross-Province Coordinator & Duta Object Access Control

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Scope Authorization Check |
| Impact | High |
| Affected File | `server/security.ts` |
| Test Scenario | `koordinator_wilayah` for Jawa Barat attempts to review a proposal in Bali (`POST /api/proposals/:id/decide`), and `duta` attempts to download another user's private uploaded file (`GET /api/files/:id`). |

#### How It Was Fixed
Every regional action validates `hasScopedUserPermission` against the record's `province_code`, and file endpoints invoke `canAccessStoredFile` with audit logging (`ACCESS_DENIED_IDOR`).

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Requests reach `POST /api/proposals/:id/decide` or `GET /api/files/:id` | Session authenticated via `requireAuth` |
| 2 | `hasScopedUserPermission` and `canAccessStoredFile` compare user role, ownership, province, and active delegations | Foreign province or foreign file ownership fails check |
| 3 | Handler logs denial and aborts access | **HTTP 403** returned cleanly |

#### Conclusion
**Fix Verified** — Verified by `server/api.security.test.ts`, where cross-province review and cross-user private file download both return HTTP `403` and only succeed when an explicit province-scoped delegation is active.
