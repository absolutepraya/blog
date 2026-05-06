---
title: "[S3, W3] PPL: Security via Narrow Scope and Defense-in-Depth"
date: 2026-05-06
description: "A surgical CSP relaxation that preserves strict policy on every non-docs route, a type-to-confirm safety guard preventing accidental bulk deletes, and a three-layer defense-in-depth setup that prevents real Telegram API calls from leaking into CI."
tags: ["ppl", "security"]
slug: "s3w3-security"
toc: true
---

## What I Worked On

Three security-relevant interventions this week. None of them is a vulnerability fix in the strict sense; each is a structural choice that shrinks blast radius. MR !256 narrowly relaxes CSP only on docs paths, MR !257 adds a UX safety guard against accidental bulk deletes, and MR !260 + a CI commit form a three-layer defense-in-depth that ensures the Telegram service never makes real API calls from CI.

## CSP: Relaxed Only Where Needed (MR !256)

A naive CSP fix for the Swagger UI bug would have looked like "add `cdn.jsdelivr.net` to script-src globally." The security cost of that decision is real: every route on the API would suddenly accept JavaScript from that CDN. If the CDN ever serves compromised content, every API endpoint becomes an attack surface, not just `/docs`.

The narrow fix in MR !256 isolates the CSP relaxation to exactly the three Swagger paths:

```python
if request.url.path in {"/docs", "/redoc", "/docs/oauth2-redirect"}:
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://fastapi.tiangolo.com"
    )
else:
    response.headers["Content-Security-Policy"] = "default-src 'self'"
```

Three things matter here:

**The whitelist is exactly what Swagger needs**, no more. `cdn.jsdelivr.net` is on Cloudflare's verified-origin list and serves Swagger UI's official builds. `fastapi.tiangolo.com` is the FastAPI project's own host. `'unsafe-inline'` is required only because Swagger's bootstrap script is inline (and the alternative — pinning specific hashes — is fragile across Swagger version bumps).

**Every other route keeps the strict policy.** A test in the suite asserts this: `test_non_docs_routes_keep_strict_csp` calls `/api/clients` and verifies `cdn.jsdelivr.net` is not in its CSP. If a future contributor accidentally widens the relaxation, the test fails.

**Other security headers are unchanged on the docs paths.** `X-Frame-Options: DENY` still prevents Swagger from being iframed by attackers. `Strict-Transport-Security: max-age=31536000` still enforces HTTPS. Only the CSP changes, and only the directives Swagger actually needs change.

The principle: **whitelist what's needed, never widen the default**. Every CSP exception should answer the question "what's the minimal set of origins that makes this work?" not "what gets rid of the symptom?".

## Safety Guard: Type-to-Confirm for Bulk Delete (MR !257)

This sits in the security/safety borderlands. Bulk client delete in the AR Staff dashboard could wipe many clients in one click. Pre-MR, the only friction was a Confirm/Cancel dialog. A misclick on the wrong row plus a habituated "Confirm" reflex equals a row of customer records gone.

MR !257 (SIRA-315) brings bulk delete to parity with single delete: a 2-step Sheet where step 2 requires typing `hapus N klien` literally before the destructive button enables.

```typescript
const expectedPhrase = `hapus ${selectedCount} klien`
const isPhraseTyped = typedConfirmation === expectedPhrase
// Destructive button:
<Button variant="destructive" disabled={!isPhraseTyped} onClick={handleBulkDelete}>
    Hapus {selectedCount} Klien
</Button>
```

The friction is intentional. Typing `hapus 5 klien` exactly takes a few seconds, but those seconds are exactly when the user re-reads the count and the affected names. Misclicks become impossible because the typed phrase has to match the count being deleted.

The backend simplification is the corresponding move: removing the defensive "skip clients with invoices" branch from `client_service.bulk_action`. That defensive shim existed because, before SIRA-280's `ON DELETE CASCADE`, deleting a client with invoices would leave dangling rows. With cascade in place, the skip is dead code AND it was masking the real protection (the UI gate). Removing it makes the security model legible: the gate is in the UI; the backend trusts the gate.

The principle: **add friction proportional to blast radius**. Single delete had type-to-confirm; bulk delete should too, with the count as part of the confirmation phrase.

## Defense-in-Depth: Three Layers Preventing Real Telegram Calls in CI (MR !260 + `342fe950`)

S3W2's MR !234 added a service-layer guard: `TelegramService` checks `ENVIRONMENT in {"test", "testing"}` and short-circuits before making real API calls. The guard worked, but two leaks remained:

1. Some tests didn't set `ENVIRONMENT=test`, so the guard didn't fire
2. The integration test suite re-imports the app and bypasses the per-test fixture

Three layers of defense closed both gaps:

**Layer 1 — service-layer guard** (existing, from S3W2 MR !234):

```python
def _send_actual(self, chat_id: int, text: str, ...) -> dict:
    env = os.environ.get("ENVIRONMENT", "").lower()
    if env in {"test", "testing"}:
        return {"skipped": True, "reason": "test environment"}
    # ... real API call
```

**Layer 2 — autouse pytest fixture** (new, MR !260):

```python
# apps/api/tests/conftest.py
@pytest.fixture(autouse=True)
def silence_telegram_in_tests(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
```

This fires for every test in the suite without anyone having to remember to set the env var.

**Layer 3 — CI job-level env var** (new, direct commit `342fe950`):

```yaml
api:integration-test:
  variables:
    ENVIRONMENT: "test"

mutation:python:
  variables:
    ENVIRONMENT: "test"
```

This sets the variable at the GitLab job level, so even tests that bypass `conftest.py` (or contexts where the autouse fixture doesn't apply) still hit the guard.

Why three layers for what looks like a single concern? Because each layer fails differently:

- Service-layer guard fails if a test directly calls the underlying `httpx` client, bypassing `TelegramService`
- Autouse fixture fails if the test uses a fresh `monkeypatch` scope or runs outside `conftest.py` reach
- CI job env var fails if the test runs locally outside CI

With all three, every realistic failure mode of one layer is caught by another. The cost of three layers is two extra commits (the fixture and the CI variable), small given the alternative is "real Telegram messages occasionally land in the team chat from CI runs."

The principle: **for any external side effect, set up multiple independent suppressors**. The cost is small; the cost of leakage is high (rate limit burn, real notifications to wrong recipients).

## What I Learned

The thread connecting these three: **prefer narrow + provable over global + plausible**. The CSP fix is provably narrow because three tests pin the scope. The bulk-delete UX gate is provably effective because the typed phrase has to match the count. The Telegram silencer is provably resilient because three layers each catch what the others miss.

Security work that "looks fine" is fragile. Security work that has a test or a structural property pinning the safety claim is durable.

## Evidence

- [MR !256 SIRA-314 unblock Swagger UI behind strict CSP](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/256) — narrow CSP relaxation, 3 pinning tests
- [MR !257 SIRA-315 type-to-confirm bulk client delete](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/257) — UX safety guard with typed phrase
- [MR !260 silence telegram in tests via autouse dry-run fixture](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/260) — autouse pytest fixture
- Direct commit `342fe950` — `ENVIRONMENT=test` on integration-test and mutation:python CI jobs (third layer of defense)
- Source: `apps/api/src/app/middleware/security_headers.py`, `apps/api/tests/conftest.py`, `apps/web/src/components/clients/bulk-delete-sheet.tsx`, `.gitlab-ci.yml`
