---
title: "PPL: AI Literacy [Sprint 2, Week 3]"
date: 2026-04-08
description: "The mutation testing sprint was the most AI-intensive week yet, but not for code generation. AI's role was iterative CI debugging across 10 MRs, and improving its own context via a CLAUDE.md update."
tags: ["ppl", "ai-literacy", "claude-code", "mutation-testing"]
slug: s2w3-ai-literacy
toc: true
---

## What I Worked On

This week produced 19 MRs, most of them CI fixes for mutation testing infrastructure. AI assistance was central throughout, but in a different mode than code generation. The dominant pattern was iterative debugging: run CI, read the failure, describe it to Claude Code, get a fix, merge, repeat. Ten MRs came from this loop.

---

## AI for Iterative CI Debugging

Setting up [mutmut](https://github.com/boxed/mutmut) and [Stryker](https://stryker-mutator.io/) in CI is not a one-shot task. Each configuration change revealed a new failure:

1. Wrong CLI invocation for mutmut inside a `uv` environment
2. Stryker not found because pnpm uses `node_modules/.pnpm/` not a flat `node_modules/`
3. Stryker plugin resolution failure (the pnpm-compatible plugin name differs from the npm docs)
4. Seed tests failing under mutmut because they assume a clean DB state that mutations disrupt
5. Router tests rate-limiting the CI runner when run under mutation load
6. Disk exhaustion from accumulated Docker artifacts

For each of these, the workflow was:

1. **Run CI** — pipeline fails with an error message in the job log
2. **Describe the error to Claude Code** — paste the relevant log section with context about what step failed
3. **AI proposes a fix** — usually a config change, a flag correction, or an ignore list addition
4. **Apply and push** — creates a new MR with the fix
5. **Run CI again** — next failure becomes visible

AI was fast at steps 2–4 because the failure modes are well-documented (mutmut docs, Stryker docs, pnpm workspace conventions). The key was providing the right context: not just the error message but which tool was involved, what environment it ran in (pnpm vs npm, uv vs pip), and what the expected behavior was.

**What AI could not do**: predict which failures would occur next. The sequence (pnpm exec fix, plugin discovery fix, seed test exclusion) had to be discovered iteratively through real CI runs. AI does not know our CI runner's specific pnpm version, directory structure, or which tests happen to be sensitive to mutation isolation. That required running the pipeline and observing.

---

## AI for Integration Test Infrastructure

MR !144 built integration test infrastructure from scratch: a session-scoped `real_db` fixture connecting to local Supabase, an autouse `_truncate_tables` fixture that clears all app tables before and after each integration test, and seed helpers for clients, invoices, and payments.

The core design decision (truncate before AND after each test, not just after) came from thinking through failure modes:

- Truncate only after: if the test aborts mid-run (import error, fixture failure), the DB is left dirty and the next test sees stale data
- Truncate only before: works for isolation, but leaves data in the DB after the test suite finishes, which can cause false passes on re-runs that depend on "no data" as a precondition

AI helped design the `_do_truncate()` approach: connecting directly to Postgres via psycopg (not through PostgREST, which does not support `TRUNCATE`), using the Supabase-exposed Postgres port (Supabase URL port + 1), and truncating in FK-safe order (children before parents):

```python
_APP_TABLES = [
    "reminder_logs",
    "payments",
    "risk_scoring_logs",
    "invoices",
    "email_templates",
    "user_sessions",
    "app_users",
    "clients",
]
```

The human decision was verifying that the psycopg direct connection approach would work in CI (where Supabase runs in a container on a known port), not just locally. AI proposed the pattern; the CI environment validation required understanding the actual runner setup.

---

## CLAUDE.md as AI Context Engineering (MR !142)

MR !142 updated `CLAUDE.md` with everything learned during the CI sprint: staging Supabase connection gotchas, the correct way to run mutmut vs pytest in the same job, the FK-safe truncation order, the difference between unit test coverage and integration test coverage in the SonarQube report.

This is meta-level AI use: improving the instructions Claude Code reads at the start of every session. A well-maintained `CLAUDE.md` means the next session starts with the right context already loaded, without needing to re-explain patterns that were discovered the hard way.

The specific additions were:
- Staging Supabase connection details (pooler URL, IPv4 vs IPv6 constraint, post-pause restart instructions)
- Integration test marker conventions and which fixtures to use
- The mutmut ignore list rationale (why router tests and seed tests are excluded)
- SonarQube coverage merging approach

These are exactly the kinds of things AI gets wrong if they are not in context: it would suggest the wrong Supabase connection string, or recommend running mutmut against test files that do not need mutation.

---

## What AI Did Not Handle Well

**Predicting which mutmut exclusions would be needed.** The final ignore list in `pyproject.toml` required five iterations because each exclusion revealed another problematic test file. AI could not predict in advance which tests would behave badly under mutation without actually running them. This had to be discovered empirically.

**CI runner environment differences.** The pnpm Stryker plugin discovery issue required knowing the exact directory structure that pnpm uses for `node_modules` in a workspace. AI's first suggestion used the standard npm plugin path that does not exist in a pnpm workspace. The correct fix (`pnpm exec stryker run`) was found by reading the error output and iterating.

---

## Results

| Task | AI Role | Human Role |
|------|---------|------------|
| CI config for mutmut + Stryker | Generated fixes for each failure | Ran pipelines, identified failure context |
| Integration test design | Proposed autouse fixture approach | Verified psycopg port logic in CI |
| CLAUDE.md update | N/A (human-written) | Distilled CI sprint learnings into context |
| Mutation-killing test rewrites | Generated specific assertions | Identified which surviving mutants to target |

---

## Evidence

- MR !142 — docs: update CLAUDE.md with CI/CD, testing, and staging Supabase learnings
- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): integration test infrastructure
- MR !145, !146, !147, !148, !152, !158, !159 — CI mutation testing series
- Source: `apps/api/tests/conftest.py`, `.gitlab-ci.yml`, `apps/api/pyproject.toml`
