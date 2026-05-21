---
title: "[S4, W2] PPL: Smaller Week, Higher Density, Floor Held"
date: 2026-05-20
description: "Three authored MRs (down from twelve) but each is the full thickness of a coordinated PBI delivery. The headline commitment marker was sustaining the verification work on Fadhli's MR !304 across seven days of follow-up commits, ensuring each of 13 findings actually got addressed. Floor metrics held: zero force-pushes, zero red CI merges, zero stale branches."
tags: ["ppl", "commitment", "work-ethic"]
slug: "s4w2-commitment"
toc: true
---

## Output Summary

Sprint 4 Week 2 (May 14 to 20) delivery:

| Metric | Count | Compare to S4W1 |
|--------|------:|-----------------|
| MRs authored & merged | 3 | down from 12 |
| Direct main commits | 2 | down from 10 |
| MRs reviewed (substantive verification) | 1 deep + 3 light | up in quality |
| MRs gatekept as merger | 5 (incl. agent-delegated) | new measure |
| Lines of test added (integration) | 9 new RBAC tests | -- |
| Force-pushes to main | 0 | held |
| MRs merged with red CI | 0 | held |
| Stale branches at week end | 0 | held |

The honest framing: this week's volume was lower than S4W1. The S4W1 push (12 MRs, mostly the mr-bot greenfield build) is not a sustainable cadence; weeks like this are the recovery and consolidation that make weeks like that survivable.

The week shipped one major PBI end-to-end (PBI 45 Staff Permission Requests, 3 MRs in coordinated sequence), one P0 security follow-up (RBAC bypass closure that an audit pass surfaced), and one quality-bar promotion (React Doctor floor from soft-fail to hard-fail).

## The Three MRs and Why They Coordinated as One

```
!307  SIRA-207 feat(api): BE permission request system    (merged 2026-05-14)
!308  SIRA-208 SIRA-209 feat(web): permission request UI  (merged 2026-05-14)
!310  SIRA-374 fix(api): RBAC bypass closure              (merged 2026-05-14)
```

All three landed on May 14 in coordinated sequence (BE merged first, FE rebased and merged second, security follow-up merged third). The commitment marker is that each MR went through full CI, full review feedback cycle, and full pre-push verification before merge. None of them was rushed because "we're shipping the PBI today."

The b3 (discipline) blog covers the MR mechanics; the commitment angle here is that I chose not to collapse the PBI into one giant MR even when the deadline pressure suggested it. Three focused MRs is more reviewer work than one combined MR in the short term, but it produces cleaner rollback granularity and tighter CI signal in the long term. The right thing was the slower thing.

## Verifying !304 Across Seven Days

The commitment work that's hardest to see in metrics is the verification of MR !304 (Fadhli's atomic duplicate-client merge). I posted a 13-finding review on May 13 (last day of S4W1). Between May 13 and May 20, Fadhli pushed 42 follow-up commits addressing each finding. The verification on May 20:

