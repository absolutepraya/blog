---
title: "[S3, W2] PPL: Telegram Shipped, Plus Sustained Quality Across 8 MRs"
date: 2026-04-29
description: "Eight authored MRs in seven days, six substantive reviews with 83 findings, three direct main commits, and the Telegram feature merged after weeks of TDD discipline on a worktree. Cadence held without breaking the quality bar."
tags: ["ppl", "commitment", "work-ethic"]
slug: "s3w2-commitment"
toc: true
---

## Output Summary

Sprint 3 Week 2 (April 23 to 29) delivery:

| Metric | Count |
|--------|------:|
| MRs authored & merged | 8 |
| MRs reviewed (substantive) | 6 |
| Direct main commits | 3 |
| In-branch commits on teammates' MRs | 12+ |
| Total review findings posted | 83 (19 P0, 36 P1, 20 P2, 8 P3) |
| Domains covered | 4 (Telegram feature, CI infra, UIUX, dev tooling) |

The week's headline: **Telegram shipped**, ending several weeks of in-development worktree work with three back-to-back merged MRs (!221 main feature, !238 delivery logs, !243 daily digest priorities). Each one continued the strict red-green TDD pattern from the worktree, even after merge.

---

## The Eight MRs

```
!221  SIRA-161 feat(api,web): Telegram Bot Notifications Phase 1 & 2
!223  chore(hooks): harden pre-push (lint, build, knip, lockfile, branch validation)
!225  SIRA-161 chore(ci): inject Telegram env vars into prod .env.local
!228  SIRA-302 fix(web,api): UIUX polish sidebar, settings, tables, mobile blocker
!232  SIRA-303 fix(ci): restore api:integration-test, fix containerd ingest race
!234  SIRA-306 fix(api): prevent Telegram test notifications
!238  SIRA-305 feat(api): add Telegram delivery logs
!243  SIRA-299 feat(api): add daily digest "Prioritas Hari Ini" section
```

![GitLab merge request list filtered to my authored MRs deployed between 2026-04-23 and 2026-04-30, showing all 8 MRs merged in the S3W2 window](/images/ppl/s3w2-c3-mr-list.png)

Three of them (`!221`, `!238`, `!243`, `!234`) are the Telegram feature shipping in stages, with red/green commit pairs visible in the pre-squash history. Two (`!232`, `!223`) are CI/dev-infrastructure work that the team uses on every subsequent pipeline run. One (`!228`) is a 30-component UI polish pass that also wrote 47 lines of conventions into `apps/web/CLAUDE.md`. One (`!225`) is the production rollout work for Telegram env vars.

Each MR was mergeable on its own. None required a follow-up to fix a regression it introduced.

---

## Telegram: From Worktree to Production

Last week's c3 noted that "even though this feature has no merged MR yet, the work is real, tracked, and disciplined." This week the work landed. Three points worth highlighting because they show the discipline carried through the merge boundary, not just on the worktree.

**The MR was reviewable in chunks, not a 2,000-line dump.** MR !221 description records the test counts at merge: 1452 backend tests passing, 782 frontend tests passing. The diff is broken across logical commits in the description (Phase 1 vs Phase 2, then per-subtask). Reviewers could read it in pieces.

**Follow-up MRs continued the same TDD discipline.** After !221 merged, MR !238 (delivery logs) and MR !243 (digest priorities) added more functionality. Both came with paired red/green commits visible in the pre-squash history (`85b9f2d3` red → `0e71c85b` green for delivery logs; `39e8f659` red → `bfb74c13` green and two more pairs for digest priorities). The TDD norm did not relax once the main feature was merged.

**A small fix MR (!234) was treated with the same rigor as a feature MR.** SIRA-306 was a one-day task: prevent the Telegram service from making real API calls during CI. It still went through a red commit (`b2b06fdb`) before the green (`47941303`) because the contract for the test-mode guard return shape mattered. Quality bar didn't drop for small work.

---

## Reviewer Output Held Steady at 6 Substantive Reviews

While shipping eight MRs, I also completed six substantive reviews on teammate MRs (!213, !216, !220, !218, !217, !203) with 83 priority findings. The breakdown is in the c2 blog this week. The relevant point for c3: **review effort did not drop when feature work intensified**. Two of the reviews were the largest of the sprint so far (!213 with 45 findings, !216 with 29 findings) and they happened during the same week as the Telegram landing.

Reviewing a 45-finding MR thoroughly takes about 90 minutes including local checkout and manual testing. Six such reviews this week is roughly 5-6 hours of dedicated review time, plus the time spent posting threaded discussions and writing follow-up commits. That is real time, deliberately allocated, not squeezed in.

---

## Quality Indicators

A few signals from the week:

- **Zero merge regressions** caused by my MRs. CI passed on all 8 before merge.
- **Zero force-pushes** on any of the 8 MR branches. Every walk-back is visible.
- **Zero unresolved P0 threads** after merge across all 6 reviews I posted. Every P0 had a fix commit (from the author or from me) before the merge.
- **Zero CI runs broken by my changes** post-merge. The integration-test job specifically (which I fixed in !232) ran cleanly on every subsequent MR pipeline.

These are floor metrics, not ceiling ones. The point is that I held the floor across a week with high feature throughput.

---

## Time Allocation

Realistic estimate for the week:

- Telegram feature work (!221, !238, !243, !234): 7 hours
- UIUX polish (!228) including the 5 CLAUDE.md docs commits: 4 hours
- CI fixes (!232, !223, direct commits): 3 hours
- Six MR reviews including manual testing on !220: 5 hours
- Telegram production rollout (!225) + ops work on Nashta: 1.5 hours

Total: roughly **20 hours of focused project work** over seven days. The rubric mentions 17 hours per week as a baseline; the Level 4 wording explicitly says "tidak harus lebih dari 17 jam per pekan, yang penting kualitas kerja signifikan dan diatas rata-rata mhs fasilkom pada umumnya". That is what this week was.

---

## What Sustained Commitment Looks Like

Two patterns from this week that I think generalize.

**Land the long thing without breaking the short things.** Telegram had been on a worktree for two weeks. Landing it required three feature MRs, a CI rollout MR, and a fix MR for a test-mode regression. While that was happening, the team was still producing MRs that needed reviewing. Both halves got done, neither dropped.

**Discipline carries through merge boundaries.** The red-green TDD norm I committed to on the worktree did not relax once the worktree merged. MR !238 and MR !243 (Telegram follow-ups) have visible red/green pairs even though they are post-feature-merge work. The convention does not exist for one MR; it exists across all MRs.

---

## Evidence

- 8 authored MRs: [!221](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/221), [!223](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/223), [!225](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/225), [!228](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/228), [!232](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/232), [!234](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/234), [!238](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/238), [!243](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/243)
- 6 reviewed MRs (substantive): [!213](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/213), [!216](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/216), [!220](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/220), [!218](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/218), [!217](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/217), [!203](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/203)
- 12+ in-branch commit contributions on [!215](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/215)
- Direct main commits: `8a6cd615` (superset infra), `88697bdd` (security MCP cleanup), `c461000e` (opencode config)
- Pre-squash red/green pairs on Telegram follow-ups: `85b9f2d3`/`0e71c85b`, `645dcd84`/`b8c1a0e2`, `39e8f659`/`bfb74c13`, `0db6fc68`/`243c4193`, `946da839`/`b8be1b69`, `b2b06fdb`/`47941303`, `6bd1d046`/`86359687`
