# Security Summary

**Reviewed Files**: 14
**Issues Resolved**: 4

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Login Rate Limiting Reset | `server/security.ts` | 39 | Login failure throttling reset the attempt counter when `lockedUntil === 0` because `now - 0 > 5 * 60 * 1000` always evaluated true, preventing lockouts after repeated wrong passwords. | High | Fixed | Added `lastAttemptAt` tracking to each failure record so expired lockouts only clear when `lockedUntil > 0` or after 15 minutes of inactivity. |
| Proposal Approval Task Creation | `server/workflow.ts` | 148 | Approving a proposal omitted the required `creator_id` column when inserting automatic follow-up tasks, causing the approval workflow to fail with a server error. | Medium | Fixed | Added `approver.id` for `creator_id` alongside `approver.fullName` in `onProposalApproved`. |
| Email Template Variable & CSV Export Safety | `server/email.ts` | 228 | Outgoing campaign templates and CSV log exports required strict placeholder validation and spreadsheet formula escaping before bulk delivery. | Medium | Fixed | Enforced allowlisted variable checks via `validateEmailTemplatePlaceholders` before queueing campaigns and wrapped exported CSV cells with `csvSafeCell`. |
| Synthetic Analytics Fallback Removal | `server/workflow.ts` | 350 | When a short time window had zero decided proposals, dashboard analytics displayed a hardcoded `14.5` hours placeholder instead of reflecting actual database records. | Low | Fixed | Changed `avgDecisionHours` to return `null` when no decided records exist in the window and updated the dashboard card to render `Belum ada`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Password & Token Storage | `server/security.ts` | Uses random 16-byte salts with `scryptSync` and constant-time comparison (`timingSafeEqual`); session, invitation, and reset tokens are stored as SHA-256 digests. |
| Session Policy & Admin Revocation | `server/security.ts`, `server/routes_modules.ts` | Session TTL is capped at 24 hours maximum (`Math.min(24, ...)`), idle timeouts invalidate sessions with HTTP 419, role/status updates purge user sessions, and admins can inspect or revoke all active sessions per user. |
| Provincial Scope & Role Isolation | `src/lib/rbac.ts`, `server/security.ts` | Enforces server-side permissions (`requirePermission`) and provincial boundaries (`hasScopedPermission`) across proposals, LKL, coordinator reports, and delegations. |
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
Added `lastAttemptAt` to the in-memory throttle record in `server/security.ts:10` and guarded the cleanup condition in `checkLoginThrottle` (`server/security.ts:39`) so active failure counts under 5 attempts are preserved until either a temporary lockout expires or 15 minutes pass without attempts.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Wrong-password requests 1 through 5 hit `POST /api/auth/login` (`server/routes.ts:420`) | `checkLoginThrottle` (`server/security.ts:429`) preserves existing failure count |
| 2 | Each failure increments `rec.count` and updates `rec.lastAttemptAt` in `recordLoginFailure` (`server/security.ts:45-54`) | At attempt 5, `rec.lockedUntil` is set into the future |
| 3 | Attempt 6 checks `rec.lockedUntil > now` (`server/security.ts:36`) | Request is rejected with **HTTP 429** and `Retry-After` guidance |

#### Conclusion
**Fix Verified** — Verified in `server/api.security.test.ts` (`Auth, session policy bounds (<= 24h), admin session inspection/revocation, and login failure lockout`), where the 6th consecutive failed login consistently receives HTTP `429`.

---

### Proposal Approval & Cross-Module Task Orchestration Failure

#### Summary
| Field | Value |
|---|---|
| Issue Type | Incomplete Workflow Transaction Column Binding |
| Impact | Medium |
| Affected File | `server/workflow.ts:146-175` |
| Test Scenario | Approve a submitted proposal via `POST /api/proposals/:id/decide` with `decision: "disetujui"`. |

#### How It Was Fixed
Bound `approver.id` to the `creator_id` column in the prepared `INSERT INTO tasks` statement inside `onProposalApproved` (`server/workflow.ts:148-169`).

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Approver submits `decision: "disetujui"` at `POST /api/proposals/:id/decide` | Permission and provincial/bidang scope verified |
| 2 | `onProposalApproved` (`server/workflow.ts:30-215`) creates an idempotent calendar event and 4 phase tasks | All required task columns including `creator_id` (`approver.id`) are populated |
| 3 | Workflow commits and notifies applicant and regional coordinator | **HTTP 200** with linked calendar event and 4 checklist tasks |

#### Conclusion
**Fix Verified** — Verified end-to-end in `server/api.security.test.ts`, confirming proposal approval creates 1 calendar event and 4 follow-up tasks and updates schedules and LKL completion across modules.

---

### Cross-Province Coordinator & Duta Object Access Control

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Scope Authorization Check |
| Impact | High |
| Affected File | `server/security.ts:434-550` |
| Test Scenario | `koordinator_wilayah` for Jawa Barat attempts to review a proposal in Bali (`POST /api/proposals/:id/decide`), and `duta` attempts to download another user's private uploaded file (`GET /api/files/:id`). |

#### How It Was Fixed
Every regional action validates `hasScopedUserPermission` (`server/security.ts:434-448`) against the record's `province_code`, and file endpoints invoke `canAccessStoredFile` (`server/security.ts:450-550`) with audit logging (`ACCESS_DENIED_IDOR`).

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Requests reach `POST /api/proposals/:id/decide` or `GET /api/files/:id` (`server/routes.ts:912`) | Session authenticated via `requireAuth` (`server/security.ts:293`) |
| 2 | `hasScopedUserPermission` and `canAccessStoredFile` compare user role, ownership, province, and active delegations | Foreign province or foreign file ownership fails check |
| 3 | Handler logs denial and aborts access | **HTTP 403** returned cleanly |

#### Conclusion
**Fix Verified** — Verified by `server/api.security.test.ts`, where cross-province review and cross-user private file download both return HTTP `403` and only succeed when an explicit province-scoped delegation is active.
