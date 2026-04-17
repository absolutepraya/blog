---
title: "PPL: Security, From App Code to Supply Chain [Sprint 2, Week 3]"
date: 2026-04-15
description: "Two weeks of security work at two layers: in-app fixes for OWASP A01 gaps (missing auth on GET endpoints, auth bypass via raw fetch caught in review, Sentry for Celery observability), then a supply-chain patch for the axios SSRF advisory (GHSA-3p68-rc4w-qgx5) surfaced automatically by pnpm audit in CI."
tags: ["ppl", "security", "owasp", "supply-chain"]
slug: s2w3-security
toc: true
---

## What I Worked On

Two weeks of security work that span the whole stack. Week 1 (2-8 Apr) closed two OWASP A01 (Broken Access Control) gaps — one in our own code, one caught during a teammate's code review — and added Sentry observability to Celery tasks so background job failures stop disappearing silently. Week 2 (9-15 Apr) patched a high-severity axios SSRF (GHSA-3p68-rc4w-qgx5) that `pnpm audit` caught in a routine MR pipeline. The pattern across the two weeks: fix boundaries in our own code, and keep dependencies patched via automated audit.

---

## Week 1: OWASP A01 in Our Own Code — Missing Auth on GET Client Endpoints

Before SIRA-82 (MR !154), `GET /api/clients/` and `GET /api/clients/{id}` had no authentication check. Any unauthenticated HTTP request could list all client records, including encrypted PII.

This was not intentional. Write operations (`POST`, `PUT`, `DELETE`) all had `Depends(require_admin)`. The GET endpoints were added earlier, when auth was still being wired up, and the check was never added. The frontend never made unauthenticated GET calls, so the gap stayed invisible in normal usage.

The fix adds `Depends(get_current_user)` to both handlers:

```python
@router.get("/")
async def list_clients(
    _user: AuthenticatedUser = Depends(get_current_user),
    service: ClientService = Depends(_get_service),
) -> list[ClientResponse]:
    return await service.list_clients()
```

The `_user` underscore signals the dependency is validated but not referenced in the handler body. FastAPI evaluates all dependencies regardless of whether the handler uses them, so the auth check runs on every request.

**Why `get_current_user` and not `require_admin` for reads?** Client data should be accessible to admins AND AR staff. `require_admin` would block AR staff from the client list they need to manage reminders. `get_current_user` requires a valid JWT from any authenticated user — the right tradeoff for read access.

---

## Week 1: OWASP A01 in Code Review — Auth Bypass via Raw `fetch()`

During review of MR !155 (CSV import modal), I caught this:

```typescript
// P0: fetch() sends no Authorization header
const response = await fetch(`${API_URL}/clients/import`, {
    method: "POST",
    body: formData,
})
```

The project's `api` client uses an Axios interceptor that automatically injects `Authorization: Bearer <token>` from the Supabase session. Native `fetch()` has no such interceptor — every request goes out with no auth header. Server returns 401, client receives a generic error message with no helpful context.

A classic auth bypass: not intentional, not malicious. Just a missing guard that would ship a feature where CSV import silently 401s for every real user. Fix replaces the raw `fetch()` with the auth-aware client.

This pattern of "teammate accidentally reaches around the auth boundary" is the kind of thing that only code review catches. Static analysis won't flag `fetch()` because it's a valid JavaScript API. Integration tests might not catch it if they mock the server response. Human review of the boundary — "where does this request go, with what credentials?" — is the control.

---

## Week 1: Security Observability — Sentry + CeleryIntegration

SIRA-135 (MR !105) added explicit Sentry instrumentation to the Celery worker:

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

Without `CeleryIntegration()`, Celery task failures do not appear in the Sentry error dashboard. The integration auto-captures task exceptions, retry exhaustion, and task context (name, args, retry count).

**Why is this a security concern, not just an ops concern?** If a Celery task silently fails — a reminder email sending to the wrong address due to a data bug, then failing — that failure should surface somewhere observable. Without Sentry capturing it, it disappears into background worker logs that nobody watches in real time. Silent failures of security-adjacent jobs (sending reminders to the wrong client, failing to revoke an expired session, etc.) are how security incidents become invisible.

A test verifies the integration is included explicitly, not relying on SDK auto-discovery:

```python
def test_sentry_init_includes_celery_integration(mock_sentry_init: MagicMock) -> None:
    call_kwargs = mock_sentry_init.call_args[1]
    integrations = call_kwargs.get("integrations", [])
    assert any(isinstance(i, CeleryIntegration) for i in integrations), (
        "CeleryIntegration must be explicitly listed in sentry_sdk.init() integrations"
    )
```

This kills the mutant that removes `CeleryIntegration()` from the list. Without explicit listing, Sentry SDK may or may not auto-discover the integration depending on SDK version. Explicit is safer.

---

## Week 2: Supply Chain — axios GHSA-3p68-rc4w-qgx5 SSRF

Week 2's security work was a single commit: `2e5bc2fd fix(web): upgrade axios 1.13.5 → 1.15.0 (GHSA-3p68-rc4w-qgx5 SSRF)`. One-line change in `apps/web/package.json`. The value is in what the vulnerability is, why it matched our usage pattern, and how the audit loop caught it automatically.

### The Vulnerability

GHSA-3p68-rc4w-qgx5 is a Server-Side Request Forgery bug in axios versions before 1.15.0. The intended behavior when `baseURL` is configured:

```ts
const api = axios.create({ baseURL: 'https://api.example.com' })
await api.get('/users')          // → GET https://api.example.com/users
await api.get('users')           // → GET https://api.example.com/users
```

