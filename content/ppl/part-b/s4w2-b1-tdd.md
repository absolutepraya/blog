---
title: "[S4, W2] PPL: TDD Caught Three Tests That Were Lying"
date: 2026-05-20
description: "Strict red-green discipline on a P0 RBAC bypass closure didn't just produce 9 new integration tests; it surfaced 3 existing tests in the suite that had been silently testing the bug. Two red-green pairs, one refactor, and a lesson about why tests-as-evidence is not the same as tests-pinning-a-contract."
tags: ["ppl", "tdd"]
slug: "s4w2-tdd"
toc: true
---

## What I Worked On

The TDD work this week landed inside [MR !310 (SIRA-374)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310), the RBAC bypass closure. Same MR I wrote about for b6 security, different angle here. b6 was about *what got fixed*. b1 is about *how the red-green discipline produced the fix*, and specifically about the moment the red test exposed three existing tests that had been wrong the whole time.

The MR ships with 2 red(api)/green(api) pairs, 1 test(api) regression-guard commit, and 1 refactor(api) cleanup, all preserved in the pre-squash history on `abhip/fix/SIRA-374-rbac-bypass-fix`. This blog walks one of those pairs in detail, then explains the false-positive discovery.

## The Two Red-Green Pairs

Pre-squash history, in order:

```
fefe2ad7 red(api): AR_STAFF must be forbidden from PUT /invoices/{id} amount on UNPAID
6a7c7c22 green(api): widen InvoiceService.update AR_STAFF gate to all statuses for amount/due_date
b2566086 red(api): AR_STAFF must be forbidden from POST /invoices/{id}/cancel
5dae48de green(api): gate InvoiceService.cancel by actor_role for AR_STAFF rejection
c22a5467 test(api): regression guards for RBAC contract across legal/financial/cancel paths
54df6499 chore(api): align SIRA-364 expansion tests with SIRA-374 stricter gate
34523a2d refactor(api): extract _map_permission_error helper for AR_STAFF gate routing
```

Two security holes, two red commits, two minimal green commits. Then one batch of regression guards, one chore to update tests broken by the stricter gate, and one refactor that touches no behavior. The discipline is visible at the commit level; reviewers don't have to take my word for it.

## What the First Red Commit Pinned

The first red commit (`fefe2ad7`) added one integration test that named the contract: AR_STAFF must not be able to change `amount` on a `PUT /invoices/{id}` when the invoice is in `UNPAID` status. Stripped of fixtures, the test body is:

```python
@pytest.mark.integration
def test_ar_staff_cannot_edit_invoice_amount_on_unpaid_status(
    test_client: TestClient,
    ar_staff_token: str,
    real_db: Client,
) -> None:
    """AR_STAFF must not change amount on UNPAID invoices (SIRA-374 P0 closure).

    SIRA-364 only blocked amount edits on PARTIAL invoices. This test pins
    that the gate must extend to UNPAID and OVERDUE statuses too.
    """
    client_id = _seed_client(real_db, company_name="Test Corp")
    invoice_id = _seed_invoice(
        real_db, client_id, amount=1_000_000, status="UNPAID"
    )

    response = test_client.put(
        f"/api/invoices/{invoice_id}",
        headers={"Authorization": f"Bearer {ar_staff_token}"},
        json={"amount": 2_000_000},
    )

    assert response.status_code == 403
    assert "AR_STAFF" in response.json()["detail"]
```

When that commit checks out cleanly, the test fails. `InvoiceService.update` happily writes the new amount because nothing in the call path checks the actor's role for UNPAID status. The 403 assertion fails with a 200, and the `"AR_STAFF" in detail` assertion fails because there is no error message at all.

The green commit (`6a7c7c22`) is small. It widens the existing SIRA-364 PARTIAL-only gate to all statuses when `amount` or `due_date` is in the payload:

```python
# Before (SIRA-364 narrow gate):
if status == "PARTIAL" and actor_role == ROLE_AR_STAFF:
    if "amount" in update_data or "due_date" in update_data:
        raise PermissionError(
            "Cannot change amount or due_date on PARTIAL invoices."
        )

# After (SIRA-374 widened gate):
if actor_role == ROLE_AR_STAFF:
    if "amount" in update_data or "due_date" in update_data:
        raise PermissionError(
            "AR_STAFF cannot change amount or due_date on invoices; "
            "submit a permission request for admin review."
        )
```

The diff is two lines moved out of the `if status == "PARTIAL"` block. The new test passes. So do all the existing tests for PARTIAL invoices, because PARTIAL is a subset of "all statuses." Minimal change, minimal blast radius.

## The Refactor Came Last

The refactor commit (`34523a2d`) is the smallest of the seven and pure cleanup. After both green commits landed, two routers (`cancel_invoice` and `update_invoice`) had the same boilerplate for translating `PermissionError` into a 403:

```python
# Before (duplicated in both routers):
try:
    return await invoice_service.cancel(invoice_id, actor_role=user.role)
except PermissionError as exc:
    raise HTTPException(status_code=403, detail=str(exc)) from exc
```

Extracted to a one-liner helper because three call sites need it (the third was already in the pipeline for the next sprint):

```python
def _map_permission_error(exc: PermissionError) -> HTTPException:
    return HTTPException(status_code=403, detail=str(exc))
```

The refactor commit changes zero behavior. All 372 integration tests stay green, all 2462 unit tests stay green. The reason this is its own commit and not folded into the green commits is the rule from CLAUDE.local.md: refactor commits must have all tests green and zero behavior change. Mixing the refactor into a green commit would have made the diff harder to review and harder to revert if a later change needed the inline form back.

## The Discovery: Three Tests Were Already Lying

Here is where TDD paid off in a way I did not expect. When the second green commit (`5dae48de`) landed, three pre-existing tests in `test_invoice_router.py` started failing. The tests had names like:

```python
def test_cancel_invoice_returns_200(test_client, token, real_db): ...
def test_update_invoice_amount_succeeds(test_client, token, real_db): ...
def test_cancel_invoice_marks_status_canceled(test_client, token, real_db): ...
```

Reading those names cold, you'd think they assert the happy path: a legitimate user can cancel and edit invoices. The problem: the `token` fixture in that file resolved to a default user, which happened to be AR_STAFF in the test setup. Each of those tests had been asserting `200 OK` on an action that should have required admin role.

In the pre-fix world the tests passed because the bug was the behavior. They were green for the wrong reason. The new gate broke them by enforcing the correct rule.

`chore(api): align SIRA-364 expansion tests with SIRA-374 stricter gate` (`54df6499`) updated those three tests to use `admin_integration_client` instead of the default token. Now they assert the right thing: admin can cancel and edit, end of story. AR_STAFF is covered by the new negative tests in `test_rbac_enforcement_integration.py`.

This is the false-positive failure mode that the rubric for b1 calls out: existing tests that give you confidence the system is correct, when actually they pin the bug. The only way to catch them is to **add a new test that contradicts the bug**, and watch the existing suite light up. Without the red commit, those three tests would have continued to silently pass for the rest of the project's lifetime, and the SIRA-374 audit finding would have been closed without anyone realizing the suite had been wrong.

## Counts and Coverage

Numbers at merge:

| Category | Count |
|----------|------:|
| `red(api):` commits in this MR | 2 |
| `green(api):` commits in this MR | 2 |
| `test(api):` regression-guard commit | 1 |
| New tests in `test_rbac_enforcement_integration.py` | 9 |
| Tests fixed (were silently buggy) | 3 |
| Unit tests passing repo-wide | 2462 |
| Integration tests passing repo-wide | 372 (was 369) |

