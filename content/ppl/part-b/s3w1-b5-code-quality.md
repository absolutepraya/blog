---
title: "PPL: Code Quality Signals in CI [Sprint 3, Week 1]"
date: 2026-04-15
description: "Every MR this week now carries a mutation testing block in its CI comment with killed/survived/no-coverage breakdowns for both API and Web. Plus the decision to remove Stryker's typescript-checker plugin, the 85% mutation target, and what happens when an automated quality gate is too slow to block merges."
tags: ["ppl", "code-quality", "mutation-testing", "ci"]
slug: s3w1-code-quality
toc: true
---

## What I Worked On

Last week's mutation testing worked but only ran on main. That meant quality regressions surfaced after merge, which is too late. This week's goal was to move mutation testing left: auto-run on every MR pipeline, post results as a comment, make the signal visible while the code is still in review.

The work split into three parts: wiring the report (MR !183), fixing a bug that made mutmut report 0% (MR !184), and tuning Stryker fast enough to auto-run without stalling the pipeline (MR !186 then walked back in !187).

---

## The Quality Report Block on Every MR

MR !183 added `ci-report.sh mutation` as a new subcommand. Every MR pipeline now has a `🧬 Mutation Testing` block in its CI comment with a structure that looks like:

```markdown
## 🧬 Mutation Testing

Mutation testing modifies source code in small ways ("mutants") and runs
the test suite. A mutant "killed" means a test failed, proving the tests
would catch that bug. A "survived" mutant means no test detected the change,
revealing a coverage gap. Target: **85%** killed.

### API (mutmut)

| Killed | Survived | No Coverage | Timeout | Score |
|-------:|---------:|------------:|--------:|------:|
| 412 | 88 | 15 | 2 | 80.3% |

### Web (Stryker)

| Killed | Survived | No Coverage | Timeout | Score |
|-------:|---------:|------------:|--------:|------:|
| 352 | 228 | 8 | 0 | 59.8% |
```

The explanation text at the top was added in MR !185 so reviewers unfamiliar with mutation testing can read the block without needing separate documentation. Mutation testing is specialized enough that "killed/survived" sounds ambiguous without the framing.

The numbers distinguish four categories that matter differently:

- **Killed**: tests detected the mutation. This is the quality win.
- **Survived**: tests ran but no assertion failed. This is the coverage gap to fix.
- **No coverage**: the mutant is in code that no test touches. Lower-value signal; fix with a basic test first.
- **Timeout**: the mutant caused an infinite loop. Usually a configuration issue, not a quality issue.

Separating "survived" from "no coverage" matters because the fixes are different. A survived mutant needs a better assertion. A no-coverage mutant needs a test at all. Lumping them into one number (as line coverage does with covered/uncovered) loses that distinction.

---

## The 0% Report Bug (MR !184)

After !183 shipped, the first few MR pipelines showed mutmut with `0 killed / 0 survived / 500 not checked`. Every single mutant was "not checked." The score reported was `0%`.

The cause took a while to find. mutmut's first step is a baseline run: execute the full test suite against the unmutated code. If any test fails, mutmut refuses to proceed — a test failing against clean code means mutation testing results would be noise. In the CI environment, integration tests hit Supabase's local rate limits (429 Too Many Requests) on parallel runs, so pytest would fail with real network errors, mutmut would abort its baseline, and every mutant would end up "not checked."

The fix was one line in `pyproject.toml`:

```toml
pytest_add_cli_args = [
    "-m", "not integration",   # ← added this
    "--ignore=tests/test_db_schema_and_seed.py",
    "--ignore=tests/test_schemathesis.py",
    # ... other ignores
]
```

