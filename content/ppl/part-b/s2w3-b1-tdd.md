---
title: "[S2, W3] PPL: Mutation Testing, From Setup to Score"
date: 2026-04-15
description: "Two weeks on mutation testing: wiring mutmut and Stryker into CI, discovering that our 91% coverage hid a near-zero mutation score, then writing 400+ targeted tests across two rounds to drive the score from ~66% to 80.3%. The arc shows why coverage alone is a lagging indicator."
tags: ["ppl", "tdd", "mutation-testing", "testing"]
slug: s2w3-tdd
toc: true
---

## What I Worked On

Two weeks on mutation testing across the SIRA codebase. The first week wired [mutmut](https://github.com/boxed/mutmut) (Python) and [Stryker](https://stryker-mutator.io/) (TypeScript) into the pipeline and uncovered the uncomfortable truth: 91% line coverage on the services layer translated to a mutation score just above zero in places. The second week closed that gap by writing 400+ targeted tests across two rounds, driving the API mutation score from ~66% to 80.3%. This blog tells the full arc.

---

## Why Coverage Is Not Enough

Line coverage answers: "did my tests execute this line?" Mutation testing answers a harder question: "if this line changed, would my tests notice?" The difference matters.

A test that calls `invoice_service.create()` and asserts `result is not None` gives 100% coverage on that function. Replace the implementation with `return MagicMock()` and the test still passes. The line is covered; nothing is actually tested.

Mutation testing takes the opposite approach. The tool modifies source code in small, plausible ways called "mutants": flipping `>` to `>=`, replacing `== 200` with `!= 200`, changing a string constant. Then it runs the test suite. If no test fails, the mutant "survived," which proves a real bug in that form would have shipped. The mutation score is the percentage of mutants killed. 100% line coverage with 20% mutation score is not theoretical — we were close to that on several services.

---

## Wiring mutmut: Python Side

mutmut configuration lives in `apps/api/pyproject.toml`. The first key decision was scope:

```toml
[tool.mutmut]
paths_to_mutate = ["src/app/services/"]
tests_dir = ["tests/"]
also_copy = ["src/", "conftest.py"]
pytest_add_cli_args = [
    "-m", "not integration",
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

**Why only `src/app/services/`?** Routers are thin by design: they delegate to services, so mutating them would only test FastAPI's dependency injection framework, not our logic. The services layer is where business bugs live: status transitions, risk scoring, payment calculations.

**Why the ignore list?** Router tests make real HTTP calls that hit rate limits under mutation load. Seed tests mutate data that other tests depend on, which breaks mutmut's baseline assumption that tests pass cleanly on unmodified code. `-p no:randomly` disables test order randomization so mutmut can reproduce failures consistently. `-m "not integration"` excludes integration tests (they run separately under `api:integration-test` and use the real DB, which invalidates the "mutation of services broke my test" signal because the DB would break it independently).

---

## Wiring Stryker: TypeScript Side

Stryker targets the frontend `src/lib/` directory where the shared utility logic lives:

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

The exclusions matter. `api.ts` and `supabase.ts` wrap external clients, so mutating them would produce mutants that make real network calls and block on timeouts. `auth-context.tsx` is React context, which needs significant provider setup to test in isolation.

The `break: 50` threshold fails the CI job if mutation score drops below 50%. `high: 80` is the green bar the team aims at.

---

## The Moment of Truth: Running It the First Time

After the initial config landed, the first CI run showed mutation scores in the high 60s on the backend and barely above 50 on the frontend. The report also highlighted individual services with scores as low as 45%. This was from a codebase with 91% line coverage and 1099 passing backend tests. The tests were executing the lines; they just weren't asserting what the lines produced.

The gap was almost entirely in the **assertion strength**. Tests were written like `assert result is not None` or `assert response.status_code == 200` — true statements that any non-broken function would satisfy. Mutmut kept producing mutants that returned `None`, empty dicts, or wrong-but-structurally-valid responses, and the tests happily passed against them.

---

## Mutants as Failing Tests: The TDD Parallel

Once mutation testing runs, surviving mutants tell you exactly which behavior your tests are not verifying. That list IS a spec: each surviving mutant describes a bug your code would not catch if it were introduced. This maps cleanly onto the red-green-refactor loop:

| TDD Step | Mutation-Killing Equivalent |
|----------|-----------------------------|
| Write a failing test | Pick a surviving mutant. The mutant is the "failing test" — it describes behavior your code has that your tests do not verify. |
| Make it pass | Write a test that asserts the behavior the mutant would break. The test passes on real code and fails on the mutant. |
| Refactor | Run mutmut again. Maybe this test killed multiple mutants. Maybe it revealed new survivors. Iterate. |

The unusual property here: the "failing test" is defined for you. You do not design it from requirements — you extract it from the mutant output. The tool forces you to cover behavior you would otherwise miss.

---

## Round 2: 200+ Tests, Broad Sweep

The round 2 commit (`b8930639`) targeted all 12 services in `src/app/services/`. The pattern was: pick a service, pull its surviving mutants, write one test per distinct mutation class.

A survivor in `EmailService.send_email` looked like this:

```
src/app/services/email_service.py:send_email__mutmut_12  survived
  Mutant: self.resend_client.emails.send({...}) → None
```

The mutant replaced the Resend API call with `None`. Nothing errored. No test asserted what `send_email` returned when the client succeeded. The fix:

```python
def test_send_email_returns_provider_message_id() -> None:
    mock_client = MagicMock()
    mock_client.emails.send.return_value = {"id": "res_abc123"}
    service = EmailService(resend_client=mock_client)

    result = service.send_email(
        to="test@example.com",
        subject="test",
        html_body="<p>hi</p>",
    )

    assert result.success is True
    assert result.message_id == "res_abc123"
    mock_client.emails.send.assert_called_once()
```

Three distinct assertions, three distinct mutation classes killed: `assert result.success is True` kills mutants returning `success=False`; `assert result.message_id == "res_abc123"` kills mutants returning `None` or a hardcoded constant; `assert_called_once()` kills mutants that skip the call entirely.

Similar patterns across the services:

```python
# PaymentService._to_response: fallback chain (param → nested dict → empty)
class TestToResponse:
    def test_uses_invoice_number_param(self) -> None:
        result = PaymentService._to_response(_BASE_RECORD, invoice_number="INV-001")
        assert result.invoice_number == "INV-001"

    def test_falls_back_to_nested_dict(self) -> None:
        record = {**_BASE_RECORD, "invoices": {"invoice_number": "INV-NESTED"}}
        result = PaymentService._to_response(record, invoice_number="")
        assert result.invoice_number == "INV-NESTED"

    def test_param_takes_priority_over_nested(self) -> None:
        record = {**_BASE_RECORD, "invoices": {"invoice_number": "INV-NESTED"}}
        result = PaymentService._to_response(record, invoice_number="INV-PARAM")
        assert result.invoice_number == "INV-PARAM"
```

Without `test_falls_back_to_nested_dict`, a mutant deleting the nested lookup survives. Without the priority test, a mutant swapping priority survives. Each test targets a specific class of mutation.

The boundary tests caught the operator-shift mutations:

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

Without this, mutmut could change `> 999` to `> 9999` and nothing would complain. With it, the mutant dies.

---

## Round 3: Per-Method Survivor Targeting

After round 2 the score climbed but plateaued near 78%. The stubborn survivors were specific: operator mutations inside conditional expressions, string-slice boundary changes, default argument swaps. Round 3 (`fe69e036`) went method-by-method.

A concrete example: `ClientService.search()` used `ilike` for case-insensitive matching. Mutmut changed it to `like` (case-sensitive) and no test noticed, because no test searched with mixed case against a lowercase company name:

```python
async def test_search_is_case_insensitive(real_db: Client) -> None:
    _seed_client(real_db, company_name="Telkom Indonesia")

    service = ClientService(real_db)
    results_lower = await service.search("telkom")
    results_upper = await service.search("TELKOM")
    results_mixed = await service.search("TeLkOm")

    assert len(results_lower) == 1
    assert len(results_upper) == 1
    assert len(results_mixed) == 1
```

This test hits real Supabase (not a mock). That matters: `ilike` vs `like` is PostgREST behavior, and a mocked DB would accept either silently. Integration tests are the only way to kill mutations whose behavior depends on actual database semantics. The same pattern repeated across `InvoiceService` (status transition boundaries), `PaymentService` (days-late calculation), `ReminderService` (risk-to-tone mapping), and `RiskScoringService` (threshold comparisons).

---

## The Before/After

The MR CI report shows the jump directly. Before round 3:

![Mutation report before round 3: 1390 killed, 410 survived, 72.5% score](/images/ppl/s2w3-b1-mutation-score-before.png)

After round 3 landed, same MR, same source tree, just more tests:

![Mutation report after round 3: 1539 killed, 261 survived, 80.3% score](/images/ppl/s2w3-b1-mutation-score-after.png)

**149 more mutants killed.** Survived count dropped from 410 to 261. Score: 72.5% → 80.3%. The total (1916) is unchanged because mutmut ran against the same source files; only test coverage changed.

---

## What I Chose NOT to Kill

Not every surviving mutant is worth killing. The remaining gap after round 3 is mostly these categories:

- **Logging-only mutations**: changes to log message strings that do not affect behavior. Killing them adds test fragility (asserting exact log text) without catching real bugs.
- **Defensive unreachable branches**: `if record is None: return None` where real data never hits that path. Killing them requires contrived inputs that would never exist in production.
- **Configuration defaults**: `traces_sample_rate=1.0` vs `traces_sample_rate=0.5`. The difference is operational tuning, not functional behavior.

I left these alone. The mutation score will not hit 100% and does not need to. The rubric that matters is: "would my tests catch a real regression?" For the remaining survivors, the answer is no because there is no regression to catch — they are noise.

---

## Results

| Phase | Commits | Tests | Mutation Score (API) |
|-------|---------|-------|---------------------:|
| Initial wiring (2-8 Apr) | `!144`, `!145`, `!146`, `!148`, `!152`, `!158`, `!159` | Config + exclusions | ~66% after baseline |
| Round 2 (9-12 Apr) | `b8930639` | ~200 mutation-killing tests | ~75% |
| Round 3 (13-15 Apr) | `fe69e036` | ~200 per-method targeted tests | **80.3%** |

TypeScript (Stryker) sits around 60% because `src/lib/` has more React-component-adjacent code where mutation killing is inherently harder (rendering-dependent behavior, DOM interactions that vitest only partially covers).

---

## Evidence

- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): integration test infrastructure + domain tests
- MR !153 — test(api): strengthen integration tests for mutation testing
- MR !156 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): mutation-killing unit tests for services
- MR !148, !145, !146 — Stryker + mutmut CI wiring fixes
- MR !185 — fix(ci): linear false tagging + mutation score improvement (400+ strengthened tests)
- Commit `b8930639` — test(api): 200+ mutation-killing unit tests (round 2)
- Commit `fe69e036` — test(api): round 3 per-method survivor targeting
- Source: `apps/api/pyproject.toml`, `apps/web/stryker.config.json`, `apps/api/tests/test_*_service.py`
