---
title: "PPL: Security [Sprint 2, Week 3]"
date: 2026-04-08
description: "Two OWASP A01 fixes this week: missing auth on read endpoints, and an auth bypass caught in code review. Plus Sentry instrumentation added to Celery tasks for security observability."
tags: ["ppl", "security", "owasp", "authentication"]
slug: s2w3-security
toc: true
---

## What I Worked On

Two authentication gaps were closed this week: one in our own code (MR !154), one caught during code review of a teammate's MR (!155). Both fall under OWASP A01: Broken Access Control. Additionally, Sentry instrumentation was added to Celery tasks (MR !105) to improve security observability for background jobs.

---

## OWASP A01: Missing Auth on GET Client Endpoints

Before SIRA-82 (MR !154), the `GET /api/clients/` and `GET /api/clients/{id}` endpoints had no authentication check. Any unauthenticated HTTP request to the API could list all client records, including encrypted PII.

This was not intentional: write operations (`POST`, `PUT`, `DELETE`) all had `Depends(require_admin)`. The GET endpoints were added earlier when auth was still being wired up, and the check was never added. The frontend never made unauthenticated GET calls, so the gap was invisible in normal usage.

The fix adds `Depends(get_current_user)` to both handlers:

```python
@router.get("/")
async def list_clients(
    _user: AuthenticatedUser = Depends(get_current_user),
    service: ClientService = Depends(_get_service),
) -> list[ClientResponse]:
    return await service.list_clients()
```

The `_user` underscore prefix is intentional: the parameter exists to trigger the auth dependency check, but the resolved `AuthenticatedUser` object is not needed in the handler body. FastAPI evaluates all dependencies regardless of whether the handler uses them, so the auth check runs on every request.

**Why `get_current_user` and not `require_admin` for reads?** Client data should be accessible to both admins and AR staff. `require_admin` would block AR staff from seeing the client list they need to manage reminders. `get_current_user` requires a valid JWT from any authenticated user.

---

## OWASP A01 in Code Review: Auth Bypass via Raw `fetch()`

During review of MR !155 (CSV import modal), a P0 was found: the CSV upload request used the browser's native `fetch()` instead of the project's auth-aware API client.

```typescript
// P0 caught in review: fetch() sends no Authorization header
const response = await fetch(`${API_URL}/clients/import`, {
    method: "POST",
    body: formData,
})
```

The project's `api` client (from `src/lib/api.ts`) uses an Axios interceptor that automatically injects `Authorization: Bearer <token>` from the Supabase session on every request. Native `fetch()` has no such interceptor, so every request goes out with no auth header. The server returns 401, and the client receives an error response with no helpful message.

This is a classic auth bypass — not intentional malicious behavior, but a missing guard that would have shipped a feature where CSV import never works for any real user. The fix replaces the raw `fetch()` call with the auth-aware client.

---

## Security Observability: Sentry + CeleryIntegration

SIRA-135 (MR !105) added explicit Sentry instrumentation to the Celery worker setup:

```python
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        release=settings.commit_sha,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.environment,
        integrations=[CeleryIntegration()],
    )
```

Without `CeleryIntegration()`, Celery task failures, including security-relevant ones like a compromised reminder sending wrong data, would not appear in the Sentry error dashboard. The integration auto-captures task exceptions, including retry exhaustion, with full task context (name, args, retry count).

The security relevance: if a Celery task silently fails (e.g., a reminder email sending to the wrong address due to a data bug, then failing), that failure should surface somewhere observable. Without Sentry capturing it, it disappears into background worker logs that nobody watches in real time.

A test verifies the integration is included explicitly:

```python
def test_sentry_init_includes_celery_integration(mock_sentry_init: MagicMock) -> None:
    call_kwargs = mock_sentry_init.call_args[1]
    integrations = call_kwargs.get("integrations", [])
    assert any(isinstance(i, CeleryIntegration) for i in integrations), (
        "CeleryIntegration must be explicitly listed in sentry_sdk.init() integrations"
    )
```

This test kills the mutant that would remove `CeleryIntegration()` from the list. Without it, Sentry SDK may or may not auto-discover the integration depending on the SDK version. Explicit is safer.

---

## Results

| Fix | OWASP Category | Scope |
|-----|---------------|-------|
| Auth on GET client endpoints | A01 (Broken Access Control) | `GET /api/clients/` and `/{id}` |
| Auth bypass via `fetch()` (caught in review) | A01 (Broken Access Control) | CSV import feature |
| Sentry + CeleryIntegration | A09 (Security Logging) | All Celery background tasks |

---

## Evidence

- MR !154 — [SIRA-82](https://linear.app/ppl-sira/issue/SIRA-82): add auth to GET client API endpoints
- MR !105 — [SIRA-135](https://linear.app/ppl-sira/issue/SIRA-135): Sentry instrumentation for Celery tasks
- MR !155 review — [SIRA-147](https://linear.app/ppl-sira/issue/SIRA-147): auth bypass found in CSV import
- Source: `apps/api/src/app/routers/clients.py`, `apps/api/src/app/workers/celery_app.py`