`-m "not integration"` tells pytest to skip tests marked `@pytest.mark.integration`. The integration test suite is run separately by `api:integration-test` (covered in last week's discipline blog); it does not need to run under mutmut because it asserts behavior against real Supabase, not against logic branches in services.

---

## Why the Integration Tests Should Not Be Mutated

This decision is worth a paragraph. Integration tests use the real database. If mutmut mutates `InvoiceService.create_invoice` and the test runs `real_db.table("invoices").select(...).execute()`, most mutations will fail the integration tests because the DB schema enforces constraints the mutant violates. That sounds good — more tests killing more mutants — but it conflates two different signals.

Mutation testing is asking: "if this line changes, does your *test suite* catch it?" The goal is to find gaps in unit and service tests where assertions are too weak. If an integration test catches every mutation, it tells you the DB schema is enforcing the invariant, not that your tests are catching it. The integration test would pass against the real code AND against a broken mutant that happened to produce the same DB state. You lose the ability to distinguish.

So mutmut runs against unit tests only. Integration tests are a separate quality signal, tracked by code coverage, not by mutation score.

---

## Stryker: Auto-Run Experiment (MR !186) and Walk-Back (MR !187)

Stryker was manual on main because it took 38 minutes. MR !186 tried to make it auto-run on MRs by removing the heaviest part of its configuration: the `@stryker-mutator/typescript-checker` plugin.

The plugin runs `tsc` against each mutant before handing it to vitest, rejecting mutants that would produce type errors. This is conceptually nice: it saves vitest time on mutants that can't compile. In practice, it doubles the Stryker run time because `tsc` invokes the TypeScript compiler per mutant (~588 mutants in the codebase). And for our project, the savings don't materialize because vitest kills type-invalid mutants at runtime anyway — a mutant that breaks types produces an "undefined is not a function" error in a test, which vitest reports as a failure, which Stryker counts as killed.

```json
// stryker.config.json — removed this block
"checkers": ["typescript"],
```

The plugin was also uninstalled from `package.json`. Mutation score stayed identical at around 60% because type-invalid mutants ended up in the killed column under either configuration.

Stryker's time dropped from 38 minutes to about 28 minutes. Still too slow to block MR merges (most pipelines complete in under 10 minutes). MR !187 walked the auto-run decision back and restored manual invocation. The job stays in `.gitlab-ci.yml` with `when: manual` and `allow_failure: true`, reachable via the play button whenever we care to run it.

The walk-back is the right call but worth naming: removing a quality gate from blocking a merge is not a loss if the gate was slower than the merge flow tolerates. A 28-minute check that delays every MR by 28 minutes is more expensive than the bugs it catches. Manual invocation on PRs that matter (pre-release checks, major service refactors) recovers the value without the latency.

---

## The 85% Target

The report comment mentions "Target: **85%** killed" as a guideline. This was chosen by looking at what the existing test suite achieves after a reasonable strengthening pass, and adding headroom:

- Pre-round-2 mutation testing: ~66% for API
- After round 2 (200+ tests): ~75%
- After round 3 (per-method survivor targeting): ~80%

85% is the next credible step. Getting above 90% requires chasing low-value mutations (log message strings, defensive branches that cannot be reached with real data) that add test maintenance burden without catching real bugs. 85% is where the cost/benefit inflects.

Stryker (Web) sits at around 60% because the frontend lib code has different characteristics: lots of pure data transformations where a single test kills many mutants, but also lots of React component utility code where mutation coverage is inherently harder (rendering-dependent behavior).

---

## Results

| Quality Signal | Before This Week | After This Week |
|----------------|-----------------|-----------------|
| Mutation testing feedback | Main branch only, after merge | Every MR, in the CI comment |
| mutmut baseline failures | All mutants "not checked" in CI | Baseline runs cleanly on unit tests only |
| Stryker runtime | Manual only, 38 min | Manual, 28 min (typescript-checker removed) |
| API mutation score | ~66% | ~80% (after rounds 2 and 3) |

The shift from "main-only" to "every MR" is the structural improvement. Mutation score is a number that only matters if it has a feedback loop tight enough to influence the code being written. Posting it on every MR comment is the minimum viable loop.

---

## Evidence

- MR !183 — chore(ci): mutation testing on MR pipelines + report comments
- MR !184 — fix(ci): mutmut 0% score (integration test exclusion)
- MR !185 — fix(ci): mutation report explanation + 400+ strengthened tests
- MR !186 — chore(ci): auto-run Stryker on MR + remove TS checker
- MR !187 — chore(ci): walk back Stryker auto-run, keep manual
- Source: `scripts/ci-report.sh` (mutation subcommand), `apps/api/pyproject.toml`, `apps/web/stryker.config.json`
