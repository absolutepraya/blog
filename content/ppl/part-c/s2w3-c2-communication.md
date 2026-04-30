---
title: "PPL: Communication and Knowledge Sharing [Sprint 2, Week 3]"
date: 2026-04-15
description: "Five MR reviews with concrete fixes posted as discussion threads, three commits pushed directly onto teammates' branches to land their MRs, and a CI comment system that turned every pipeline run into a team-facing artifact."
tags: ["ppl", "communication", "teamwork", "code-review", "knowledge-sharing"]
slug: s2w3-communication
toc: true
---

## Overview

Five MRs reviewed this week with substantive thread discussions, three squashed commit contributions on teammate branches to help their work land, and a CI reporting system that turned mutation testing from "another job nobody reads" into a structured comment that surfaces test-quality regressions on every MR. Communication this week was equal parts review threads, in-branch collaboration, and tooling that makes the team's CI signal visible.

---

## 1. Five MR Reviews, All Threaded Discussions

I posted reviews on five teammate MRs this week. Each review opens with what the author got right (genuinely, not as performative politeness) and groups issues by P0/P1/P2/P3 with concrete suggested fixes in code blocks.

| MR | Author | Threads | Notable findings |
|----|--------|--------:|-----------------|
| !177 communication history UI | @fernanda.nadhiftya | 4 | UI regression caught via manual testing |
| !174 AR Staff "admin access required" toast | @fadhliraihan | 2 | Authorization toast wording + client-vs-server toast trigger |
| !171 AR Staff read-only client access | @fadhliraihan | 4 | Auth boundary correctness + 1 P0 caught via manual testing |
| !169 invoice CSV export | @hl | 2 | Header order vs API contract |
| !151 payment CSV export | @fadhlurohmandzaki | 1 | Filter persistence edge case |

The discussion-thread format matters here. Plain comments scroll off the conversation; threaded discussions stay anchored to the specific code path and require explicit resolution. Every P0 I posted had to be marked resolved by the author or by me, which forced an explicit conversation about whether the fix landed.

Two of these reviews caught **P0s through manual testing** that static reading missed (covered in detail in the b4 blog this week). Driving the feature locally before approving is an investment that consistently pays back; it changes review from "does the diff compile and pass tests" to "does the feature actually work end-to-end".

---

## 2. Squashed Commit Contributions on Three Teammate Branches

Reviews can become bottlenecks when an issue is small enough to fix but the author is offline or batching their MR work. For three MRs this week, instead of leaving a review thread and waiting for the author to address it, I pushed commits directly onto their branch with explanatory commit messages:

- **!171 SIRA-128 (AR Staff read-only client access)**: pushed a fix for the auth boundary issue plus the rollback migration that was missing.
- **!169 SIRA-153 (FE invoice CSV export)**: pushed a header-order fix to align with the API contract.
- **!151 SIRA-154 (FE payment CSV export)**: pushed a filter-persistence fix.

These commits show up as my contributions when an MR is squash-merged, even though the MR title is the original author's work. The b4 blog this week documents the specific fixes; the c2 angle here is the communication choice: **fixing in-branch beats threading a 30-second fix back and forth**. The author still reviews the new commits, the merge is faster, and the team learns the fix pattern by reading the commit message.

---

## 3. CI Comment System as a Communication Surface

A subtle communication artifact this week was wiring the CI reporting system to post formatted comments on every MR. Before this week, the team would glance at the green/red checkmark on the pipeline view and move on. Mutation testing in particular was running but invisible: the score was buried in a job log nobody read.

The new flow (MR !183, !184, !185 across this week) turns every pipeline run into an MR comment that the team actually reads:

```
| Job | Status | Detail |
|-----|--------|--------|
| api:test | 🟢 1452 passed | (collapsed) |
| api:mutation | 🟡 65% score, target 80% | survivor list expanded |
| sonar | 🟢 quality gate passed | (collapsed) |
```

Three tri-state colors (🟢 / 🟡 / 🔴), green collapsed by default, yellow and red expanded so the team sees regressions immediately. Posted by a dedicated `@sirabot` account so it does not clutter human comment threads.

The communication win is not the comment itself, it is the **shared vocabulary** the comment creates. "Did the mutation score regress?" becomes a question with a one-glance answer. "What's failing on my MR?" becomes a list ordered by severity. The team did not need a meeting to align on what we care about; the comment shape made it visible.

---

## 4. Knowledge Capture in CLAUDE.md

The mutation-testing setup was non-trivial enough that future contributors (human or AI agent) will need a pointer when something breaks. I added the relevant runbook entries to the root `CLAUDE.md` describing:

- How to interpret a yellow mutation score
- The three-slot Supabase shard model and how to debug a failed slot
- Which env vars need to be set for the CI report script to authenticate as `@sirabot`

CLAUDE.md is more than a spec for AI agents; it is the team's shared memory of *how this project actually works under the hood*. Adding to it during the sprint, rather than after, means the documentation matches the code that just shipped, not the code from three sprints ago.

---

## What Communication Looked Like as a Pattern

Five reviews, three squashed contributions, one CI comment system, and one runbook update. The unifying pattern: **every MR I touched this week left behind something the team can reuse**, whether that is a resolved discussion thread, a fixed line on the author's branch, a comment template, or a runbook entry. None of those artifacts exist for me; they exist because someone else will hit the same question later and benefit from the trail.

That is the version of "communication and knowledge sharing" I think the rubric is asking for. Not Discord posts (though those happen too), but tangible artifacts that lower the cost for the next person doing similar work.

---

## Evidence

- Reviews: [!177](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/177), [!174](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/174), [!171](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/171), [!169](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/169), [!151](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/151)
- Squashed commit contributions: my commits are listed under each MR's pre-squash history in GitLab (filter by author = absolutepraya)
- CI report system: [MR !183](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/183), [MR !184](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/184), [MR !185](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/185)
- Source: `scripts/ci-report.sh`, root `CLAUDE.md` (mutation testing + supabase-slot runbook entries)
