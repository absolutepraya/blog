---
title: "PPL: Beyond Unit Tests [Sprint 2, Week 1]"
date: 2026-03-23
description: "Property-based testing with Hypothesis, BDD with Gherkin scenarios, mutation testing that exposed 91% coverage as meaningless, and how pytest-randomly found a hidden bug on its first run."
tags: ["ppl", "tdd", "testing", "hypothesis", "mutation-testing"]
slug: s2w1-tdd
toc: true
---

## What I Worked On

This week I pushed our testing strategy well beyond standard unit tests. The project already had 433 backend and 200 frontend tests with 91% line coverage, but I wanted to answer a harder question: **do our tests actually catch bugs, or do they just execute code?**

I added four advanced testing approaches: property-based testing (Hypothesis + fast-check), behavioral testing (pytest-bdd with Gherkin), mutation testing (mutmut + Stryker), and test isolation verification (pytest-randomly). The results were eye-opening.

## Property-Based Testing with Hypothesis

Instead of writing tests for specific values ("payment of 500000 on a 1000000 invoice"), property-based testing generates thousands of random inputs and verifies that invariants always hold.

### Backend: 10 Hypothesis Tests

I wrote property tests for the core payment and invoice invariants:

```python
@given(
    amount=st.floats(min_value=0.01, max_value=1e12),
    remaining=st.floats(min_value=0.01, max_value=1e12),
)
def test_overpayment_always_rejected(amount, remaining):
    """For ANY amount > remaining, payment MUST be rejected."""
    assume(amount > remaining)
    with pytest.raises(ValueError, match="exceeds remaining balance"):
        # ... service call
```

Each test ran 200 random inputs. Across 10 tests, Hypothesis generated **10,000+ inputs** and verified:
- `days_late` is always `payment_date - due_date` (integer)
- Overpayment is always rejected regardless of amount magnitude
- Invoice status recalculation always produces PAID or PARTIAL
- Auto-OVERDUE triggers for past dates but never for future dates
- `mark_invoices_overdue` is idempotent (safe to re-run)

### Frontend: 10 fast-check Tests

Same approach for TypeScript utilities: `formatCurrency` always contains "Rp", `formatDate` never throws for valid dates, `cn()` always returns a string. fast-check initially found that `formatDate` crashes on `new Date(NaN)`, which we documented as a known edge case.

### API Schema Testing with Schemathesis

Schemathesis fuzzes our OpenAPI schema with random inputs and checks for 5xx responses. Three tests validate schema consistency and endpoint stability under unexpected input.

## Behavioral Testing with pytest-bdd

I wrote 13 Gherkin scenarios across 3 feature files that describe the complete business logic in human-readable language:

```gherkin
Feature: Overdue Detection

  Scenario: UNPAID invoice past due date is marked OVERDUE
    Given an UNPAID invoice with due date "2026-01-15"
    When the overdue detection task runs on "2026-03-01"
    Then the invoice status should be "OVERDUE"

  Scenario: PAID invoice is never marked OVERDUE
    Given a PAID invoice with due date "2026-01-15"
    When the overdue detection task runs on "2026-03-01"
    Then the invoice status should remain "PAID"
```

The feature files cover overdue detection (5 scenarios), payment recording (4 scenarios), and invoice creation (4 scenarios). Non-technical stakeholders can read and validate these scenarios without understanding Python.

**Technical note**: pytest-bdd doesn't support async step functions. I solved this by wrapping async service calls in `asyncio.run()` inside synchronous step definitions.

## Mutation Testing: The Eye-Opener

Mutation testing modifies source code (e.g., `>=` becomes `>`, `+` becomes `-`) and checks if tests catch the change. If a mutant "survives" (tests still pass), it means tests don't verify that behavior.

I ran mutmut against the service layer:

- **Killed**: 0 mutants
- **Survived**: 168 mutants
- **Mutation score**: 0%

**91% line coverage, 0% mutation score.** Our tests execute every line but verify almost nothing. The reason: heavy mocking. When mutmut changes `payment_service.py`, the mocked functions still return the same values, so tests pass regardless. 168 behavioral changes that our tests don't catch.

This is the strongest evidence that **coverage percentage is a vanity metric**. It measures execution, not verification.

## pytest-randomly: Bug on First Run

pytest-randomly shuffles test execution order on every run. On its very first run, it **exposed a hidden test order dependency** in `test_logging_middleware.py`.

The issue: `setup_logging()` sets `propagate=False` on the `sira.access` logger, which leaked across tests and made `caplog` stop working. The test had been passing for weeks only because it happened to run in the right order.

Fix: an autouse fixture that cleans logger handlers and restores the propagate flag between tests.

## Result

| Area | Before | After | Delta |
|------|--------|-------|-------|
| Backend tests | 433 | 459 | +26 |
| Frontend tests | 200 | 210 | +10 |
| **Total** | **633** | **669** | **+36** |

New tests: 10 property (backend) + 13 BDD + 3 schema + 10 property (frontend) = 36.

Four new CI quality jobs: schema testing, mutation testing (Python + TypeScript), and load testing. All run automatically on main.

The key takeaway: 91% coverage with 0% mutation score proved that our mock-heavy tests create a false sense of security. Real quality requires testing beyond line coverage.

## Evidence

- [MR !92 - TDD & QA advanced tooling](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/92)
- [MR !95 - Fix schema-test and load-test CI jobs](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/95)
- [Linear SIRA-110](https://linear.app/ppl-sira/issue/SIRA-110) (parent ticket)
- Source: `apps/api/tests/test_property_payments.py`, `apps/api/tests/test_property_invoices.py`
- Source: `apps/api/tests/features/*.feature`, `apps/api/tests/bdd/*.py`
