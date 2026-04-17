---
title: "PPL: Two Weeks of CI/Testing Discipline [Sprint 2, Week 3]"
date: 2026-04-15
description: "Two weeks, 25 merged MRs and ~40 commits, all centered on the same arc: wire mutation testing into CI, then scale it so three jobs run in parallel. This blog documents the commit discipline, the iterative MR cadence, and the walk-back pattern that kept every decision reviewable."
tags: ["ppl", "discipline", "git-flow", "ci"]
slug: s2w3-discipline
toc: true
---

## What I Worked On

Two weeks (2 April through 15 April) produced **25 merged MRs** and roughly 40 commits, overwhelmingly CI and testing infrastructure with a handful of features and a security upgrade layered in. The work forms one continuous arc: wire mutation testing into CI → make it work on MR pipelines → write tests that actually pass the quality bar → shard the Supabase stack so CI runs three jobs in parallel. Every MR was mergeable on its own and every walk-back is visible in the commit log, not hidden with force-pushes.

---

## Week 1 (2-8 Apr): Mutation Testing Infrastructure

Week 1 was dominated by getting mutmut and Stryker to run cleanly in CI. 19 MRs merged. Mutation testing does not configure itself on the first try — each pipeline run revealed a new failure mode, and each fix became its own MR:

| MR | Commit Message | What It Fixed |
|----|---------------|---------------|
| !145 | fix(ci): fix mutation test commands for Python and TypeScript | Initial command invocation errors |
| !146 | fix(ci): use pnpm exec for Stryker mutation testing | Stryker not found in pnpm workspace |
| !147 | chore(ci): add disk cleanup step before every pipeline | Disk exhaustion from repeated Docker image pulls |
| !148 | fix(ci): fix Stryker plugin discovery for pnpm + mutmut | Plugin resolution failure in pnpm context |
| !149 | chore(ci): include integration tests in SonarQube coverage | Integration coverage missing from Sonar report |
| !150 | fix(web): increase timeout for flaky clients-page form tests | Test flakiness from mutation suite side effects |
| !152 | chore(ci): include integration tests in Python mutation testing | mutmut not running against integration suite |
| !158 | fix(ci): ignore seed tests in mutmut config | Seed tests failing under mutmut due to data isolation |
| !159 | fix(ci): ignore router tests in mutmut config | Router tests rate-limiting CI during mutation runs |
| !144 | feat(api): integration test infra + all domain tests | Full integration test suite (9 domains) |
| !153 | test(api): strengthen integration tests for mutation testing | Assertions specific enough to kill mutants |
| !156 | feat: add mutation-killing unit tests for services | Dedicated unit tests targeting surviving mutants |

Each of these is standalone. No stacked drafts, no "WIP" commits sitting on a branch for days. Partly discipline, partly pragmatism: when the CI runner takes 8-12 minutes to surface a failure, batching changes across pipelines wastes more time than it saves. Merge the fix, start the next one, get feedback.

Three application features also shipped in week 1 (invoice number generation, auth on GET client endpoints, Sentry instrumentation for Celery) and three carry-over CI MRs from the prior week closed on April 2.

![Filtered MR list showing 19 MRs merged during Sprint 2 Week 3 work period (page 1)](/images/ppl/s2w3-b3-mr-list-1.png)

![Filtered MR list (page 2)](/images/ppl/s2w3-b3-mr-list-2.png)

---

## Week 2 (9-15 Apr): Per-MR Mutation Feedback + Parallel Slots

Week 2 shifted focus from "does it run?" to "does it give useful feedback on MRs?" and "does it scale to concurrent pipelines?" Five MRs merged plus SIRA-274 as MR !197 (merged on the final day). The full list:

| MR | Date | Commit Message | What It Changed |
|----|------|---------------|-----------------|
| !183 | Apr 9 | chore(ci): mutation testing on MR pipelines + report comments | Mutation jobs auto-run per-MR instead of main-only; results posted to MR comments |
| !184 | Apr 9 | fix(ci): mutmut 0% score + linear false tagging | Excluded integration tests from mutmut (rate-limit 429 kept killing baseline); stopped linear-notify from scanning MR body text |
| !185 | Apr 10 | fix(ci): linear false tagging + mutation score improvement | Linear `mr-merged` scans only first line of squash commit; 400+ strengthened service tests |
| !186 | Apr 10 | chore(ci): auto-run Stryker on MR + remove TS checker for speed | Stryker auto-runs; `typescript-checker` uninstalled (vitest kills type-invalid mutants at runtime) |
| !187 | Apr 11 | chore(ci): make mutation:typescript manual and non-blocking | Reverted Stryker auto-run after 28-min runtime proved too slow |
| !197 | Apr 15 | SIRA-274 chore(ci): parallel Supabase slots for CI | Removed `resource_group: supabase-local` from two jobs, replaced with flock-based slot allocation |

