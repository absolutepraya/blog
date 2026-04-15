---
title: "PPL: Mutation-Killing Tests [Sprint 3, Week 1]"
date: 2026-04-15
description: "Two rounds of mutation-killing tests this week, totaling 400+ new assertions designed to kill specific surviving mutants. The process is closer to TDD than it looks: each surviving mutant defines a failing test that does not exist yet, and you write the smallest test that makes it fail."
tags: ["ppl", "tdd", "mutation-testing", "testing"]
slug: s3w1-tdd
toc: true
---

## What I Worked On

Last week I wired mutmut and Stryker into CI. This week the test suites finally had a feedback loop, which revealed how many mutants were surviving. The mutation score for `apps/api/src/app/services/` was around 66% after the first pass. I wrote two rounds of targeted tests this week — 200+ in round 2 (commit `b8930639`) and another 200+ in round 3 (commit `fe69e036`) — aimed at killing specific surviving mutants.

This is TDD in an unusual shape: the mutation report tells you exactly which branch or operator has no test covering it. That acts as the "failing test" in the red-green-refactor loop.

---

## Reading the Mutmut Output Like a Test Spec

When mutmut runs, it prints a table of surviving mutants. Each line names a function and the change that survived. A survivor in `EmailService.send_email` looked like this:

```
src/app/services/email_service.py:send_email__mutmut_12  survived
  Mutant: self.resend_client.emails.send({...}) → None
```

The mutant replaced the actual API call with `None`. Nothing errored. No test asserted what `send_email` returned when the Resend client succeeded. The surviving mutant is the test spec: there must be a test that asserts `result.success is True` AND `result.message_id` matches the value the mocked client returned. One assertion on either alone would not kill both the "replace with None" mutant and the "change `True` to `False`" mutant.

The round 2 commit added tests like:

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

`assert result.success is True` kills mutants that return `SendResult(success=False, ...)`. `assert result.message_id == "res_abc123"` kills mutants that return `None` or a hardcoded constant. `assert_called_once()` kills mutants that skip the `send` call entirely. Three distinct mutation classes, three distinct assertions.

---

## Round 3: Per-Method Survivor Targeting

After round 2, the mutation score climbed but plateaued near 78%. The stubborn survivors were specific: operator mutations inside conditional expressions, string slice boundary changes, default argument swaps.

Round 3 (commit `fe69e036`) targeted these one method at a time. The pattern looked like:

```python
# ClientService.search() had this line surviving:
#   query = query.ilike("company_name", f"%{term}%")
# Mutant: change "ilike" to "like" (case-sensitive). Survived because no test
# asserted case-insensitive matching.

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

This test runs against a real Supabase instance (not a mock), which matters because `ilike` vs `like` is a PostgREST behavior. A mocked DB would accept either and the test would pass even for the broken mutant. Integration tests are the only way to kill mutations that depend on actual database semantics.

The same pattern repeated across `InvoiceService` (status transition boundaries), `PaymentService` (days-late calculation), `ReminderService` (risk-to-tone mapping), and `RiskScoringService` (threshold comparisons).

---

## TDD Parallels

The red-green-refactor loop maps cleanly onto mutation-killing work:

| TDD Step | Mutation-Killing Equivalent |
|----------|-----------------------------|
| Write a failing test | Pick a surviving mutant. The mutant is the "failing test" — it describes behavior your code has but your tests do not verify |
| Make it pass | Write a test that asserts the behavior the mutant would break. The test passes on the real code and fails on the mutant |
| Refactor | Run mutmut again. Maybe this test killed multiple mutants. Maybe it revealed new survivors. Iterate |

The difference is that the "failing test" is defined for you. You do not design it from requirements, you extract it from the mutant. This is why mutation testing feels mechanical at first, and why it works: the tool forces you to cover behavior you would otherwise miss.

---

## What Still Survives

Not every surviving mutant is worth killing. The final report still has survivors in these categories:

- **Logging-only mutations**: changes to log message strings that do not affect behavior. Killing them would add test fragility without catching real bugs.
- **Defensive code paths**: `if record is None: return None` where the branch is unreachable under real data. Killing them requires contrived inputs.
- **Configuration defaults**: `traces_sample_rate=1.0` vs `traces_sample_rate=0.5`. The difference is operational, not functional.

I left these alone. The mutation score will not hit 100% and does not need to. The rubric cares about whether tests catch real bugs, and the value of a test is not in the mutation it kills but in the bug it would catch if the code regressed.

---

## Results

| Round | Commit | Services Targeted | Tests Added |
|-------|--------|-------------------|------------|
| 2 | `b8930639` | All 12 services in `src/app/services/` | ~200 |
| 3 | `fe69e036` | Per-method surviving mutants | ~200 |
| Total | | | **400+** |

The before/after is concrete. Before round 3 (screenshot from MR !185 CI report, API section):

![Mutation report before round 3: 1390 killed, 410 survived, 72.5% score](/images/ppl/s3w1-b1-mutation-score-before.png)

After the round 3 tests landed (same MR, CI report updated):

![Mutation report after round 3: 1539 killed, 261 survived, 80.3% score](/images/ppl/s3w1-b1-mutation-score-after.png)

149 more mutants killed. Survived count dropped from 410 to 261. Score: 72.5% → 80.3%. The total (1916) is unchanged because mutmut ran against the same source files; only test coverage changed. The remaining gap consists mostly of the low-value categories described above.

---

## Evidence

- MR !185 — fix(ci): linear false tagging + mutation score improvement (includes 400+ strengthened tests)
- Commit `b8930639` — test(api): add 200+ mutation-killing unit tests for services
- Commit `fe69e036` — test(api): round 3 mutation-killing tests targeting per-method survivors
- Source: `apps/api/tests/test_*_service.py`, `apps/api/pyproject.toml`
