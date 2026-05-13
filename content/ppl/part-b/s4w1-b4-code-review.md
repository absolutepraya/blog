---
title: "[S4, W1] PPL: Diagnosing a CI Bug for a Teammate Through Review"
date: 2026-05-13
description: "One review this week, but it was the right one: diagnosing why @fadhliraihan's CI was failing because of an upstream supabase CLI version drift bug, pointing him at the fix I'd already pushed to main, and writing the kind of comment that unblocks instead of merely points out."
tags: ["ppl", "code-review"]
slug: "s4w1-code-review"
toc: true
---

## What I Worked On

Review output dropped this week. The mr-bot service consumed eight authored MRs and a security response consumed two more, so I only posted one substantive review thread, on MR !268 (Fadhli's stale-duplicate-client cache fix). The review itself is worth writing about because it's a different kind of review than the usual "here are 12 P1 findings." It's a diagnostic that explains why his CI was failing for a reason that had nothing to do with his code.

Honest framing: this is a thin output week for reviews specifically. The reason is visible in the b1 and b3 blogs (12 authored MRs, including building a new service end-to-end). The trade-off was deliberate, not accidental.

## MR !268: The Comment That Unblocked

Fadhli's MR was a legitimate fix for a stale-duplicate-client cache bug in the API. His CI was red for reasons that looked like his code at first glance: the integration-test job kept failing with `Error response from daemon: ... failed commit on ref` during a Docker image pull, after 16 minutes of timeout. The CI report on his MR was confusing because the bot reported the failure as a generic build error.

I'd hit the same bug on my own branch earlier in the week. The root cause was a supabase CLI version drift: `npx supabase start` was resolving npm's `latest` differently between jobs, so the runner's containerd cache had `postgres:17.6.1.106` but the new CLI wanted `17.6.1.095`. Pulling the new image hit a containerd ingest race and the job died.

I'd fixed it on main with commit `a4f0c61e` (pin the supabase CLI to v2.98.2 in `scripts/ci-supabase-slot.sh`). The fix was a one-liner. But Fadhli's branch was off an older main, so his CI was still hitting the bug.

The review comment I posted:

> hey @fadhliraihan, your ci was failing because of a supabase cli version drift bug. `npx supabase start` was resolving npm's `latest` differently between jobs, so this branch's run installed a cli that wanted `postgres:17.6.1.095` while the nashta runner only has `17.6.1.106` cached. tried to pull and hit a containerd ingest race, job died after 16 min.
>
> fixed on main with commit `a4f0c61e` (pinned the cli to v2.98.2 in `scripts/ci-supabase-slot.sh`). verified clean on pipeline 16318, integration test back to ~4.7 min with all images cached.
>
> to unblock: rebase your branch onto main and push, ci should pass cleanly. lmk if it still misbehaves.

Three things this comment does that a generic "your CI is failing" comment wouldn't:

**It names the root cause precisely.** Not "Docker is broken," not "rebase and try again," but the exact mechanism: `npx supabase start` non-deterministically resolving `latest` between jobs, the runner's containerd image cache having one tag, the new CLI wanting another, the containerd ingest race that killed the job. A reviewer who only says "rebase" leaves the author guessing whether the fix actually addresses their failure.

**It cites the fix and the verification.** Commit `a4f0c61e` is the exact line, `scripts/ci-supabase-slot.sh` is the exact file, pipeline 16318 is the proof. Fadhli can look up the diff, read the change, and decide whether he believes the fix applies to his case.

**It gives a concrete unblock action.** "Rebase your branch onto main and push, ci should pass cleanly" is one command. The reviewer who instead writes "this might be a flaky test, just retry" leaves the author in the same broken state, just with a wasted CI minute.

## Why This Counts as a Review

The point of code review isn't "find bugs in the diff." It's "help the MR get to a mergeable state." When the diff is correct but the CI is broken for an unrelated reason, the right review action is to diagnose the unrelated reason and unblock. Otherwise the author wastes hours re-running CI hoping something will randomly work.

The reverse pattern is also true: a review that finds no diff bugs but spends time helping the author land their MR is still a high-value review. I've benefited from this exact kind of review from teammates earlier in the project; passing it forward this week was deliberate.

## Cross-Reference Review on !284

The other "review" the GitLab API attributes to me this week is MR !284 (Andika's pnpm pin in web.Dockerfile). I didn't post a real thread there; the API counts a system reference because I mentioned !284 from !288 (`mentioned in merge request !288`). That's not a substantive review, and I won't claim it as one.

It is, however, worth noting that !284 fixed a related class of bug to !268: both were CI failures caused by non-deterministic version resolution in build tooling. Andika's fix pinned `pnpm@9` in `web.Dockerfile` and added `packageManager: pnpm@9.15.0` to `apps/web/package.json`. The pattern is the same: replace "latest" with a specific version so the build is reproducible.

## What I Learned

Two observations from this week's thin review output:

**A review that diagnoses an environmental bug for the author is as valuable as one that finds five P1s in the diff.** The unblock comment on !268 saved Fadhli probably an hour of "why is my CI flaky" debugging. That hour is more valuable to him than a list of style nits would have been.

**Light weeks on reviews are recoverable; broken trust isn't.** This week I leaned heavily into feature work and accepted a low review count. That's recoverable next week. What's not recoverable is posting low-quality reviews to hit a count target. The single substantive review on !268 with a real diagnosis is worth more than five drive-by approvals.

## Evidence

- [MR !268 Fix stale duplicate client cache](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/268): diagnostic review comment on supabase CLI version drift, posted as discussion thread
- Direct commit `a4f0c61e` on main: `fix(ci): pin supabase CLI version to prevent postgres image tag drift` (the fix cited in the review)
- Pipeline 16318 (verification cited in the review)
- Related fix shipped in parallel by Andika: [MR !284 SIRA-356 pin pnpm@9](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/284): same "replace latest with a specific version" pattern
