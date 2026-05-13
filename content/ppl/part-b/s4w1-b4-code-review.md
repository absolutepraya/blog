---
title: "[S4, W1] PPL: Two Reviews, Two Shapes: Diagnostic Unblock and Multi-Agent Depth Pass"
date: 2026-05-13
description: "Two substantive review threads this week on the same teammate's MRs. The first on !268 diagnosed an unrelated CI bug and unblocked him with a one-command fix. The second on !304 was a thorough 13-finding depth pass on an atomic merge RPC, dispatched via 6 specialized review agents in parallel and posted as one consolidated thread."
tags: ["ppl", "code-review"]
slug: "s4w1-code-review"
toc: true
---

## What I Worked On

Two substantive review threads this week, both on MRs authored by Fadhli (`@fadhliraihan`). Different shapes:

- **!268** (Sira-318 stale duplicate client cache): a diagnostic comment that unblocked his CI by explaining an environmental bug (supabase CLI version drift) that had nothing to do with his code. Short, surgical.
- **!304** (SIRA-319 atomic duplicate client merge): a 13-finding depth pass on an atomic RPC with row locks. Dispatched 6 specialized review agents in parallel, aggregated findings, posted one consolidated threaded discussion. Long, structural.

Both reviews used the same target author intentionally. Fadhli was running a multi-MR stretch on the duplicate-detection domain across two weeks (cache, then merge atomicity); reviewing both in sequence let me carry context forward instead of context-switching.

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

The point of code review isn't "find bugs in the diff." It's "help the MR get to a mergeable state." When the diff is correct but the CI is broken for an unrelated reason, the right review action is to diagnose the unrelated reason and unblock.

## MR !304: 13 Findings Through Multi-Agent Review

MR !304 (SIRA-319) replaced a non-atomic three-step merge (`reassign_invoices` then `reassign_reminder_logs` then `reassign_risk_scoring_logs` then `delete_client`) with a single PostgreSQL RPC that does all four mutations inside one transaction with `FOR UPDATE` row locks. The architectural direction was clearly right; the question was whether the implementation actually delivered the atomicity claim and held up under concurrency and error paths.

I ran six specialized review agents in parallel against the diff, each with a focused charter:

- **code review**: general bugs, CLAUDE.md compliance, concurrency hazards
- **test coverage**: did the new tests actually verify the atomicity claim
- **silent failure hunt**: error paths, exception propagation, swallowed errors
- **type design**: argument-order safety, primitive obsession on UUIDs
- **comment analysis**: comment accuracy and rotting documentation
- **simplify**: simplification opportunities preserving full functionality

I then aggregated, deduplicated cross-agent findings (e.g. the deadlock risk was flagged by both code and silent-failure agents from different angles), and posted one consolidated review thread on the MR with positives section first, then P0/P1/P2/P3 severity grouping. Every finding had a code-snippet fix attached.

The thirteen findings broke down as:

- **P0 (3)**: deadlock risk on concurrent merges from non-deterministic lock order, PL/pgSQL `raise exception` messages downgraded to generic 500 because the router only catches `ValueError`, zero integration tests for the atomic RPC behavior despite atomicity being the whole point.
- **P1 (4)**: same-type `str` arg swap risk on `merge_duplicate_clients(discard, keep)`, TOCTOU between active-pair check and RPC call, post-merge `get_client` failure masking a successful merge as 500, tests patching a private method which couples them to implementation.
- **P2 (4)**: `is_dismissed_pair` should query by `pair_id` PK instead of two filter columns, redundant `_encryption_key` field, SIRA ticket prefix violating the "don't reference current task" rule, missing audit logs on refusals.
- **P3 (2)**: redundant `drop function if exists`, `threshold=80` magic number.

The P0 about lock ordering is the highest-impact finding. The original SQL locked `keep` then `discard`, which deadlocks if two admins concurrently merge the same pair from opposite directions (admin A: keep=X discard=Y; admin B: keep=Y discard=X). Postgres aborts one with `deadlock detected` which surfaces as a 500. The fix is to always lock in deterministic id order:

```sql
perform 1 from clients
where id in (p_keep_client_id, p_discard_client_id)
order by id
for update;
```

The P0 about exception downgrade is structural too. The PL/pgSQL function carefully writes useful messages (`Cannot merge a client into itself`, `Keep client not found`), but `db.rpc().execute()` raises `postgrest.exceptions.APIError`, not `ValueError`. The router only catches `ValueError`, so every PL/pgSQL guard becomes a generic 500. The Python wrapper needs to catch `APIError` and translate predictable messages back to `ValueError` so the router can map them cleanly.

## Why Multi-Agent Beats Solo Reviewing

A single human reviewer reading MR !304 would have caught maybe half of those thirteen findings on a careful pass. Different agents specialize on different failure modes that a generalist eye routinely misses:

- The silent-failure agent caught the `APIError` to `ValueError` translation gap because that's exactly what it's tuned to find. A general reviewer who's never been bitten by `postgrest.exceptions` would miss it.
- The type-design agent caught the same-type `str` arg swap risk because that's a pure type-shape concern, not a logic bug.
- The test-coverage agent caught the "zero integration test for atomicity" gap because it's grading the test suite against the project's stated philosophy, not just reading the new test names.
- The simplify agent caught the `is_dismissed_pair(client_a_id, client_b_id)` redundancy because it traced data flow back to the call site where `pair_id` is already available.

Running them in parallel kept review wall-time short. The cross-agent dedup step is where most of the human work lived: deciding which of two slightly different framings of the same finding to keep, and merging overlapping suggestions.

## What I Learned

Two patterns from this week's reviews:

**Two reviews of different shapes serve different purposes.** !268 was a 5-minute review that saved Fadhli an hour of debugging. !304 was a 90-minute review that potentially saved the team from a production deadlock on concurrent admin actions. Neither shape would have substituted for the other.

**Multi-agent review scales depth, not shallowness.** Dispatching six specialized agents in parallel gave me depth comparable to a 3-hour senior reviewer pass without that wall-clock cost. The bottleneck became aggregation and dedup, not finding the issues. For high-stakes MRs (anything that touches concurrency, atomicity, or destructive operations), this is the workflow I'll keep using.

## Evidence

- [MR !268 Fix stale duplicate client cache](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/268): diagnostic review comment on supabase CLI version drift, posted as discussion thread
- [MR !304 SIRA-319 Fix invalid and non-atomic duplicate client merge](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/304): 13-finding consolidated review (3 P0, 4 P1, 4 P2, 2 P3), posted as threaded discussion
- Direct commit `a4f0c61e` on main: `fix(ci): pin supabase CLI version to prevent postgres image tag drift` (the fix cited in the !268 review)
- Pipeline 16318 (verification cited in the !268 review)
- Six review agents dispatched in parallel for !304: code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, comment-analyzer, code-simplifier
