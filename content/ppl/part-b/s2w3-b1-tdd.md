---
title: "PPL: Mutation Testing in SIRA [Sprint 2, Week 3]"
date: 2026-04-08
description: "How mutation testing with mutmut and Stryker revealed that high coverage alone does not guarantee meaningful tests, and what we changed to write tests that actually catch bugs."
tags: ["ppl", "tdd", "mutation-testing", "testing"]
slug: s2w3-tdd
toc: true
---

## What I Worked On

This week's testing work centered on a question: if we have 91% code coverage, does that mean our tests are good? The answer turned out to be "not necessarily." Setting up mutation testing with [mutmut](https://github.com/boxed/mutmut) (Python) and [Stryker](https://stryker-mutator.io/) (TypeScript) forced a rethink of what tests should actually assert.

---

## Why Coverage Is Not Enough

Code coverage tells you which lines were executed during tests. A test that calls `invoice_service.create()` and asserts `result is not None` gives 100% coverage on that function. But if the function had a bug (wrong status code, missing field, off-by-one), the test would not catch it.

Mutation testing takes a different approach. A mutation testing tool modifies your source code in small ways ("mutants"): flipping `>` to `>=`, replacing `== 200` with `!= 200`, changing a string constant. Then it runs your tests. If no test fails, the mutant "survives," which means your tests would not have caught that bug.

The mutation score is the percentage of mutants killed. 100% coverage with 0% mutation score is possible. It is not theoretical. We were essentially there.

---

## Python: mutmut Targeting the Services Layer

mutmut is configured in `apps/api/pyproject.toml`. The key decision was which code to mutate:

```toml
[tool.mutmut]
paths_to_mutate = ["src/app/services/"]
tests_dir = ["tests/"]
also_copy = ["src/", "conftest.py"]
pytest_add_cli_args = [
    "-m", "",
    "--ignore=tests/test_db_schema_and_seed.py",
    "--ignore=tests/test_schemathesis.py",
    "--ignore=tests/test_client_seed.py",
    "--ignore=tests/test_invoice_seed.py",
    "--ignore=tests/test_payment_seed.py",
    "--ignore=tests/test_settings_router.py",
    "--ignore=tests/test_session_router.py",
    "--ignore=tests/test_staff.py",
    "-p", "no:randomly",
]
```

Why only `src/app/services/`? Routers are thin by design: they delegate to services, so mutating them would only test FastAPI's dependency injection framework, not our logic. The services layer is where bugs matter most: status transitions, risk scoring, payment calculations.

The ignore list also matters. `test_settings_router.py` and `test_session_router.py` are excluded because router tests make real HTTP calls that hit rate limits in CI. `test_staff.py` is the legacy integration test being replaced by the new integration test suite. `-p no:randomly` disables test order randomization so mutmut can reproduce failures consistently.

---

## TypeScript: Stryker with Enforced Thresholds

Stryker targets `src/lib/` — the utility functions used everywhere in the frontend:

```json
{
  "mutate": [
    "src/lib/**/*.ts",
    "!src/lib/api.ts",
    "!src/lib/supabase.ts",
    "!src/lib/auth-context.tsx",
    "!src/lib/query-client.ts"
  ],
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  }
}
```

The exclusions are intentional. `api.ts` and `supabase.ts` wrap external clients, so mutating them would produce mutations that interact with real services, making test results unpredictable. `auth-context.tsx` uses React context, which requires significant mocking overhead to unit test in isolation.

The `break: 50` threshold fails the CI job if mutation score drops below 50%. The `high: 80` target is the green bar. At or above 80% means the test suite is actively catching bugs.

---

## Writing Tests That Kill Mutations

Once mutation testing runs, surviving mutants tell you exactly which logic your tests are not verifying. The fixes required writing tests with much more specific assertions.

### Testing Each Branch Explicitly

`PaymentService._to_response()` has an `invoice_number` fallback chain: first use the explicit parameter, then look in a nested dict, then default to empty string. The original tests only checked the happy path. After mutation testing, every branch got its own test:

```python
class TestToResponse:
    def test_uses_invoice_number_param(self) -> None:
        result = PaymentService._to_response(_BASE_RECORD, invoice_number="INV-001")
        assert result.invoice_number == "INV-001"

    def test_falls_back_to_nested_dict(self) -> None:
        record = {**_BASE_RECORD, "invoices": {"invoice_number": "INV-NESTED"}}
        result = PaymentService._to_response(record, invoice_number="")
        assert result.invoice_number == "INV-NESTED"

    def test_nested_not_dict_falls_back_empty(self) -> None:
        record = {**_BASE_RECORD, "invoices": "not-a-dict"}
        result = PaymentService._to_response(record, invoice_number="")
        assert result.invoice_number == ""

    def test_param_takes_priority_over_nested(self) -> None:
        record = {**_BASE_RECORD, "invoices": {"invoice_number": "INV-NESTED"}}
        result = PaymentService._to_response(record, invoice_number="INV-PARAM")
        assert result.invoice_number == "INV-PARAM"
```

Without `test_falls_back_to_nested_dict`, a mutant that deletes the nested dict lookup survives. Without `test_param_takes_priority_over_nested`, a mutant that swaps the priority order survives. Each test kills a specific class of mutation.

### Exact Assertions Over "Not None"

The email service tests were refactored to verify exact status code checks and exact request payload structure. A test that asserts `result.success is False` when status is 201 (not 200) kills the mutant that would change `== 200` to `>= 200`. A test that asserts the exact `Authorization` header value kills mutants that would remove or corrupt the header construction.

### Testing the Boundary Condition

The invoice number generator raises `ValueError` at sequence 1000. Without a test for the overflow case, mutmut would allow a mutant that changes `> 999` to `> 9999`. The boundary test makes this impossible:

```python
def test_generate_raises_on_sequence_overflow() -> None:
    existing = [f"INV-TELK-202603-{i:03d}" for i in range(1, 1000)]
    with pytest.raises(ValueError, match="Invoice sequence overflow"):
        generate_invoice_number(
            client_code="TELK",
            month=date(2026, 3, 1),
            existing_numbers=existing,
        )
```

---

## Results

| Tool | Language | Scope | CI Behavior |
|------|----------|-------|-------------|
| [mutmut](https://github.com/boxed/mutmut) | Python | `services/` layer | Runs on main, allow_failure |
| [Stryker](https://stryker-mutator.io/) | TypeScript | `lib/` utilities | break < 50% fails the job |

Both tools are now wired into the CI pipeline. Surviving mutants surface in job logs and identify exactly which functions need stronger assertions before reaching production.

---

## Evidence

- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): integration test infrastructure + domain tests
- MR !153 — test(api): strengthen integration tests for mutation testing
- MR !156 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): mutation-killing unit tests for services
- MR !148 — fix(ci): Stryker plugin discovery for pnpm
- MR !145, !146 — fix(ci): mutation test commands for Python and TypeScript
- Source: `apps/api/pyproject.toml`, `apps/web/stryker.config.json`, `apps/api/tests/test_payment_to_response.py`
