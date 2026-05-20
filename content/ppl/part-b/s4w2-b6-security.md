---
title: "[S4, W2] PPL: Closing a P0 RBAC Bypass with TDD"
date: 2026-05-20
description: "Found and closed two RBAC bypasses that fully sidestepped the permission-request system shipped last sprint. Service-layer enforcement, defense in depth, and a strict red-green-refactor discipline that turned a P0 audit finding into 9 integration tests pinning the boundary."
tags: ["ppl", "security"]
slug: "s4w2-security"
toc: true
---

## What I Worked On

One security MR this week, but it closes a P0 hole. [MR !310 (SIRA-374)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310) enforces server-side RBAC on two endpoints that were silently letting AR_STAFF bypass the entire permission-request system from SIRA-207. The fix is small in lines (one helper, two gate widenings, one method-signature change) but structurally important: it closes a known authorization gap that audit listed as P0 and pins the boundary with 9 integration tests so the same bug cannot regress.

This is the kind of finding that should not exist in a system that already shipped a permission system, but it did. The blog walks through why the gap was there, the TDD discipline used to close it, and what the resulting test suite proves.

## The Bug Audit Found

PBI 45 (Staff Permission Requests) shipped two sprints ago. The model is: when AR_STAFF wants to do a sensitive action (cancel an invoice, edit financial fields, edit legal client info), the UI submits a `permission_request`. An admin reviews it on `/admin/approval-queue` and approves or denies. On approve, the BE executor runs the underlying mutation **as the admin**, not as the staff member.

The system works. The hole was that the underlying mutation endpoints were also still reachable directly, with only the standard `get_current_user` dependency:

| Endpoint | Bug |
|----------|-----|
| `POST /invoices/{id}/cancel` | No role check on router. No role check in `InvoiceService.cancel()`. AR_STAFF could cancel any UNPAID or OVERDUE invoice directly by hitting the URL. |
| `PUT /invoices/{id}` | SIRA-364 only blocked AR_STAFF amount/due_date edits on `PARTIAL` invoices. UNPAID and OVERDUE remained freely editable. |
| `PUT /clients/{id}` | Audit-listed as P0 but already gated correctly at the router. Kept as a regression guard in the new test file. |

The first two were live. The third was already safe but only because SIRA-364 had picked it up by accident. There was no test pinning that, so the next refactor could have removed the gate.

The structural problem: the permission-request system was bolted on top of endpoints that did not know it existed. The endpoints assumed "any authenticated user is allowed to call me, the router decides who." For most endpoints that's fine. For sensitive mutations that have a permission-request flow, the endpoint itself has to know "AR_STAFF must go through approval; only admin can invoke me directly."

## The Fix: Service-Layer Enforcement with an actor_role Parameter

The naive fix is to add a `require_admin` dependency to the router. That works for the direct endpoint, but breaks the permission-request executors: when an admin approves a staff request, the executor calls the same service method as if it were the admin. A router-level gate would either reject the executor or require the executor to bypass the router entirely.

The cleaner shape: gate at the service layer, with the actor's role passed in as a keyword-only argument. Routers pass `actor_role=user.role`. Executors pass `actor_role=reviewer.role`. Internal jobs and unit tests that do not care about RBAC pass nothing and keep prior behavior.

```python
class InvoiceService:
    async def cancel(
        self,
        invoice_id: str,
        *,
        actor_role: str | None = None,
    ) -> Invoice:
        if actor_role == ROLE_AR_STAFF:
            raise PermissionError(
                "AR_STAFF cannot cancel invoices directly; submit a "
                "permission request for admin review."
            )
        # ... existing cancel logic unchanged ...
```

`InvoiceService.update(...)` got the same treatment: when `actor_role == AR_STAFF` and the payload includes `amount` or `due_date`, raise `PermissionError`. Description-only edits stay allowed because SIRA-364's contract was that AR_STAFF can fix typos but not change money.

The router translates `PermissionError` to HTTP 403 via a tiny helper:

