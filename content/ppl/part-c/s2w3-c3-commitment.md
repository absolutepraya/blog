---
title: "PPL: Sustained Quality on Hard CI Work [Sprint 2, Week 3]"
date: 2026-04-15
description: "Five iterative MRs to get mutation testing right, three direct main commits, five thorough reviews, three in-branch fixes for teammates, sustained over seven days with the iteration trail visible in the commit log instead of hidden via force-push."
tags: ["ppl", "commitment", "work-ethic", "productivity"]
slug: s2w3-commitment
toc: true
---

## Overview

Sprint 2 Week 3 (April 9 to 15) output summary:

| Metric | Count |
|--------|-------|
| MRs authored & merged | 5 |
| MRs reviewed (substantive) | 5 |
| Direct main commits | 3 |
| Squashed commits on teammates' branches | 3+ |
| Domains covered | 3 (CI infrastructure, testing, observability) |

The week was deliberately narrow in domain. All five authored MRs centered on operationalizing mutation testing in CI. That focus is what made the iteration possible.

---

## Iteration Discipline: Five MRs to Get One Thing Right

Mutation testing does not configure itself on the first try. Each pipeline run on a new test environment surfaces a new failure mode (tooling integration, plugin discovery, score calculation, runtime explosion). I shipped five MRs this week, each addressing one new failure mode found by the previous run:

| MR | Day | What it Fixed |
|----|----:|---------------|
| !183 | Apr 9 | Initial mutation testing on MR pipelines + report comments |
| !184 | Apr 9 | mutmut 0% score (tooling integration bug) + linear false tagging |
| !185 | Apr 10 | Linear false tagging (deeper sanitizer) + mutation score improvements |
| !186 | Apr 10 | Auto-run Stryker on MR + remove duplicate TS checker for speed |
| !187 | Apr 11 | Make mutation:typescript manual and non-blocking (runtime too high for blocking gate) |

Five MRs over three days, each one triggered by a real CI failure I observed. The walk-back from "block on TypeScript mutation" to "manual TypeScript mutation" (between !186 and !187) is visible in the commit log, not hidden by amending or force-pushing. That trail is the actual deliverable, because the next contributor wondering "why is mutation:typescript manual?" can read MR !187 and see that we tried the auto-run version, measured the runtime, and decided the trade-off.

The commitment angle here is **continuing to iterate when the first answer is wrong**. The easy thing after !183 would have been to declare mutation testing "shipped" and move on. Each follow-up MR was extra work that did not show as a feature ticket, only as a quality of the system that the team could rely on going forward.

---

## Quality Bar Held: Three Direct Main Commits

Three commits went straight to main this week, each one small and self-contained:

- `54fe8055` — SIRA-274 shard Supabase CLI stacks for parallel integration-test (!197 follow-up tuning)
- `1d957968` — feat(api): add Sentry performance spans to risk scoring, telegram, and reminder worker
- `e7e1efa6` — chore(ci): update mutation target to 80% + add manual Stryker note

Direct-to-main is a privilege that requires the discipline to keep changes small, reviewed in context (in PR review software via a small follow-up commit), and testable. Each of these three is under 50 lines and makes one focused change. None of them required a follow-up to fix a regression they introduced. That is the bar for direct-to-main: if you cannot guarantee no regression, it goes through an MR.

---

## Five Substantive Reviews, Two P0s Caught

Reviewed five teammate MRs (!177, !174, !171, !169, !151) with substantive thread discussions, including two P0s caught through manual testing that static reading missed. The b4 blog this week has the technical detail; the c3 angle is the time investment: each review involved checking out the branch, running the feature locally on dev Supabase, and verifying the user-facing behavior, not just reading the diff.

That kind of review takes 30 to 90 minutes per MR. Five MRs is roughly half a working day spent on other people's code. That cost is visible in my own MR cadence (only five authored MRs this week), but it is the right trade because each P0 caught in review costs less than the same P0 caught after merge.

---

## Quality Indicators

A few concrete signals from the week:

- **Zero merge regressions** caused by my MRs. Every CI job passed before merge, including the new mutation-testing jobs.
- **Zero force-pushes** on any branch. Every iteration is a new commit, every walk-back is visible. (For the three direct main commits, "no force-push" is structural, but it also held on the five MR branches before squash.)
- **Zero unresolved P0 threads** after merge across all five reviews I posted. Each P0 either had a fix commit pushed by the author or by me.
- **Five MRs squash-merged** with their full pre-squash commit history showing iterative red/green/refactor work or explicit fix attempts.

These are not impressive numbers in absolute terms. They are the floor for "I am holding the quality bar". The point is that I held that floor across the week without exception.

---

## Time Allocation

The rubric mentions ~17 hours per week as a baseline. Realistic estimate for this week:

- Mutation testing setup and iteration: 8 hours
- Five MR reviews including manual testing: 4 hours
- Squashed contribution commits on teammates' branches: 1.5 hours
- Three direct main commits including investigation: 2 hours
- CLAUDE.md runbook updates: 1 hour
- Linear ticket triage and MR coordination: 1.5 hours

Roughly 18 hours of focused project work. The number itself is not the point; the rubric's Level 4 wording explicitly says "tidak harus lebih dari 17 jam per pekan, yang penting kualitas kerja signifikan". The point is that none of those hours were idle. Every hour produced either an MR, a review, a fix on someone else's branch, a runbook entry, or a piece of CI infrastructure that the team uses on every subsequent pipeline run.

---

## What Sustained Commitment Looks Like

Two things I think generalize from this week.

**Pick a narrow focus and iterate hard.** Mutation testing was the entire week's MR throughput. The five MRs are five iterations on the same problem, not five different problems. Narrow focus is how you get to "this works reliably" instead of "this kind of works".

**The visible iteration trail is the artifact.** Force-pushing the cleanup looks tidier in the moment but destroys the record of why decisions were made. Every walk-back from this week (!186 to !187 in particular) is in the git log so the next person reading the CI config can see the reasoning, not just the result.

---

## Evidence

- Authored MRs (5): [!183](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/183), [!184](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/184), [!185](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/185), [!186](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/186), [!187](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/187)
- Reviewed MRs (5): [!177](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/177), [!174](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/174), [!171](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/171), [!169](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/169), [!151](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/151)
- Direct main commits: `54fe8055`, `1d957968`, `e7e1efa6`
- Source: `scripts/ci-report.sh`, `scripts/ci-supabase-slot.sh`, `apps/api/pyproject.toml`, `apps/web/stryker.conf.js`
