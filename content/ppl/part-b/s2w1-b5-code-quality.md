---
title: "PPL: From 31 Violations to Zero [Sprint 2, Week 1]"
date: 2026-03-23
description: "Enforcing SonarQube quality gates with zero tolerance, pushing coverage from 74.7% to 87.5%, and why mutation testing proved 91% coverage is meaningless."
tags: ["ppl", "code-quality", "sonarqube", "coverage", "mutation-testing"]
slug: s2w1-code-quality
toc: true
---

## What I Worked On

This week I enforced strict quality gates across the entire CI pipeline. The project previously had `allow_failure: true` on SonarQube and security scans, meaning violations were reported but never blocked merges. I changed that.

## SonarQube: 31 Violations → 0

### The Violations

SonarQube flagged 31 issues across the codebase:
- **1 CRITICAL vulnerability**: `jwt.get_unverified_header()` reading JWT headers without signature verification
- **3 CRITICAL code smells**: duplicated string literals, nested component definitions
- **27 other issues**: unused variables, missing `Readonly<>` on props, duplicate CSS blocks, array index keys

### The Fixes

**Backend** (3 files): Refactored JWT decode to try HS256 first and fall back to asymmetric on `DecodeError`, eliminating the unverified header call entirely. Extracted duplicated literals to constants.

**Frontend** (13 files): Extracted component definitions to module scope, added `Readonly<>` to props, merged duplicate CSS blocks, replaced array index keys with stable identifiers, memoized context values.

**CI enforcement**: Removed `allow_failure: true` from `sonar-scan` and `security:sast`. Added `sonar.qualitygate.wait=true`. Every MR now blocks on quality gate.

### Quality Gate Status (After)

| Condition | Threshold | Actual | Status |
|---|---|---|---|
| Coverage on new code | >= 85% (CI) | 87.5% | OK |
| Duplicated lines | <= 3% | 0.24% | OK |
| Security hotspots reviewed | 100% | 100% | OK |
| New violations | 0 | 0 | OK |

## Coverage: 74.7% → 87.5%

SonarQube's default gate requires 80% on new code. We enforce 85% at the CI level for stricter quality.

When coverage was at 74.7%, I fixed it two ways:
1. **Excluded scaffold components**: 10 unused shadcn/ui components were dragging down the denominator. Verified unused via Knip, excluded from coverage.
2. **Added 17 client-form tests**: Covered `validateClientForm`, `toCreatePayload`, `toUpdatePayload` with trimming, null handling, and error detection tests.

Result: 74.7% → 87.5%, exceeding the 85% threshold with 2.5% headroom.

## Why 85% and Not Higher

- **80%** (SonarQube default): too lenient
- **85%** (our threshold): balances quality with velocity
- **90%+**: too strict pre-launch, forces testing scaffold components
- **Mutation testing proved coverage % is a vanity metric**: 91% line coverage with 0% mutation score means tests execute every line but verify nothing

## SonarQube S1192 in This Week's MR

Even after cleaning up the codebase, the monitoring MR (!106) triggered S1192 again: `"db.query"` string duplicated 4 times in `dashboard_service.py`. Extracted to `_SPAN_DB_QUERY` constant, quality gate passed.

This proves the enforcement is working: new code gets the same scrutiny as existing code.

## Result

- 31 → 0 violations on main
- Coverage: 74.7% → 87.5% on new code
- Quality gates now blocking (no more `allow_failure`)
- 85% coverage threshold enforced at CI level
- All 3 false positives resolved (shadcn table excluded, pagination fixed, type alias inlined)

## Evidence

- [MR !93 - Enforce SonarQube quality gates](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/93)
- [MR !94 - Resolve false positives](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/94)
- [MR !97 - Improve new code coverage](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/97)
- [MR !98 - Enforce 85% threshold](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/98)
- [MR !106 - S1192 fix in monitoring MR](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/106)