The integration test delta under-counts because the new 9 tests minus the 3 tests that were already there (now using different fixtures) plus the 3 stricter-contract updates in `test_rbac_expansion_integration.py` net to a smaller number than the "9 added" headline. That's fine. What matters is that every behavioral change in the MR has at least one test asserting the new contract, and no behavioral change was made without a failing test landing first.

## Beyond Red-Green: How the Project Reinforces TDD

The rubric for b1 score 4 asks for "extra tools or methodology that make testing more efficient." A few patterns the SIRA project uses that go beyond vanilla red-green:

- **Commit-prefix enforcement**: CLAUDE.local.md mandates `red(scope):` / `green(scope):` / `refactor(scope):` prefixes for any feature/fix branch. The pre-push hook checks branch naming, not commit prefixes, but the team's review culture flags any commit that doesn't fit the pattern. This makes TDD discipline observable from git log alone, not just claimed.
- **`@pytest.mark.integration` separation**: integration tests live behind a marker so the default `pytest` run stays fast for the inner red-green loop. Only the pre-push hook and CI run the integration tier. Without this, the 60+ second integration boot time would have made the red-green loop impractical.
- **Real-DB fixtures**: `real_db` and `*_integration_client` fixtures hit a real Supabase instance. Mocking the DB would have hidden the SIRA-374 bug entirely (a mocked PUT call returns whatever the mock decides). The bug was at the contract boundary between router auth and service-level enforcement; only an end-to-end test through real HTTP and a real DB exercises that boundary.
- **Mutation testing (mutmut + Stryker)**: CI runs mutmut on the API and Stryker on the web. A test that fails to kill mutations is a test that doesn't actually pin behavior. The MR !310 tests are mutation-resilient because the 403 assertion plus the `"AR_STAFF" in detail` assertion both fail when the gate is removed; replacing `raise PermissionError(...)` with `pass` would make multiple mutations survive without the contract assertions.

## What I Learned

**Tests that pass for the wrong reason are worse than missing tests.** Missing tests at least don't lie. The three buggy tests in `test_invoice_router.py` were giving false confidence to anyone reading coverage numbers. The fix is to assert specifics: not "user can cancel invoice" but "admin can cancel invoice and AR_STAFF cannot." Naming the role in the test name is mechanical but it forces the discipline.

**The refactor commit is the cheapest insurance.** Splitting `_map_permission_error` out into its own commit took about three minutes. If reviewers later wanted to revert just the refactor and keep the security fix, it's one `git revert 34523a2d` away. Bundling the refactor into a green commit would have made that impossible without manually rewriting history.

**Red-first works even when the implementation feels obvious.** The SIRA-374 fix is two lines moved up and out of an `if` block. I knew exactly what code to write before I wrote the red. Doing the red anyway took maybe 10 extra minutes. The payoff was finding the three lying tests, which I would not have caught any other way.

## Evidence

- [MR !310 SIRA-374 fix(api): enforce server-side RBAC on cancel_invoice and edit_invoice_financial](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310)
- [Linear SIRA-374](https://linear.app/ppl-sira/issue/SIRA-374)
- Pre-squash red-green pairs: `fefe2ad7`/`6a7c7c22` (financial-edit gate), `b2566086`/`5dae48de` (cancel gate)
- Regression-guard commit: `c22a5467` (legal/financial/cancel paths)
- Chore commit fixing silently-buggy tests: `54df6499`
- Refactor commit (zero behavior change): `34523a2d` (`_map_permission_error` helper)
- New test file: `apps/api/tests/test_rbac_enforcement_integration.py` (9 integration tests)
- Updated test file: `apps/api/tests/test_rbac_expansion_integration.py` (3 stricter-contract updates)
- Updated test file: `apps/api/tests/routers/test_invoice_router.py` (3 silently-buggy tests fixed)
- Squash commit: `f0b96485` on main
- TDD conventions: `CLAUDE.local.md` (red/green/refactor commit prefix policy)
- Mutation testing: `mutmut` (api) and `Stryker` (web) run on MR pipelines per `.gitlab-ci.yml`
