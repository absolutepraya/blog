---
title: "[S4, W2] PPL: Smaller Output, Tighter Coordination, Higher Floor"
date: 2026-05-20
description: "Three MRs instead of twelve, four substantive reviews instead of two, and a CI gate that raised the React Doctor quality floor for every future MR on the project. Plus codifying squash-always into team convention via a live agent interaction. Discipline that scales down without softening."
tags: ["ppl", "discipline"]
slug: "s4w2-discipline"
toc: true
---

## Output Summary

Sprint 4 Week 2 (May 14 to 20) numbers:

| Metric | Count | Compare to S4W1 |
|--------|------:|-----------------|
| MRs authored & merged | 3 | down from 12 |
| MRs reviewed with substantive threads | 4 | up from 2 |
| MRs approved (no comment) | 1 | -- |
| Direct main commits | 2 | down from 10 |
| Domains covered | 2 (Permission Request PBI, CI quality gate) | down from 4 |
| Branches with SIRA ticket prefix | 3 of 3 | held |
| Force-pushes to main | 0 | held |
| MRs merged with red CI | 0 | held |

The volume dropped intentionally. S4W1 was a sira-mr-bot push (one big greenfield service across 12 small MRs). S4W2 was a Permission Request System push: one PBI shipped end-to-end across three coordinated MRs, with the third being a P0 bypass closure that the audit caught. Smaller surface, deeper coordination.

## The Three MRs as One Coordinated PBI

PBI 45 (Staff Permission Requests) is the structural answer to "how do AR_STAFF users propose sensitive changes that need admin review?" Three MRs landed in sequence this week:

```
!307  SIRA-207 feat(api): BE permission request system
!308  SIRA-208 SIRA-209 feat(web): permission request UI (staff + admin)
!310  SIRA-374 fix(api): enforce server-side RBAC bypass closure
```

The sequence is deliberate. **!307 targets `main`** because it's the BE foundation. **!308 targets the !307 branch** (not `main`) so reviewers only see the FE diff layered on the BE, not the BE re-stated. When !307 merged to main, !308 was rebased and merged immediately. **!310 follows up** with the security bypass that an audit pass against the new system surfaced: the underlying mutation endpoints were still directly callable by AR_STAFF, bypassing the permission flow entirely.

I could have collapsed this into one giant MR. I didn't, for three reasons:

1. **Review fatigue compounds.** A 1500-line MR gets reviewed once, lazily. Three 500-line MRs get reviewed three times, properly.
2. **CI feedback isolates blame.** When `!308 web:test` failed once, I knew the FE was the issue. If it were one giant MR I'd have spent time bisecting BE vs FE.
3. **Rollback granularity.** If the FE has a bug in production and I need to revert it, MR !308 reverts cleanly. With a combined MR, rollback would also rip out the BE.

Targeting the FE MR at the BE branch is the trick that makes this work without manual rebase juggling. Reviewers get a focused diff. Once the parent lands, the child rebases onto main automatically.

## Reviews That Required Reading

The fetch-week.sh output for me this week:

```
MRs You Reviewed (with discussion threads): 4
  !316 SIRA-377 fix(api): implement 7 HTTP security headers     — 1 thread
  !311 SIRA-331  Risk Prioritization sort/badge/tab/filter      — 2 threads
  !304 SIRA-319  Fix invalid and non-atomic duplicate client    — 2 threads
  !269 SIRA-321  Fix invalid value visibility and table width   — 1 thread
```

The !304 review was the depth one. 13 findings graded P0/P1/P2/P3, the most consequential being a P0 deadlock from non-deterministic lock ordering in a Postgres function:

> [...] lock ordering is non-deterministic so two concurrent merges on the same pair from opposite directions (admin A keeps X discards Y, admin B keeps Y discards X) will deadlock. postgres aborts one with `deadlock detected` which surfaces as a 500 to the user. fix by locking in id order regardless of role [...]

That review is the focus of my b4 blog this week. For b3, the discipline angle is that reading a 300-line MR carefully enough to find an order-dependent deadlock takes maybe 45 minutes. Doing it for 4 MRs in a week competes with my own MR output. The 12-MR weeks happen because I'm not also doing depth reviews. The 3-MR weeks happen when I am. That tradeoff is the actual discipline: knowing which mode the week needs to be in, and not pretending I can sustain both.

## React Doctor Floor: Raising the Bar for Everyone Else

The most consequential discipline move this week is a single direct-main commit:

```
475222ed 2026-05-14 ci(react-doctor): enforce HCE score floor of 95
```

