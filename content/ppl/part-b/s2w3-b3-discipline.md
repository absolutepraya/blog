---
title: "PPL: Development Discipline [Sprint 2, Week 3]"
date: 2026-04-08
description: "19 MRs this week across mutation testing infrastructure, integration test suites, feature work, and CI fixes. Documenting the commit discipline and iterative approach behind a productive sprint week."
tags: ["ppl", "discipline", "git-flow", "ci"]
slug: s2w3-discipline
toc: true
---

## What I Worked On

Sprint 2 Week 3 (April 2–8) produced 19 merge requests. The week had a single dominant theme: mutation testing. Setting up mutmut and Stryker in CI required an iterative series of fixes: each pipeline run revealed a new configuration problem, and each fix became its own MR. Alongside that, integration test infrastructure was built from scratch, and three application features landed.

---

## The Mutation Testing Sprint: 12 CI/Testing MRs

Mutation testing does not configure itself cleanly on the first try. The sequence of CI MRs this week tells the story:

| MR | Commit Message | What It Fixed |
|----|---------------|---------------|
| !145 | fix(ci): fix mutation test commands for Python and TypeScript | Initial command invocation errors |
| !146 | fix(ci): use pnpm exec for Stryker mutation testing | Stryker not found in pnpm workspace |
| !147 | chore(ci): add disk cleanup step before every pipeline | Disk exhaustion from repeated Docker image pulls |
| !148 | fix(ci): fix Stryker plugin discovery for pnpm + mutmut | Plugin resolution failure in pnpm context |
| !149 | chore(ci): include integration tests in SonarQube coverage | Integration coverage missing from Sonar report |
| !150 | fix(web): increase timeout for flaky clients-page form tests | Test flakiness from mutation test suite side effects |
| !152 | chore(ci): include integration tests in Python mutation testing | mutmut not running against integration test suite |
| !158 | fix(ci): ignore seed tests in mutmut config | Seed tests failing under mutmut due to data isolation |
| !159 | fix(ci): ignore router tests in mutmut config | Router tests rate-limiting CI during mutation runs |
| !144 | feat(api): integration test infra + all domain tests | Full integration test suite (9 domains) |
| !153 | test(api): strengthen integration tests for mutation testing | Assertions made specific enough to kill mutants |
| !156 | feat: add mutation-killing unit tests for services | Dedicated unit tests targeting surviving mutants |

Each MR was standalone and mergeable. No stacked drafts, no "WIP" commits sitting on a branch for days. This is partly discipline and partly necessity: the CI runner gives feedback fast enough that it makes sense to merge the fix and start the next one rather than batch them.

---

## Application Features (3 MRs)

Alongside the mutation testing work, three features were delivered:

| MR | Ticket | Summary |
|----|--------|---------|
| !130 | SIRA-123 | Auto-generate invoice numbers from client code and month |
| !154 | SIRA-82 | Add authentication to GET `/api/clients/` and `/{id}` |
| !105 | SIRA-135 | Custom Sentry instrumentation for Celery tasks |

These followed the same process as the CI MRs: branch from main, commits with conventional messages, pipeline passing, squash merge.

---

## Carry-Over CI MRs from S2W2 Close (3 MRs)

| MR | Summary |
|----|---------|
| !138 | SIRA-224: use staging Supabase for schema-test |
| !140 | feat(ci): show Gherkin feature files in BDD report |
| !141 | fix(ci): always fetch sonar quality gate + fix schema-test hang |

These were merged on April 2, closing out work started in the final days of S2W2.

---

## Commit Quality

All commits followed conventional commit format throughout the week. The mutation testing series in particular had precise scope tags:

```
fix(ci): fix mutation test commands for Python and TypeScript
fix(ci): use pnpm exec for Stryker mutation testing
chore(ci): add disk cleanup step before every pipeline
fix(ci): fix Stryker plugin discovery for pnpm + mutmut
chore(ci): include integration tests in SonarQube coverage
fix(ci): ignore seed tests in mutmut config
fix(ci): ignore router tests in mutmut config
feat(api): integration test infrastructure + all domain tests
test(api): strengthen integration tests for mutation testing
```

The `fix(ci)` prefix consistently meant "something was broken in the pipeline." The `chore(ci)` prefix meant "not broken, but incomplete." `feat(api)` and `test(api)` scoped to the backend. No vague messages, no "update", no "fix stuff."

---

![Filtered MR list showing 19 MRs merged during Sprint 2 Week 3](/images/ppl/s2w3-b3-mr-list.png)

## Results

| Category | MR Count |
|----------|----------|
| CI/CD fixes and improvements | 10 |
| Testing infrastructure and mutation-killing tests | 5 |
| Application features | 3 |
| Documentation (CLAUDE.md) | 1 |
| **Total** | **19** |

---

## Evidence

- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242) integration test infrastructure
- MR !130 — [SIRA-123](https://linear.app/ppl-sira/issue/SIRA-123) invoice number generation
- MR !154 — [SIRA-82](https://linear.app/ppl-sira/issue/SIRA-82) client GET auth
- MR !105 — [SIRA-135](https://linear.app/ppl-sira/issue/SIRA-135) Sentry for Celery
- MR !138, !140, !141, !145, !146, !147, !148, !149, !150, !152, !153, !156, !158, !159 — CI/testing series
