---
title: "PPL: Security [Sprint 2, Week 2]"
date: 2026-03-30
description: "Authentication hardening with OWASP A07 fixes (inactive account blocking, session invalidation) and SAST surfaced in CI comments this sprint."
tags: ["ppl", "security", "owasp", "authentication"]
slug: s2w2-security
toc: true
---

## What I Worked On

Two security-relevant features merged this week that directly address OWASP Top 10 vulnerabilities: blocking inactive accounts from authenticating (SIRA-215) and enforcing session limits with proper invalidation (SIRA-214). SAST results are now also surfaced automatically on every MR via the CI report system.

---

## OWASP A07: Authentication Failures

OWASP A07 covers broken authentication, including cases where deactivated or suspended accounts can still access the system. Before SIRA-215 (MR !104), deactivating a user in the admin panel only prevented login via the UI — a valid JWT issued before deactivation still passed every auth check.

The fix adds an active status check in the JWT validation middleware:

```python
if not app_user.get("is_active"):
    raise HTTPException(status_code=403, detail="Account is inactive")
```

This runs on every authenticated request. A deactivated account is rejected at the auth layer regardless of whether the JWT is otherwise valid. The fix also ensures the check happens after user lookup, so there is no ambiguity between "user not found" and "user found but inactive."

---

## Session Security: Device Management and Invalidation

SIRA-214 (MR !120) introduced multi-device session tracking. This addresses two OWASP A07 sub-issues:

**Session fixation prevention**: each login generates a fresh session record. If the same `session_id` is reused (e.g. a token replay attempt), the service upserts rather than creating a duplicate, and the session's `last_active_at` is updated. An attacker cannot pre-create a session and wait for a victim to authenticate into it.

**Session limit and revocation**: a hard cap of 5 active sessions per user is enforced. When capacity is reached, the oldest session is evicted. Users can also explicitly revoke any session from the devices page. When a session is revoked, it is marked `is_active = false` in the DB, causing the JWT middleware to reject subsequent requests that carry that session ID.

```python
MAX_SESSIONS = 5

# Enforce limit: kick oldest if at capacity
if len(active_sessions) >= MAX_SESSIONS:
    oldest = active_sessions[-1]  # ordered desc by last_active_at
    await user_sessions_queries.deactivate_session(self.db, oldest["id"])
```

---

## Sensitive Data Handling in Email Integration

SIRA-160 (MR !108) added email sending via the Resend API. The API key is read from environment variables:

```python
class EmailService:
    def __init__(self, api_key: str, from_address: str) -> None:
        self._api_key = api_key
        ...
```

The key is injected via `config.py` which reads from `.env.local`. It is never hardcoded, never logged, and never included in any response schema. The Sentry `send_default_pii=False` setting established earlier also prevents the key from appearing in error reports.

---

## SAST in CI Comments

MR !126 (SIRA-228) added security audit results to the per-MR CI comments. Every MR now shows a collapsed security section:

```
🔒 Security Audit — Bandit: ✅ No issues, Audit: ✅ No vulnerabilities
```

Bandit (Python SAST) and `pnpm audit` (JS dependency scan) were already running but their results were buried in the CI logs. Now they are visible at the MR level. This week, both checks passed with zero issues for all 19 merged MRs.

---

## Results

| Fix | OWASP Category | Scope |
|-----|---------------|-------|
| Block inactive accounts | A07 (Auth failures) | All authenticated API endpoints |
| Session device limit + revocation | A07 (Auth failures) | All JWT-authenticated sessions |
| Resend API key in env | A02 (Cryptographic/secret exposure) | Email transport |
| SAST in MR comments | A06 (Vulnerable components) | CI visibility |

---

## Evidence

- MR !104 — [SIRA-215](https://linear.app/ppl-sira/issue/SIRA-215): `apps/api/src/app/routers/auth.py` (inactive account guard)
- MR !120 — [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214): `apps/api/src/app/services/session_service.py`
- MR !108 — [SIRA-160](https://linear.app/ppl-sira/issue/SIRA-160): `apps/api/src/app/services/email_service.py`
- MR !126 — [SIRA-228](https://linear.app/ppl-sira/issue/SIRA-228): `scripts/ci-report.sh` (SAST comment)
