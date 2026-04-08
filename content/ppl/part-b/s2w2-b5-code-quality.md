---
title: "PPL: Code Quality [Sprint 2, Week 2]"
date: 2026-03-30
description: "How Sprint 2 Week 2 raised the quality bar from manual SonarQube checks to automated gates that block bad MRs before they reach main."
tags: ["ppl", "code-quality", "sonarqube", "ci"]
slug: s2w2-code-quality
toc: true
---

## What I Worked On

This week I overhauled the CI quality feedback loop with four related MRs. Before this week, quality checks existed but results had to be hunted down manually in GitLab's CI panel. After this week, every MR automatically receives quality reports as inline comments, and the SonarQube gate blocks merges that would lower the quality standard.

---

## SonarQube Quality Gate in MR Comments

MR !132 (SIRA-231) added a `sonar-scan` post-processing step that fetches the quality gate result from SonarQube and posts it directly as an MR comment via the GitLab API.

Before this change, a developer had to navigate to SonarQube, find the project, and check the latest analysis. Most of the time this didn't happen. Now, every MR gets:

```
🟢 SonarQube — PASSED
Coverage: 91% (threshold: 85%)
New issues: 0
Reliability rating: A
Security rating: A
```

Or if failing:

```
🔴 SonarQube — FAILED
Coverage: 78% (below 85% threshold)
New issues: 3 (code smells)
```

The quality gate is now a blocking check. A yellow exit (non-critical issues) still allows the MR to proceed; a red exit blocks it. This is the `exit 77` pattern from MR !125 applied to quality — warnings don't block, failures do.

---

## Schema-Test with Real Staging Supabase

MR !138 (SIRA-224) moved the `api:schema-test` job from a mocked environment to a real staging Supabase instance.

Schemathesis generates hundreds of test cases from the OpenAPI schema and fires them at the running API. With a mocked DB, edge cases in query behavior go undetected. With a real Supabase instance:
- FK constraint violations get caught
- RLS policy gaps surface
- Unexpected 500s from query edge cases appear in test output

This sprint, the schema-test ran 806 test cases across 16 endpoints, all passing. The real DB catches regressions that unit tests miss.

---

## BDD and Test Reports Per MR

Two MRs improved how test results are surfaced per-MR:

**MR !129 (SIRA-227)** added BDD report extraction. The `api:bdd` CI job now parses pytest-bdd output and posts a per-feature pass/fail table to the MR, along with the raw Gherkin feature file content. Reviewers can see exactly which behavior scenarios were tested and whether they passed, without opening the CI log.

**MR !126 (SIRA-228)** added per-job test result summaries. Each CI job (api-test, web-test, web-build, schema-test, SAST, BDD, sonar) posts its own formatted comment showing pass/fail counts, coverage, and build size. Green results are collapsed by default; yellow or red results are expanded so failures are immediately visible.

The net effect: a reviewer opening an MR now sees quality data inline without clicking anywhere else.

---

![SonarQube quality gate result posted as MR comment](/images/ppl/s2w2-b5-sonarqube.png)

## Before vs. After

| Metric | Before (S2W1) | After (S2W2) |
|--------|--------------|--------------|
| SonarQube check | Manual: open SonarQube dashboard | Automatic: posted to MR, blocks on failure |
| Schema-test | Mocked environment | Real staging Supabase |
| BDD results | Hidden in CI logs | Gherkin scenarios shown in MR comment |
| Test coverage | Visible in CI only | Summarized in MR comment per job |
| Quality gate blocking | None | SonarQube gate blocks red, passes yellow |

---

## Results

- MR !132: SonarQube gate now active on every MR targeting main
- MR !138: 806 schema-test cases passing against real staging DB
- MR !129: BDD reports visible inline on every MR
- MR !126: Per-job CI summaries on every MR
- No new SonarQube issues introduced in any of this week's MRs

---

## Evidence

- MR !132 — [SIRA-231](https://linear.app/ppl-sira/issue/SIRA-231) SonarQube quality gate in CI
- MR !138 — [SIRA-224](https://linear.app/ppl-sira/issue/SIRA-224) staging Supabase for schema-test
- MR !129 — [SIRA-227](https://linear.app/ppl-sira/issue/SIRA-227) BDD report extraction
- MR !126 — [SIRA-228](https://linear.app/ppl-sira/issue/SIRA-228) per-job CI test result comments
- Source: `.gitlab-ci.yml`, `scripts/ci-report.sh`
