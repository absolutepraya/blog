---
title: "[S3, W3] PPL: Narrow Fixes Over Broad Strokes"
date: 2026-05-06
description: "A surgical CSP relaxation that only touches docs paths, type-to-confirm UX parity that prevents a class of accidental data loss, an autouse fixture pattern that silences a noisy external API in tests, and an approval-with-walkthrough on a SonarQube fix MR."
tags: ["ppl", "code-quality"]
slug: "s3w3-code-quality"
toc: true
---

## What I Worked On

Four code-quality interventions this week, each one chosen as the narrowest fix that solves the actual problem. The tempting alternative for each was a broader change that would have introduced its own risks.

## Narrow CSP Relaxation Instead of Global Whitelist (MR !256)

The bug: production Swagger UI at `/docs` was rendering blank because the strict `default-src 'self'` Content-Security-Policy blocked Swagger's CDN-hosted assets. The tempting fix is to add `cdn.jsdelivr.net` to the global script-src and call it done. That would make `/docs` work, but it would also let every other route load arbitrary JavaScript from that CDN.

The narrow fix in MR !256 (SIRA-314):

```python
# apps/api/src/app/middleware/security_headers.py
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    if request.url.path in {"/docs", "/redoc", "/docs/oauth2-redirect"}:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com"
        )
    else:
        response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response
```

The whitelist hits exactly three origins (jsdelivr CDN, the FastAPI favicon host, and inline scripts that Swagger needs to bootstrap), only on the three docs paths, and every other security header (X-Frame-Options, HSTS) stays unchanged on those paths too. Three tests pin this down so a future refactor can't accidentally widen the scope:

```python
@pytest.mark.parametrize("path", ["/docs", "/redoc", "/docs/oauth2-redirect"])
def test_docs_paths_get_relaxed_csp(path):
    response = client.get(path)
    assert "cdn.jsdelivr.net" in response.headers["content-security-policy"]
    assert "'unsafe-inline'" in response.headers["content-security-policy"]

def test_non_docs_routes_keep_strict_csp():
    response = client.get("/api/clients")
    assert "cdn.jsdelivr.net" not in response.headers["content-security-policy"]
    assert response.headers["content-security-policy"] == "default-src 'self'"

def test_security_headers_unchanged_on_docs_paths():
    response = client.get("/docs")
    assert response.headers["x-frame-options"] == "DENY"
    assert "max-age=31536000" in response.headers["strict-transport-security"]
```

The lesson here is that **quality is about what your fix doesn't break, not just what it fixes**. A global whitelist would have fixed the symptom and weakened security everywhere else; the narrow fix solved the problem without that trade.

## Type-to-Confirm UX Parity (MR !257)

Bulk client delete used to be a one-step Dialog: select clients, click Delete, done. Single-client delete had been upgraded earlier (SIRA-280) to a 2-step Sheet with type-to-confirm. The bulk action lagged behind, which created a worse UX for the more dangerous operation.

MR !257 (SIRA-315) brings bulk delete to parity:

- Step 1 lists selected clients with an invoice-count badge per client and a destructive warning
- Step 2 (only shown when at least one client has invoices) requires the user to type `hapus N klien` literally before the destructive button enables
- When no selected client has invoices, step 1's destructive button deletes immediately (matches single-delete fast path)

The quality angle: **the more dangerous the operation, the higher the friction should be**. Single-delete already had this friction; bulk-delete (which can wipe many clients in one click) had less. The parity fix closes the asymmetry without inventing a new pattern, it reuses the existing `DeleteClientSheet` flow that the team already knew.

Backend change is small but important: `client_service.bulk_action` no longer pre-fetches invoices and skips clients that have them. That earlier "skip" behavior was a defensive shim from before the SIRA-280 cascade migration. Now that ON DELETE CASCADE handles invoices/payments/history atomically, the skip is unnecessary noise. Removing it simplified the service and let the toast drop the half-sentence "X dilewati (memiliki invoice)" — `skipped` is always 0 from this loop now.

## Autouse Fixture for Telegram Silencer (MR !260)

S3W2's MR !234 added a service-layer guard that prevents Telegram service calls when `ENVIRONMENT=test`. The guard worked, but tests still had to set the env var explicitly per test, and a few stragglers were still calling the real Telegram API in CI because they didn't set it.

MR !260 promotes the silencer to an autouse pytest fixture:

```python
# apps/api/tests/conftest.py
@pytest.fixture(autouse=True)
def silence_telegram_in_tests(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
```

Plus a CI side: direct main commit `342fe950` set `ENVIRONMENT=test` explicitly on the integration-test and mutation:python jobs in `.gitlab-ci.yml`, so even tests that don't use the autouse fixture (e.g., the integration suite that re-imports the app) still hit the guard.

This is defense-in-depth for a known failure mode. The guard exists at the service layer, the autouse fixture sets the env var per-test, and the CI job sets it at the job level. Any single layer being misconfigured doesn't leak real Telegram API calls into CI.

The pattern (autouse fixture for cross-cutting test setup) is one I'd reach for again. Anything that should be true for every test in a suite (env vars, mock setup, time freezing) belongs in a single autouse fixture rather than in every test's setup.

## Approval With Local Walk-Through (MR !242)

@fadhliraihan's MR !242 was a sweep of low-priority SonarQube issues. SonarQube fixes are a particular review trap: they look like clean cosmetic changes but can quietly change behavior. Renaming a variable from `result` to `result_value` is fine. Replacing `if x is not None and x > 0` with `if x` is not, because the second form treats `0` as false where the first explicitly didn't.

I worked through the diff locally before approving, checking each cluster of changes against the actual behavior. Everything in this MR was genuinely cosmetic (renames for readability, removing dead expressions, simplifying Boolean returns), so the approval went through. The discipline is the walk-through itself: a rubber-stamp approval on a SonarQube fix MR is the kind of thing that ships a behavior regression at a moment when nobody's looking for it.

## What I Learned

Quality work this week was mostly about **scope discipline**. Each of the four interventions had a tempting broader version that would have introduced its own problems:

- Broader CSP relaxation → security regression
- Broader UX flow changes → inventing new patterns the team would have to learn
- Broader test refactor → autouse fixtures everywhere become hard to reason about
- Rubber-stamp approval → behavior regression slipping through "cosmetic" fixes

Pick the narrowest fix that solves the actual problem. Pin the scope with tests so it stays narrow.

## Evidence

- [MR !256 SIRA-314 unblock Swagger UI behind strict CSP](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/256) — narrow CSP relaxation + 3 pinning tests
- [MR !257 SIRA-315 type-to-confirm bulk client delete](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/257) — UX parity with single-delete
- [MR !260 silence telegram in tests via autouse dry-run fixture](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/260)
- [MR !242 approval after local walk-through](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/242)
- Direct commit `342fe950` — set `ENVIRONMENT=test` on integration-test and mutation:python CI jobs (defense-in-depth for Telegram silencer)
- Source: `apps/api/src/app/middleware/security_headers.py`, `apps/api/tests/conftest.py`, `apps/web/src/components/clients/bulk-delete-sheet.tsx`