- Read each fix commit, mapped it to the original P0/P1/P2/P3 finding
- Confirmed the fix matched the recommendation (e.g., the deadlock fix in `f9d61b55` literally ordered `for update` locks by id, exactly as the original P0 suggested)
- Acknowledged the one P3 that was explicitly declined (with author's reasoning in the thread)
- Merged

That's about an hour of focused reading on a 7-day-old review. It would have been faster to bare-approve once threads were marked resolved, but bare-approving a P0 deadlock fix would have meant trusting that the author understood my finding correctly. Reading the fix commit is the only way to verify.

The b4 blog has the per-finding tracking table. The commitment angle here is that closing a review properly is a separate act of work from opening it, and it has to happen even when the original review was last week. Reviews that get opened but never properly closed produce false signal across the project ("we had a deep review on !304" means very different things depending on whether the verification step happened).

## Raising the React Doctor Floor

Direct commit `475222ed` (2026-05-14) promoted the `web:react-doctor` CI job from soft-fail-on-warnings to hard-fail-when-score-below-95. This is a one-line CI config change but a structural commitment: every future MR on the project must keep the React Doctor HCE score at 95 or above. The score can only go up.

Why this counts as a commitment marker: I had the option to leave react-doctor as a soft gate that produces yellow comments forever. Yellow comments are easy to ignore. The hard floor forces every contributor (including me) to keep the score clean on every MR. That includes the MRs I would otherwise rush through. I committed the project to the floor knowing that it would constrain my own future work first.

The current main branch sits comfortably above 95, so the floor doesn't immediately reject any MR. But the next time I'm tempted to merge a small UI change without checking the score, the CI will catch me. That's the discipline asymmetry: I lose nothing today, I save the project from many small regressions over the next sprints.

## Floor Metrics Held

A few signals from the week:

- **Zero force-pushes** to main or to any of the 3 authored MR branches. Two reverts (the SIRA-364 contract preservation fixes for the new SIRA-374 gate) are real revert-style commits, visible in pre-squash history.
- **Zero merges with red CI.** Every MR had a green pipeline at merge time. The 85% new-code coverage gate on SonarQube did flag MR !307 below threshold initially; I added the missing test commits (`277cfca6`, `49ec8d46`, `41a430c1`) to lift coverage from 79% to 91% before merge.
- **Zero stale branches.** All 3 MRs had `should_remove_source_branch=true`. At week end, my namespace had only `abhip/fix/SIRA-374-rbac-bypass-fix` (which auto-deleted on merge that same day), no orphans.
- **Zero post-merge regressions** from my MRs. The Permission Request system has been live on staging since May 14; staff submitted real test requests, admins approved them, the flow worked end-to-end.

These are floor metrics. The point is the lower MR count this week didn't come with quality compromises.

## Time Allocation

Honest estimate for the week's focused work:

- BE permission request system (!307) including test coverage commits: ~6 hours
- FE permission request UI (!308) including 4 test coverage commits and ui-ux-pro-max design pass: ~5 hours
- RBAC bypass closure (!310) including red-green TDD discipline: ~3 hours
- !304 verification across 7 days of Fadhli's follow-up commits: ~1 hour
- Three light reviews (!316 via yanto, !311, !269) + 1 bare approval (!291): ~30 minutes total
- React Doctor floor promotion + BlocksSpinner direct commits: ~1 hour
- yanto memory training + Bertrand VPS+webtest conversation: ~45 minutes
- Late-evening yanto-mediated merge of !316: ~5 minutes elapsed (yanto did the work)

Total: roughly **17 hours** of focused project work over seven days. Less than S4W1's 23 hours, but the work landed on three high-stakes pieces (BE foundation, FE coverage, security gap) rather than spread across twelve small ones.

## The Commitment Asymmetry of Smaller Weeks

A 12-MR week feels like commitment. A 3-MR week feels like coasting. The honest accounting says otherwise: 3 coordinated MRs that ship one PBI end-to-end with a P0 audit follow-up is more team value than 12 isolated small ones. The metric I want to track is not "how many MRs did I merge" but "how much did I move the team forward, including by reading and closing other people's work."

On that lens, this week was solid. PBI 45 shipped. The audit finding closed. The React Doctor bar went up. Fadhli's !304 made it to main with all 13 findings addressed. Bertrand has a path to VPS access. yanto knows the squash convention for future merges.

What I did NOT do this week: ship a new service. Refactor a large area. Burn out trying to match S4W1's volume. That's commitment too: knowing when the right cadence is consolidation, not push.

## What I Learned

**Volume is not the only commitment signal.** A 3-MR week with a coordinated PBI delivery and a P0 closure is a different kind of commitment from a 12-MR week with a greenfield build. Both are real. Pretending they're the same metric understates both.

**Verifying a review week-old still counts as this week's work.** The !304 verification was tracked against S4W1's review thread, but the actual hour of careful reading happened on May 20. That hour is this week's commitment evidence, even though the artifact (the review) was last week's.

**Floor commits compound across all future weeks.** Promoting the React Doctor gate to a hard floor is a 5-minute change in `.gitlab-ci.yml`. The discipline it enforces will save many small regressions over the rest of the project's lifetime. That's leverage in the literal sense; small investment, large amplification.

## Evidence

- [MR !307 SIRA-207 BE permission request system](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/307)
- [MR !308 SIRA-208 SIRA-209 FE permission request UI](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308)
- [MR !310 SIRA-374 RBAC bypass closure](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310)
- [MR !304 SIRA-319 atomic merge](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/304), review opened S4W1, verified and merged 2026-05-20 (Fadhli's 42 follow-up commits)
- Other merges gatekept this week: [!291](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/291), [!311](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/311), [!269](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/269), [!316 via yanto](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/316)
- Direct main commits: `475222ed ci(react-doctor): enforce HCE score floor of 95` (2026-05-14), `04f21762 fix(web): make BlocksSpinner loop continuously` (2026-05-16)
- Test coverage commits lifting SonarQube gate on !307: `277cfca6`, `49ec8d46`, `41a430c1`
- Filtered MR list: [GitLab merge requests deployed 2026-05-14 to 2026-05-21](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests?scope=all&state=merged&author_username=absolutepraya&deployed_after=2026-05-14&deployed_before=2026-05-21)
