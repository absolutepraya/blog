---
title: "PPL: Code Quality [Sprint 2, Week 3]"
date: 2026-04-08
description: "How S2W3 raised the quality bar past code coverage: integration test reports now feed SonarQube, mutation testing joins CI, and a disk cleanup step prevents OOM failures from silently corrupting quality metrics."
tags: ["ppl", "code-quality", "mutation-testing", "sonarqube", "ci"]
slug: s2w3-code-quality
toc: true
---

## What I Worked On

This week's quality work addressed a gap in how we measure test quality. We had 91% code coverage, but coverage only tells you code was executed, not that tests would catch bugs. This week, two changes raised the standard: integration test coverage now feeds into SonarQube, and mutation testing joined CI as a second quality dimension.

---

## The Coverage Gap: Integration Tests Missing from SonarQube

Before MR !149, the SonarQube coverage report was generated only from unit test runs. Integration tests, which hit the real Supabase instance and verify actual state transitions, were executed in a separate CI job but their coverage data was never merged into the SonarQube report.

This created a misleading picture. A route handler tested via integration tests would show 0% coverage in SonarQube even if it was fully tested. The 91% figure was understated for real behavior coverage, and the 85% gate was being satisfied partly by test noise.

MR !149 fixed this by merging coverage files from both the unit test job and the integration test job before uploading to SonarQube:

```yaml
sonar-scan:
  script:
    - cd apps/api
    - uv run coverage combine .coverage.unit .coverage.integration || true
    - uv run coverage xml -o coverage.xml
    - sonar-scanner ...
```

The `combine` step merges multiple `.coverage` files from different test runs. If the integration coverage file does not exist (e.g., on a branch without integration test changes), the `|| true` prevents the job from failing on the combine step.

---

## Mutation Testing as a Second Quality Dimension

Code coverage tells you a test executed a line. Mutation testing tells you a test would have caught a bug on that line. These are different questions.

A test that calls `service.create()` and asserts `result is not None` gives 100% coverage on the function but zero mutation score. A mutmut-injected bug that changes the return type or omits a field would not be caught by that assertion.

This week, both mutation testing tools were fully wired into CI:

**Python: [mutmut](https://github.com/boxed/mutmut)** runs against `src/app/services/`, the business logic layer. It is configured to only mutate service code because that is where business logic bugs live. Router mutations would only test FastAPI internals, not our code.

**TypeScript: [Stryker](https://stryker-mutator.io/)** runs against `src/lib/`, the utility functions shared across the frontend. Integration points (the API client, Supabase client, auth context) are excluded from mutation because they involve external services that are impractical to test under mutation conditions.

The Stryker thresholds enforce a minimum standard:

```json
"thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
}
```

A mutation score below 50% fails the CI job. This means you cannot merge a change that drops mutation coverage below the minimum, just as you cannot merge a change that drops line coverage below 85%.

---

## Disk Management: Silent Quality Failures from OOM

MR !147 added a disk cleanup step at the start of every pipeline. This was not cosmetic.

The Nashta VM running CI has 48 GB of disk shared between Docker images, build artifacts, and the pipeline runner. After several days of mutation testing runs, each pulling Docker images, running mutation containers, and generating HTML reports, disk usage had grown to the point where pipeline jobs were failing with "no space left on device" errors mid-execution.

These failures were silent in quality terms: a pipeline stage that fails due to disk exhaustion looks identical to one that fails due to bad code. SonarQube would not receive its upload, quality gate results would be stale, and the CI comment would show "failed" with no useful signal.

The fix adds a cleanup step before every pipeline:

```yaml
before_script:
    - docker system prune -f --volumes 2>/dev/null || true
    - docker image prune -f 2>/dev/null || true
```

The `|| true` prevents the prune from failing the pipeline if Docker is not available in that runner context.

---

## Before vs. After

| Metric | Before (S2W2) | After (S2W3) |
|--------|--------------|--------------|
| SonarQube coverage source | Unit tests only | Unit + integration tests combined |
| Mutation testing | Not in CI | mutmut (Python) + Stryker (TypeScript) in CI |
| Quality gate dimensions | Coverage only | Coverage + mutation score |
| Disk management | Manual cleanup | Auto-prune at pipeline start |

---

## Evidence

- MR !149 — chore(ci): include integration test coverage in SonarQube reports
- MR !147 — chore(ci): add disk cleanup step before every pipeline
- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): integration test infrastructure
- MR !145, !146, !148, !152, !153, !156, !158, !159 — mutation testing CI series
- Source: `.gitlab-ci.yml`, `apps/api/pyproject.toml`, `apps/web/stryker.config.json`