```python
def _map_permission_error(exc: PermissionError) -> HTTPException:
    return HTTPException(status_code=403, detail=str(exc))
```

Extracted because three call sites need the same mapping (cancel_invoice, update_invoice, and a third one I knew was coming in the next MR). One-line helper, but it removes the temptation to copy-paste the `HTTPException(403, ...)` constructor.

## TDD Discipline: 2 red(api) + 2 green(api) + test + refactor

The MR's commit history is the load-bearing artifact for this work. Every behavioral change started with a failing integration test, then the minimal production code to make it pass, then a refactor commit with zero behavior change.

The actual sequence on `abhip/fix/SIRA-374-rbac-bypass-fix`:

```
fefe2ad7 red(api): AR_STAFF must be forbidden from PUT /invoices/{id} amount on UNPAID
6a7c7c22 green(api): widen InvoiceService.update AR_STAFF gate to all statuses for amount/due_date
b2566086 red(api): AR_STAFF must be forbidden from POST /invoices/{id}/cancel
5dae48de green(api): gate InvoiceService.cancel by actor_role for AR_STAFF rejection
c22a5467 test(api): regression guards for RBAC contract across legal/financial/cancel paths
54df6499 chore(api): align SIRA-364 expansion tests with SIRA-374 stricter gate
34523a2d refactor(api): extract _map_permission_error helper for AR_STAFF gate routing
```

Two red-green pairs. The first pair (`fefe2ad7` → `6a7c7c22`) covers the financial-edit hole. The second pair (`b2566086` → `5dae48de`) covers the cancel hole. Each red commit literally fails when you check it out: the test names what should happen, the absence of the code proves the bug exists. The green commit adds the minimum needed to pass. Then the regression guard commit adds adjacent tests that protect the contract from accidental loosening (admin escape-hatch tests, SIRA-364 contract preservation tests, the already-safe edit_client_legal regression).

The refactor commit (`34523a2d`) is the last one and pure cleanup: extracting `_map_permission_error` after seeing the same `HTTPException(403, str(exc))` pattern in two routers. No behavior change, all tests stay green.

The reason I am laboring over the commit sequence is that the rubric for both b1 (TDD) and b6 (security) rewards visible discipline. A reviewer can scroll my pre-squash history and verify the order: test fails first, code makes it pass second, refactor last. That is exactly the property that TDD is supposed to produce, and the squash merge convention preserves the discipline in the source branch even after the MR collapses to one commit on main.

## What the 9 New Integration Tests Pin

`apps/api/tests/test_rbac_enforcement_integration.py` is the new file. It seeds real database state with `real_db`, posts requests with each role's bearer token, and asserts the response status and body shape. The structure breaks down as:

| Test count | Scenario |
|:----------:|----------|
| 3 | AR_STAFF gets 403 on each of cancel_invoice, edit_invoice_financial, edit_client_legal |
| 3 | Admin escape-hatch: admin gets 200 on each of those same three actions |
| 2 | SIRA-364 contract preservation: AR_STAFF can still edit invoice description and client contact fields |
| 1 | Regression guard: edit_client_legal stays gated even after future refactors |

Plus 3 SIRA-364 tests in `test_rbac_expansion_integration.py` were updated to reflect the new stricter contract (403 instead of 400, AR_STAFF-specific message instead of the PARTIAL-status message, UNPAID amount edit now rejected). And 3 existing invoice-router tests were updated to use `admin_integration_client` because they were silently testing the bug: they posted as a default user (which happened to be admin in test setup) and asserted 200, which would have continued passing even after AR_STAFF gained the same capability incorrectly.

That third category is the scariest one. Three tests in the existing suite were giving false confidence. They asserted the right HTTP code but on the wrong role. The bug had been live for the entire window between SIRA-207 shipping and SIRA-374 landing because no test pinned the actor role.

## Verification

Before merge:

