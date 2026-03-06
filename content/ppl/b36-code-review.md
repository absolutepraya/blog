---
title: "PPL: Code Review - Architecture Violations, Performance Bugs, and Runtime Errors"
date: 2026-03-04
description: "Detailed breakdown of code review contributions across 4 teammates' merge requests, covering architecture violations, performance patterns, and runtime bugs."
tags: ["ppl", "code-review", "collaboration", "fastapi"]
toc: true
aliases: ["/posts/ppl-b36-code-review/"]
---

## Overview

| MR | Feature | Issues |
|----|---------|--------|
| [!10](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/10) - SIRA-31 | Payment recording (dafandikri) | 2 |
| [!12](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12) - SIRA-30 | Invoice management (froklax) | 7 |
| [!17](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/17) - SIRA-29 | Client management (fadhli) | 1 |
| [!20](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20) - SIRA-27 | Layout and dashboard (haliza) | 1 |

11 issues total. Each review included specific file and line references.

---

## MR !10 - Payment Recording (2 issues)

**Issue 1: `.single()` causes an unhandled 500 on missing records.**

`get_payment_by_id` used `.single()` which throws `PostgRESTError (PGRST116)` when no row is found, making the `if payment is None` guard below it dead code. The fix is `.maybe_single()`, which returns `None` cleanly. The same fix was already applied in MR !23 for `app_users.py`.

**Issue 2: Tests silently skipped by pytest.**

New test files were placed in `apps/api/src/app/tests/` but `pyproject.toml` sets `testpaths = ["tests"]` (resolving to `apps/api/tests/`). CI was passing because pytest never collected the tests, not because they passed.

---

## MR !12 - Invoice Management (7 issues)

The most detailed review of the sprint.

| # | Category | Issue |
|---|----------|-------|
| 1 | Bug | `.single()` bug reintroduced in `payments.py` - same MR that fixed it in `invoices.py` |
| 2 | Bug | Tests in wrong directory (same as above) |
| 3 | Logic | Null-check on `response` (always-truthy `APIResponse` object) instead of `response.data` - guard never triggers |
| 4 | Convention | `routeTree.gen.ts` manually edited - auto-generated file, must not be modified per `apps/web/CLAUDE.md` |
| 5 | Performance | `PaymentHistory` calls `usePayments()` globally then filters by `invoiceId` client-side, when `InvoiceDetail.payments` from the parent query already has the data |
| 6 | Architecture | `InvoiceService` and `PaymentService` import and raise `HTTPException` directly - service layer must not have HTTP concerns |
| 7 | API design | `GET /payments/` and `GET /payments/{id}` return `dict[str, Any]` with no `response_model`, while `PaymentResponse` already exists and is used by `POST /` |

Issue #5 is a frontend data-fetching inefficiency: a global fetch followed by client-side filtering, when the required data is already present in the parent query's response.

---

## MR !17 - Client Management (1 critical issue)

**Empty `ENCRYPTION_KEY` causes a runtime crash on any client create or update.**

`config.py` allows empty strings through its validator:

```python
# config.py L17-L21
@validator("encryption_key")
def validate_encryption_key(cls, v: str) -> str:
    if not v:
        return v  # empty string passes through
    ...
```

But `encrypt()` passes the empty string to `base64.urlsafe_b64decode("")` which returns `b""`, and `AESGCM(b"")` raises `ValueError` because AES-GCM requires a 128, 192, or 256-bit key.

Any developer following `.env.example` (which leaves `ENCRYPTION_KEY=` blank) will hit an unhandled 500 on the first `POST /clients/`. The validator and the encryption layer contradict each other.

Referenced: `apps/api/src/app/config.py` L17-21, `apps/api/src/app/lib/encryption.py` L9-15.

---

## MR !20 - Layout and Dashboard (1 issue + rebase)

**`routeTree.gen.ts` was manually edited.**

The file header says "You should NOT make any changes in this file as it will be overwritten." The correct approach: add or move route source files and let TanStack Router's Vite plugin regenerate the route tree on `make dev` or `make build`.

The branch also predated three fixes already merged to main (commits `86b0f96`, `d5b3466`, `1e8772e`), so a rebase onto current main was requested before merge.

---

![MR comment thread - review feedback with file and line references on GitLab](/images/ppl/mr-review.png)

## Evidence

- [MR !10](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/10) - Note 4378
- [MR !12](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12) - Note 4383
- [MR !17](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/17) - Note 4579
- [MR !20](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20) - Note 4601
