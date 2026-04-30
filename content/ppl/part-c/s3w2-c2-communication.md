---
title: "PPL: Reviews, In-Branch Fixes, and Convention Documentation [Sprint 3, Week 2]"
date: 2026-04-29
description: "Six substantive reviews with 83 total findings posted as threaded discussions, 12 commits pushed onto a teammate's branch to land their MR, and 47 lines of CLAUDE.md conventions written down so the next AI-assisted UI commit follows them automatically."
tags: ["ppl", "communication", "code-review"]
slug: "s3w2-communication"
toc: true
---

## What I Worked On

Three communication threads this week. First, six substantive code reviews on teammate MRs with 83 priority findings posted as threaded discussions. Second, 12 commits pushed directly onto a teammate's branch (!215, boneyard skeletons) to land their MR by fixing issues during review instead of bouncing them back. Third, 47 lines of new conventions written into `apps/web/CLAUDE.md` across five commits, deliberately structured so future AI agents working on this repo inherit the standards automatically.

## Six Reviews, 83 Findings, All Threaded

Code reviews this week ranged from small (1 P0 caught) to extensive (45 findings on one MR). The full breakdown:

| MR | Author | P0 | P1 | P2 | P3 | Notable |
|----|--------|---:|---:|---:|---:|---------|
| !213 AR analytics | @dafandikri | 9 | 19 | 13 | 4 | Unbounded queries, full-table FE fetches, swallowed errors |
| !216 Nielsen UI | @dafandikri | 6 | 12 | 7 | 4 | Committed `test_db.py`, lowered coverage threshold |
| !220 Auto PDF | @soydoradesu | 2 | several | — | — | JWT TTL bug found via Playwright run |
| !218 PDF Service | @soydoradesu | 2 | several | — | — | Public PDF leaking NPWP/PII |
| !217 Sentry monitoring | @dafandikri | — | 3 | — | — | Dead profiles_sample_rate, capture_message flooding |
| !203 Payment Proof | @fadhlurohmandzaki | 1 | 2 | — | — | RLS advisory under service-role uploads |

Total: **19 P0, 36 P1, 20 P2, 8 P3 = 83 findings across 6 MRs**, every one of them posted as a GitLab **discussion thread** (not a plain comment). The thread-vs-comment choice matters because threads stay anchored to the relevant code path and require explicit resolution. Every P0 either got a fix commit from the author or an explanation of why my read was wrong. None went silent.

Two reviews stand out for the *method* used:

**!220, Playwright + JWT decoding.** I drove the auto-PDF flow end-to-end with Playwright on local Supabase, then decoded the persisted `pdf_url` JWT to confirm the `iat`/`exp` were exactly 3600 seconds apart. Reading the source would never have surfaced that bug because the source is correct (it asks for a 1-hour signed URL and gets one); the bug is the mismatch between the URL TTL and the row lifetime. Treating the URL as an artifact to inspect, not just a string to read, is what found it.

**!213, scale-stress thinking.** The dashboard MR was 45 findings. Most of them shared a pattern: queries that work on 50 rows of test data and silently break at 5,000 rows of production data. PostgREST's default 1000-row cap was the unifying culprit. I wrote that takeaway up at the bottom of the review so the reviewer (and the author) walk away with a transferable mental model: "every dashboard MR needs a 1000x stress test, not just a happy-path test".

## In-Branch Fixes on MR !215 (Boneyard Skeletons)

MR !215 by @hl had 11 review threads and a long iteration tail. Most reviewers would post the threads and wait. Where the fix was clear and small (under 30 lines, isolated to one file), I pushed it directly onto hl's branch with an explanatory commit message instead. By the merge, I had **contributed 12 commits to !215**:

```
bc62cbee fix(web): address sonar issues in boneyard
0cf2cc76 fix(ci): harden supabase slot orphan reaping
4340287f fix(web): localize boneyard typing workaround
b9aec76f fix(db): sync missing remote migrations
... 8 more
```

Two of these are worth calling out because they involved security or correctness judgement:

**`1b7a29db`, auth fallback fail-closed.** The DEV capture auth fallback was failing *open* on unauthorized or invalid tokens. I rewrote it to fail *closed* (deny on any error) and explained the security implication in the commit message. Failing open meant a misbehaving production deploy could surface the dev capture to real users.

**`70fcc797`, localized typing workaround.** hl's original fix added a global module override for `boneyard-js`. That override would affect every TypeScript file in the project. I narrowed the workaround to `src/bones/registry.ts` and added `tests/types/boneyard-js.test.ts` to guard the public API types. Same blast radius as a one-line fix, but contained.

hl's reply on the MR called out both fixes as good catches. The communication win here is **picking the right channel for the size of the fix**. A 30-second fix bouncing back as a review thread costs hours of calendar time. Pushing it directly with an explanation costs nobody any time and keeps the merge moving.

## CLAUDE.md as a Team Surface

The UIUX polish work in MR !228 spanned about 30 components and produced visible UI improvements. The less-visible artifact, the one I think mattered more for the team, was 47 new lines of conventions written into `apps/web/CLAUDE.md` across five commits:

| Commit | Lines | Topic |
|--------|------:|-------|
| `a5153c32` | +8 | Loading states (page-skeleton vs RingSpinner vs Skeleton) |
| `3af21df9` | +21 | Tables, empty/error primitives, fonts (mono vs sans), animations, risk badge |
| `2149df68` | +4 | Skeleton-fidelity rule + 3 FE pitfalls |
| `62175a17` | +13 | DataTable toolbar redesign conventions |
| `a78c6599` | +1 | Risk badge MEDIUM border requirement |

Each entry exists because a decision came up during the polish that would otherwise need to be re-litigated by the next person. Writing it down is a one-time cost that compounds: every future developer reading CLAUDE.md gets the answer without asking, and (subtler) every future AI agent opening this repo reads `AGENTS.md` (symlinked to `CLAUDE.md`) and inherits the conventions before generating code.

The font-mono rule is a clean example. It is easy to overuse `font-mono` for "looks like data", which would creep monospace fonts into headings and summary numbers where they make the UI feel like a terminal. The convention "mono is for codes/data inside tables, never for emphasis" prevents that drift. Three lines, but they stop a recurring micro-debate that was happening on every UI MR.

## What Communication Looked Like as a Pattern

Six reviews, 12 in-branch commits on someone else's MR, 47 lines of conventions documented. The unifying thread is **leaving artifacts that the team can reuse**. A resolved review thread, a fixed line on someone's branch, a written convention, a shared mental model. None of those exist for me; they exist because the next person doing similar work will benefit from the trail.

That is the version of "communication and knowledge sharing" that I think actually moves a team forward. Discord posts and standup updates are the loud version; this is the durable version.

## Evidence

- Reviews (6 substantive): [!213](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/213), [!216](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/216), [!220](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/220), [!218](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/218), [!217](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/217), [!203](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/203)
- In-branch contributions on [!215](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/215): 12 commits, including `1b7a29db` (auth fail-closed) and `70fcc797` (localized typing workaround)
- CLAUDE.md docs commits: `a5153c32`, `3af21df9`, `2149df68`, `62175a17`, `a78c6599` (47 lines total)
- Source: `apps/web/CLAUDE.md`, `apps/web/AGENTS.md` (symlinked)