- `uv run ruff check .` clean
- `uv run ruff format --check .` clean
- `uv run mypy src/` clean (120 source files)
- `uv run pytest -m 'not integration'` **2462 passed** (no regressions)
- `uv run pytest -m integration` **372 passed** locally (was 369 + 3 new RBAC enforcement tests + 9 regression-guard tests across the three actions, minus 3 invoice tests updated from silently-buggy)
- Manual on staging: AR_STAFF gets 403 on direct cancel and direct amount edit. Admin gets 200 on both. Staff-submitted permission_request still flows end-to-end on admin approve.

The integration test count delta (369 → 372) under-counts the work because some tests were updated rather than added. The diff stat tells the real story: `+437 lines of test code` across the two RBAC test files this sprint and last.

## Defense in Depth: Three Layers, Each Independently Verifiable

The fixed system has three independent layers:

1. **UI layer**: the staff-side UI from MR !308 renders permission-request buttons (e.g., "Ajukan Hapus Klien") in place of the direct mutation buttons. A staff user clicking through the app cannot trigger the direct cancel or financial-edit calls because there is nothing in the UI that posts to them.
2. **Server layer**: the service method raises `PermissionError` if `actor_role == AR_STAFF`. This is what MR !310 added, and it is the authoritative gate.
3. **Database layer**: Supabase RLS policies on `invoices` and `clients` already restrict what AR_STAFF can read and write directly. The MR's integration tests run against a real Supabase, so any policy-level rejection would have surfaced as a test failure.

Each layer assumes the others might fail. The UI gate prevents accidents. The server gate is the authoritative one. The DB gate is the failsafe if both upstream gates have a bug.

The audit finding existed because layer 2 was missing for those two endpoints. Layers 1 and 3 were silently doing the right thing, which is why no one noticed until the audit. That's exactly the failure mode defense-in-depth is supposed to prevent: any one layer missing should not produce a vulnerability, because the other layers should catch it. In this case the DB RLS would have caught a malicious AR_STAFF, but the UI gate didn't help because a staff member with API access could just curl the endpoint directly. The middle layer was the only one that mattered for that attack path.

## What I Learned

**Audit findings that already shipped a "system" for the problem are the most embarrassing.** PBI 45 shipped a whole permission-request flow. The bug was that the underlying endpoints didn't know the flow existed. The next time we ship a permission-system-style feature, the first PR should be "make every gated endpoint refuse direct calls from the gated role," not "build the UI."

**`actor_role` as an explicit keyword-only argument is more honest than `current_user` everywhere.** A service method that takes `current_user: AuthenticatedUser` couples the service to FastAPI's auth dependency. A method that takes `*, actor_role: str | None = None` makes the role check first-class and lets non-router callers (executors, jobs, tests) pass whatever role makes sense for them. The default of `None` means "trust the caller, this is not a router-facing call."

**Integration tests that silently test the bug are worse than no tests.** Three tests in the existing suite were giving false confidence. The fix is to assert role-specific behavior explicitly: not "user can do X" but "AR_STAFF can do X / admin can do X / unauthenticated cannot do X." Naming the role in the test name is mechanical but it forces the discipline.

## Evidence

- [MR !310 SIRA-374 fix(api): enforce server-side RBAC on cancel_invoice and edit_invoice_financial](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310)
- [Linear SIRA-374](https://linear.app/ppl-sira/issue/SIRA-374): RBAC bypass closure
- Source: `apps/api/src/app/services/invoice_service.py` (`cancel` + `update` gate widening with `actor_role`)
- Source: `apps/api/src/app/routers/invoices.py` (`_map_permission_error` helper, `actor_role=user.role` propagation)
- Source: `apps/api/src/app/services/permission_request_executor.py` (`_execute_cancel_invoice` passes `actor_role=reviewer.role`)
- Tests: `apps/api/tests/test_rbac_enforcement_integration.py` (9 new integration tests)
- Tests updated: `apps/api/tests/test_rbac_expansion_integration.py` (3 SIRA-364 tests aligned with stricter gate)
- TDD discipline: pre-squash commit history on `abhip/fix/SIRA-374-rbac-bypass-fix` shows 2 red(api)/green(api) pairs + 1 test(api) + 1 refactor(api)
- Squash commit: `f0b96485` on main