Shortest gap between merges was 40 minutes (!184 at 14:22 → follow-up in !185). Week 2 also included three direct commits that did not warrant their own MRs: the axios GHSA-3p68-rc4w-qgx5 SSRF upgrade, two rounds of mutation-killing tests (`b8930639` + `fe69e036`), and Sentry performance spans for risk scoring.

![Filtered MR list showing 5 MRs merged 9-15 April](/images/ppl/s2w3-b3-mr-list.png)

---

## The Walking-Back Pattern (!186 → !187)

!186 made Stryker auto-run on MRs. A day later, !187 walked that decision back and made it manual again. Both are in the week's commit log. This pattern is worth showing, not hiding:

1. Stryker was manual because it took 38 minutes on the CI runner
2. I removed the `typescript-checker` plugin (mutants with type errors already die at runtime under vitest, so the checker was redundant)
3. With the checker gone I expected the job to drop below 20 minutes and auto-run safely
4. It dropped to about 28 minutes — still too slow to block MR merges

Walking back a decision by writing a new commit (not a force-push, not a revert with no context) is the discipline piece. The MR title says exactly what changed and why. A reviewer looking at !186 and !187 in sequence can reconstruct the reasoning without asking. Git history stays honest.

---

## SIRA-274: Four Commits, One Merged MR

The SIRA-274 branch had four commits before squash-merging to main:

```
dba63d41 chore(ci): shard mutation:python Supabase stacks across 3 slots
8c2f9970 chore(ci): shard api:integration-test Supabase stacks across 3 slots
00bfa6ea chore(ci): fix ci-supabase-slot.sh subshell FD bug
1b5a697d chore(ci): add ci-supabase-slot.sh for parallel local Supabase stacks
```

Read bottom to top: add the script, fix a bug in it, apply it to each job that needed a Supabase instance. A disposable test MR (!198) was opened alongside !197 to verify concurrent slot allocation on a real pipeline, then closed after the all-green run.

The fix commit (`00bfa6ea`) sits between the introduction and the two shard commits. The bug was specific: calling `acquire_slot` inside command substitution meant the file descriptor for the `flock` got opened in a subshell and released immediately. The fix changed the calling convention. Full design notes are in this week's b2 programming blog.

Pipeline 15028 (post-merge of !197) ran all green: `api:integration-test` 1m59s, `mutation:python` 4m36s, SonarQube 85% coverage gate passed, all other jobs green.

---

## Commit Quality Across Both Weeks

Conventional commit prefixes stayed consistent end to end:

```
fix(ci): fix mutation test commands for Python and TypeScript
fix(ci): use pnpm exec for Stryker mutation testing
chore(ci): add disk cleanup step before every pipeline
fix(ci): fix Stryker plugin discovery for pnpm + mutmut
feat(api): integration test infrastructure + all domain tests
test(api): strengthen integration tests for mutation testing
chore(ci): mutation testing on MR pipelines + report comments
fix(ci): mutmut 0% score + linear false tagging
fix(web): upgrade axios 1.13.5 → 1.15.0 (GHSA-3p68-rc4w-qgx5 SSRF)
chore(ci): shard api:integration-test Supabase stacks across 3 slots
```

The prefix vocabulary stayed narrow and meaningful:
- `fix(ci)`: something was broken in the pipeline
- `chore(ci)`: not broken, but incomplete
- `feat(api)` / `feat(web)`: new user-facing capability
- `test(api)`: test-only changes, no behavior change
- `fix(web)`: bug fix or dependency upgrade

No vague "update", "tweak", or "wip" messages. Every message is a one-line summary of what a reviewer will see in the diff.

---

## Results

| Category | Week 1 (2-8 Apr) | Week 2 (9-15 Apr) | Total |
|----------|:----------------:|:-----------------:|:-----:|
| CI/CD MRs | 10 | 5 | 15 |
| Testing infrastructure & mutation-killing MRs | 5 | 1 (!197) | 6 |
| Application features | 3 | 0 | 3 |
| Documentation / CLAUDE.md | 1 | 0 | 1 |
| Direct commits (not separate MRs) | 0 | ~5 | ~5 |
| **MRs merged** | **19** | **6** | **25** |

---

## Evidence

- **Week 1 MRs (19 total):** !138, !140, !141, !144, !145, !146, !147, !148, !149, !150, !152, !153, !156, !158, !159, !130 (SIRA-123), !154 (SIRA-82), !105 (SIRA-135), CLAUDE.md docs MR
- **Week 2 MRs (6 total):** !183, !184, !185, !186, !187, !197 ([SIRA-274](https://linear.app/ppl-sira/issue/SIRA-274))
- **Week 2 disposable:** !198 — concurrency test MR (opened, verified, closed)
- **Week 2 direct commits:** `2e5bc2fd` (axios SSRF), `b8930639` (round 2 tests), `fe69e036` (round 3 tests), `1d957968` (Sentry spans), `7aceb817` (CSV fix)
- **Post-merge pipeline:** 15028, all green, integration-test 1m59s, mutation-python 4m36s
