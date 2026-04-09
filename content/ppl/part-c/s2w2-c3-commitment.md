---
title: "PPL: Work Ethic and Commitment [Sprint 2, Week 2]"
date: 2026-04-09
description: "Quantitative and qualitative breakdown of Sprint 2 Week 2 contributions: 19 MRs authored, 3 MRs reviewed with 44 points, 13+ teammate MRs merged, all within a week dominated by a mutation testing sprint."
tags: ["ppl", "commitment", "work-ethic", "productivity"]
slug: s2w2-commitment
toc: true
---

## Overview

Sprint 2, Week 2 (April 3 to 9) output summary:

| Metric | Count |
|--------|-------|
| MRs authored and merged | 19 |
| MRs reviewed (in-depth, threaded) | 3 (44 review points) |
| MRs merged as maintainer | 13+ (from teammates) |
| Commits | 50+ |
| Domains covered | 5 (CI/CD, testing infrastructure, API features, documentation, infra) |

---

## Quantitative Output

### MRs Authored and Merged

19 MRs created and merged to `main` this week, broken down by category:

**CI/CD and Mutation Testing (10 MRs)**

| MR | Type | Description |
|----|------|-------------|
| !138 | feat(ci) | Use staging Supabase for schema-test |
| !140 | feat(ci) | Show Gherkin feature files in BDD report |
| !141 | fix(ci) | Always fetch sonar quality gate + fix schema-test hang |
| !145 | fix(ci) | Fix mutation test commands for Python and TypeScript |
| !146 | fix(ci) | Use pnpm exec for Stryker mutation testing |
| !147 | chore(ci) | Add disk cleanup step before every pipeline |
| !148 | fix(ci) | Fix Stryker plugin discovery for pnpm + mutmut |
| !149 | chore(ci) | Include integration test coverage in SonarQube reports |
| !158 | fix(ci) | Ignore seed tests in mutmut config |
| !159 | fix(ci) | Ignore router tests in mutmut config |

**Testing Infrastructure (4 MRs)**

| MR | Type | Description |
|----|------|-------------|
| !144 | feat(api) | Integration test infrastructure + all domain tests (9 domains) |
| !150 | fix(web) | Increase timeout for flaky clients-page form tests |
| !152 | chore(ci) | Include integration tests in Python mutation testing |
| !153 | test(api) | Strengthen integration tests for mutation testing |

**Application Features (3 MRs)**

| MR | Type | Description |
|----|------|-------------|
| !130 | feat(api,web) | Auto-generate invoice number with client code |
| !154 | feat(api) | Add auth to GET client API endpoints |
| !105 | feat(api) | Custom Sentry instrumentation for Celery tasks |

**Other (2 MRs)**

| MR | Type | Description |
|----|------|-------------|
| !142 | docs | Update CLAUDE.md with CI/CD, testing, and staging Supabase learnings |
| !156 | test(api) | Add mutation-killing unit tests for services |

### MRs Reviewed

3 MRs reviewed with severity-graded discussion threads:

| MR | Author | Feature | Total Issues | P0 |
|----|--------|---------|:---:|:---:|
| !155 | hl | CSV Import Modal | 14 | 3 |
| !128 | hl | Settings Page Management | 12 | 2 |
| !166 | qenthm | Risk Scoring Engine | 18 | 2 |

---

## Cross-Domain Coverage

### CI/CD (10 MRs)

The mutation testing sprint required iterative debugging of CI configuration across both Python (mutmut) and TypeScript (Stryker). Each pipeline run revealed a new issue: pnpm plugin discovery, test file exclusions, disk exhaustion, artifact paths. Each fix was its own MR, merged independently with a passing pipeline.

### Testing Infrastructure (4 MRs)

Built the integration test infrastructure from scratch: a `real_db` session fixture connecting to local Supabase, an autouse `_truncate_tables` fixture that clears all app tables via direct psycopg connection, and seed helpers for all domains. Covered 9 domain test files (clients, invoices, payments, sessions, staff, email, settings, risk scoring, reminders).

### Application Features (3 MRs)

Three features shipped alongside the infrastructure work: auto-generated invoice numbers with client code prefix and sequential numbering, authentication on previously unprotected GET endpoints, and Sentry instrumentation for Celery background tasks.

### Documentation (1 MR)

Updated CLAUDE.md with staging Supabase connection details, integration test conventions, mutation testing configuration rationale, and SonarQube coverage merging. This is a quality investment: every future AI-assisted session starts with the correct context.

---

## Quality Indicators

### Iterative Problem-Solving

The mutation testing sprint is the clearest quality signal. Rather than batching changes into one large MR, each fix was isolated, tested against the real CI pipeline, and merged independently. The 10 CI MRs represent 10 iterations of "run pipeline, read failure, fix, verify, merge." This iterative approach is slower per-MR but catches cascading issues early.

### April 5: 13 MRs in One Day

April 5 was the peak of the mutation testing sprint. 13 MRs were authored and merged in a single day:

- 6 CI fixes (Stryker plugin, pnpm exec, disk cleanup, integration test coverage, flaky test timeout, mutation testing inclusion)
- 3 application features (invoice number, client auth, Sentry Celery)
- 2 testing MRs (strengthen integration tests, mutation-killing unit tests)
- 2 additional CI refinements

Each MR had a passing pipeline before merge. No shortcuts, no `--no-verify`.

### Review Depth

The 3 reviews this week totaled 44 review points with 7 P0 (blocker) issues. The most critical catch was the broken cross-table join in the risk scoring engine (MR !166), which would have returned all clients' payments instead of the target client's payments. This would have made every risk score in the system wrong.

### Consistent Commit Discipline

All 50+ commits followed conventional commit format with accurate scope tags: `fix(ci):` for CI fixes, `chore(ci):` for non-breaking improvements, `feat(api):` for new features, `test(api):` for test additions. No vague messages.

---

## Discipline

- On-time attendance at class and sprint meetings
- Pipeline green before every merge (no `--no-verify` or force merges)
- Conventional commits throughout, with accurate type and scope tags
- Linear ticket codes in branch names for traceability

---

## Evidence

- MR !138, !140, !141, !145, !146, !147, !148, !149, !158, !159 — CI/mutation testing series
- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): integration test infrastructure
- MR !130 — [SIRA-123](https://linear.app/ppl-sira/issue/SIRA-123): invoice number generation
- MR !154 — [SIRA-82](https://linear.app/ppl-sira/issue/SIRA-82): client GET auth
- MR !105 — [SIRA-135](https://linear.app/ppl-sira/issue/SIRA-135): Sentry for Celery
- MR !142 — docs: update CLAUDE.md
- MR !150, !152, !153, !156 — testing infrastructure
- Reviews: MR !155, !128, !166 (44 total review points)