Background: [React Doctor](https://github.com/aidenybai/react-doctor) is the FE scanner we wired into CI as part of MR !295 (SIRA-353) at the end of S4W1. It scans React code for state/effects bugs, perf issues, accessibility regressions, and architectural smells, then emits an HCE (Healthy Component Engineering) score 0-100. The initial integration ran it as soft-fail-only: a yellow status if the score dropped, but nothing blocked merge.

This week I flipped that. The `web:react-doctor` CI job now hard-fails the pipeline if `summary.score < 95`. Every MR that touches the web app has to either keep the score at 95 or above, or get the score back up before merge. The same check runs in the local pre-push hook so developers see it before push.

The reason this is a discipline move and not just a CI config change: it changes the project's contract with itself. Before the floor, react-doctor was advisory; people could ignore the score if their MR was urgent. After the floor, the score is a load-bearing quality signal. The current main score is high enough that the floor is generally easy to clear, but the floor is structural: as the codebase grows, contributors cannot accidentally regress quality without the CI noticing.

This is exactly the pattern from a4 Teamwork: integration is the floor, custom enforcement is the ceiling. React Doctor was a tool we used. The floor=95 commit is when it became infrastructure.

## Codifying Squash-Always as Team Convention

The other discipline moment this week is conversational. On 2026-05-20 evening, MR !316 (Fernanda's HTTP security headers) was ready to merge. I asked yanto to handle it:

```
[16:54] praya: yanto merge this
[16:54] praya: bismillah
```

Yanto came back with:

```
[16:57] yanto: udah gua merge
masih jalan nih, 3 min elapsed, iteration 11/60, ...
statusnya aman juga tadi:
1. MR mergeable, no conflict, no draft
2. pipeline 16712 success
3. blocking discussions resolved
4. review minor dari qen udah ke-address di head MR

merge result:
1. MR !316 sekarang status merged
2. merge commit: 0622841c738c548b25e48de4648ef40aab7085b6
3. squash commit: 737a715ee527d9eba357b34ac4efbdda9553d1b9

sempet kena 422 dulu, ternyata project ini wajib squash pas merge. terus gua merge ulang pake squash=true, sukses
```

The 422 retry is the interesting part. Yanto first tried a plain merge, got 422 because the project requires squash, then retried with `squash=true` and succeeded. After it merged, I asked yanto to remember the rule:

```
[16:59] praya: save ke memory lu bro, tiap merge selalu squash
jadi next kali buat SIRA, default merge pake squash enabled ya bro
[17:00] yanto: sip, udah gua simpen
```

That two-line exchange is convention-setting. The squash-always rule existed in `CLAUDE.md` already, but it had to be discovered by the agent through a failed merge. Now it's in yanto's memory and will be applied on the first try next time. The same pattern works for any team convention: when an agent (or a new teammate) trips over an unwritten rule, write it down somewhere durable so the next person doesn't trip on the same edge.

The discipline aspect is the same as any other code-as-convention move: instead of explaining the rule one-on-one when a new person asks, the rule lives in a place every contributor reads.

## Direct Main: Two Commits, Both Justified

```
04f21762 2026-05-16 fix(web): make BlocksSpinner loop continuously
475222ed 2026-05-14 ci(react-doctor): enforce HCE score floor of 95
```

Both pass the test from S4W1: would a teammate plausibly object?

- The BlocksSpinner fix is a one-line animation tweak with no behavior implication. It's the kind of UI polish that doesn't need an MR cycle.
- The React Doctor floor commit is a CI config change in a file (`.gitlab-ci.yml`) that only PO/maintainers touch anyway. The floor value (95) is conservative and matches the current main branch score.

Two commits, both within the "non-feature, non-prod-codebase" guardrail from project conventions.

## What I Learned

**Smaller output weeks can be higher-coordination weeks.** Three authored MRs feels like a slow week compared to twelve, but three coordinated MRs that ship a complete PBI plus four real reviews is more team value than twelve isolated MRs. The honest framing of discipline is not "how many MRs did I merge" but "how much did I move the team forward, including by reading and improving other people's work."

**Floor commits are the discipline that compounds.** A CI gate on react-doctor at 95 is a one-line change to `.gitlab-ci.yml`. It changes how every future MR on the project will be evaluated. That's leverage. Pick the floors carefully (they constrain everyone), then commit to them and let the CI enforce.

**Convention-setting is a one-pass investment.** Telling yanto "squash always for SIRA" took 20 seconds of typing. The cost of NOT doing it is the 422 retry on every future merge yanto handles, which is forever. Anywhere I notice an agent or teammate tripping on an unwritten rule, the right move is to spend 20 seconds making it written.

## Evidence

- [MR !307 SIRA-207 feat(api): BE permission request system](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/307)
- [MR !308 SIRA-208 SIRA-209 feat(web): permission request UI](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308)
- [MR !310 SIRA-374 fix(api): RBAC bypass closure](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310)
- Reviews delivered: [!316](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/316), [!311](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/311), [!304](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/304) (the 13-finding deep review), [!269](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/269)
- Approval: [!291 SIRA-277 telegram bug fixes](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/291)
- React Doctor floor commit: `475222ed ci(react-doctor): enforce HCE score floor of 95` (direct main, 2026-05-14)
- BlocksSpinner fix: `04f21762 fix(web): make BlocksSpinner loop continuously` (direct main, 2026-05-16)
- Squash convention codification: Discord `#dev` 2026-05-20 16:54-17:00 (yanto autonomous merge of !316 + memory training)
- Filtered MR list: [GitLab merge requests deployed 2026-05-14 to 2026-05-21](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests?scope=all&state=merged&author_username=absolutepraya&deployed_after=2026-05-14&deployed_before=2026-05-21)