The vulnerable behavior was: an absolute URL passed to `api.get()` silently overrode `baseURL`:

```ts
// Before 1.15.0: if the URL string parses as absolute, baseURL is ignored
await api.get('http://169.254.169.254/latest/meta-data/')
// → actually hit http://169.254.169.254/... on the server running this code
```

If any user-controlled string ever reached `api.get()` as a URL parameter, an attacker could point the request at an internal address (localhost, the AWS metadata endpoint at 169.254.169.254, the Kubernetes metadata service, etc.). The server would happily make the request because axios treated it as just another absolute URL.

### Why Our Codebase Matches the Risk Profile

SIRA uses axios in exactly the pattern the vulnerability targets. The `api` client in `apps/web/src/lib/api.ts`:

```ts
const api = axios.create({ baseURL: getApiBaseUrl() })
```

Every hook calls `api.get(url)` or `api.post(url, body)` with `url` as a relative path. The assumption everywhere in the codebase is: "whatever I pass here goes to our own API." That assumption is exactly what SSRF-via-absolute-URL breaks.

We do not currently pass user-controlled URL fragments into axios — no user input flows into `api.get(userInput)` anywhere. So the vulnerability has no exploitable path in our code today. But the point of keeping up with supply chain advisories is not to wait until there IS an exploitable path. A future feature that builds a URL fragment from user input (proxying a resource by name, say) would pick up an SSRF vector for free, silently, because the dev writing it would reasonably assume axios respects `baseURL`.

### How the Audit Loop Caught It

The pipeline runs `pnpm audit` as part of the `security:sast` quality stage. Every MR pipeline produces a report:

```
axios  <1.15.0
Severity: high
Server-Side Request Forgery in axios - https://github.com/advisories/GHSA-3p68-rc4w-qgx5
Patched in >=1.15.0
fix available via `pnpm update axios --latest`
```

The advisory was published, the next MR pipeline flagged it, the fix was a minor version bump. No dedicated effort, no scheduled review, no "security sprint." Just a CI signal during the normal flow.

The fix landed April 10, days after the advisory was published. This is a direct function of the per-MR audit loop being in place; the alternative (quarterly scans, pre-release reviews) would have left this sitting in the tree for weeks.

### Why a Minor Version Bump Was Safe

Axios follows semver strictly. The 1.13.5 → 1.15.0 jump spans two minor versions but no API surface change. The one behavior change affecting callers:

```ts
// Before 1.15.0
await api.get('http://evil.example.com/leak')
// → request went to http://evil.example.com/leak (baseURL ignored)

// After 1.15.0
await api.get('http://evil.example.com/leak')
// → throws: absolute URL rejected when baseURL is set
```

Any code legitimately calling `api.get(someAbsoluteUrl)` would break. I searched the codebase and found none — every call site uses a relative path. Safe to apply directly. The test suite passed after the upgrade, confirming the interceptor logic (401 → login redirect, toast on non-2xx) was unaffected.

---

## Three Failure Modes Worth Naming

**Mode 1: Skip the upgrade because SSRF is not exploitable in our code today.**
True today, likely not forever. Security fixes on dependencies should not be conditional on "are we vulnerable right now" — they should apply as advisories ship, because the code that WILL become vulnerable has not been written yet.

**Mode 2: Jump to the latest major (2.x if it existed).**
Axios does not have a 2.x, but the principle matters: a security advisory is a reason to upgrade to the minimum patched version, not to rush a major jump. Separate concerns: patch the CVE, evaluate major upgrades on a separate schedule.

**Mode 3: Pin exact (`1.15.0`) instead of caret (`^1.15.0`).**
I kept the caret range. Pinning exact versions makes every future CVE fix in the 1.x line require a manual PR, adding latency between advisory and deploy. Caret lets `pnpm update` pull in patches automatically.

---

## Results

| Fix | Layer | OWASP Category | Week |
|-----|-------|----------------|:----:|
| Auth on GET client endpoints | App code | A01 (Broken Access Control) | 1 |
| Auth bypass via `fetch()` (caught in review) | App code | A01 (Broken Access Control) | 1 |
| Sentry + CeleryIntegration | Observability | A09 (Security Logging) | 1 |
| axios SSRF upgrade | Supply chain | A08 (Software and Data Integrity Failures) | 2 |

Week 1 was app-code security (things humans in this repo wrote or caught in review). Week 2 was supply-chain security (things ecosystem actors published that we had to accept or reject). Both layers need attention; neither is sufficient alone.

---

## Evidence

- MR !154 — [SIRA-82](https://linear.app/ppl-sira/issue/SIRA-82): add auth to GET client API endpoints
- MR !155 review — [SIRA-147](https://linear.app/ppl-sira/issue/SIRA-147): auth bypass P0 caught in CSV import review
- MR !105 — [SIRA-135](https://linear.app/ppl-sira/issue/SIRA-135): Sentry instrumentation for Celery tasks
- Commit `2e5bc2fd` — fix(web): upgrade axios 1.13.5 → 1.15.0 (GHSA-3p68-rc4w-qgx5 SSRF)
- Advisory: [GHSA-3p68-rc4w-qgx5](https://github.com/advisories/GHSA-3p68-rc4w-qgx5)
- Source: `apps/api/src/app/routers/clients.py`, `apps/api/src/app/workers/celery_app.py`, `apps/web/src/lib/api.ts`, `.gitlab-ci.yml` (`security:sast` job)
