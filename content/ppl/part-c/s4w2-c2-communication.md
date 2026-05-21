---
title: "[S4, W2] PPL: Coordinating Three MRs, Four Reviews, and One Agent Teammate"
date: 2026-05-20
description: "Shipped PBI 45 end-to-end across three coordinated MRs by targeting the FE MR at the BE branch so reviewers got focused diffs. Plus delegating an MR merge to yanto with an explicit verification checklist, helping Bertrand get VPS access for monitoring work, and walking through a web-test optimization question that produced a concrete next step for the team."
tags: ["ppl", "communication"]
slug: "s4w2-communication"
toc: true
---

## What I Did This Week for the Team

Four communication-relevant moments this week, all of them about reducing team friction or making team coordination cheaper:

1. **Multi-MR PBI coordination**: three MRs shipped together for PBI 45 (Staff Permission Requests), with FE targeting BE branch so reviews stayed focused.
2. **Four reviews delivered** across teammates' MRs (Fernanda, Soy, Fadhli twice), at different depths matched to each MR's stakes.
3. **Delegating an MR merge to yanto** with explicit verification checklist, plus training yanto's memory so future merges skip the squash retry.
4. **Helping Bertrand on VPS access + walking through web-test optimization** in a 30-minute live Discord conversation that produced concrete next actions.

## Coordinated PBI Delivery: BE → FE → Security Closure

PBI 45 (Staff Permission Requests) shipped as three MRs:

```
!307  SIRA-207 BE permission request system
!308  SIRA-208 SIRA-209 FE permission request UI
!310  SIRA-374 RBAC bypass closure (security follow-up)
```

The sequencing trick I used to keep reviews focused: **MR !308 targets the !307 branch, not main**. The FE diff then shows only the new React code on top of the already-merged BE, not the BE re-stated. When !307 merged to main, GitLab automatically rebased !308 onto main with the same diff. Reviewers see a focused 700-line FE diff instead of a 1400-line combined-stack diff.

The MR !308 description explicitly notes this trick:

> Target branch is the BE branch so reviewers see only the FE diff, not the BE re-stated. Will be re-targeted to `main` once MR !307 lands.

This is communication via process structure: the team doesn't have to read a 1400-line MR and mentally separate BE from FE. The PR shape does the separation for them. I learned this pattern from working on larger codebases earlier in my career, but had not applied it in SIRA until this PBI. The cost (extra rebase coordination) is small, the benefit (review attention staying focused) compounds across reviewers.

The third MR (!310 SIRA-374) was a security follow-up: an audit pass against the new system surfaced two endpoints that AR_STAFF could still call directly, bypassing the permission flow. I flagged it, opened the fix, shipped it within 36 hours of the original PBI merging. The communication angle is that I didn't pretend the original PBI was complete; I named the gap and closed it in a separate MR that explicitly references the original.

## Reviews Delivered: Four Different Depths

The four reviews:

| MR | Author | Review depth |
|----|--------|--------------|
| !304 SIRA-319 atomic merge | Fadhli | Verified 13 findings from S4W1 review were addressed across 42 commits |
| !316 SIRA-377 HTTP security headers | Fernanda | Delegated verification to yanto with explicit 4-point checklist |
| !311 SIRA-331 risk prioritization | Soy | Light read + CI gate check |
| !269 SIRA-321 invalid value visibility | Fadhli | Light read + CI gate check |

The !304 verification was the deepest: Fadhli had pushed 42 follow-up commits between my S4W1 review and the merge this week. Verifying that each P0/P1 finding from the original review was actually fixed (not just marked-resolved) took about an hour. The b4 blog walks through the per-finding tracking; the communication angle is that "approve" without that verification would have been performative review, not real review.

For !311 and !269, the diffs were straightforward (sort algorithm fix + UI visibility tweaks) and the authors had strong track records. A light read plus CI gates was the appropriate depth; spending an hour each on small MRs would have produced no findings and delayed the team's other work.

Matching review depth to MR stakes is itself a communication skill. Bare-approving a high-stakes MR signals "I didn't think it was important enough to read." Over-reviewing a small MR signals "I'm pretending to add value to justify my time." The judgment call is the work.

## Delegating to yanto: Communication Through Agent Infrastructure

The MR !316 merge happened via yanto, the team's Discord agent. The exchange:

```
[16:54] praya: yanto merge this
[16:54] praya: bismillah

[16:57] yanto: udah gua merge

masih jalan nih, 3 min elapsed, iteration 11/60, waiting for non-streaming API response

statusnya aman juga tadi:
1. MR mergeable, no conflict, no draft
2. pipeline 16712 success
3. blocking discussions resolved
4. review minor dari qen udah ke-address di head MR
```

yanto's four-point checklist before merging is the same thing I would have manually verified. The interesting communication aspects:

**The status report is the artifact.** yanto's reply shows the team (anyone in `#dev` can read it) exactly what was checked, in what order, with what result. A human merger who just clicked "Merge" and posted "merged" would leave the team with less context. yanto's verbose status report doubles as an audit trail.

**Memory training is communication with future-yanto.** Immediately after the merge, I taught yanto the squash convention:

```
[16:59] praya: save ke memory lu bro, tiap merge selalu squash
[17:00] yanto: sip, udah gua simpen
```

The next teammate who asks yanto to merge a SIRA MR (could be Qen, Fadhli, anyone with bot access) gets the benefit. The rule lives in yanto's memory, not in my head.

**Agent as comms scale.** I cannot personally handle every team merge. Delegating to yanto with a verification checklist scales my gatekeeping role to the team without my having to be online for each merge. The c2 angle is that this turns "Abhip is the merge bottleneck" into "yanto handles merges with the same checks, Abhip steps in for high-stakes decisions."

## Helping Bertrand: VPS Access + Web Test Optimization

A 30-minute Discord conversation on 2026-05-20 with Bertrand (`@bakuwan`) covered two threads:

**VPS access for netdata monitoring.** Bertrand wanted to add per-container metrics to the netdata monitoring stack (Jaki had set up host-level metrics in MR !312). The catch: the netdata configs live on the Nashta VPS, and Bertrand didn't have shell access. The exchange:

```
[12:14] bakuwan: tutor cara konek ke vps le 🙏
[12:15] praya: okee gua bikin ya bert
[12:15] praya: gua taroh sini aja deh
[12:15] praya: ati ati klo action nya destructive ya guys
[12:15] praya: kita tidak ada os snapshot backup ni
```

The "ati ati klo action nya destructive" line is the load-bearing one. Giving someone VPS shell access is a trust transfer; the right communication wrapping that transfer is "here's the access, here's the failure mode, do not test things destructively." I followed up with a docs link and a brief overview of the netdata config layout.

**Web test optimization discussion.** Same conversation moved into a question about CI test runtime:

```
[12:27] bakuwan: gw kepikiran buat web test sekarang pengen diganti jadi ngerun
                test yg related ke changed file only, klo gitu aman gk
[12:28] praya: aman, tapi
[12:28] praya: kudu bener dli detection nya
[12:29] praya: sama ntar lu mesti update AGENTS.md nya biar relevan
[12:29] praya: jadi misal ada ranah baru, make sure detection nya keupdate juga
[12:29] praya: gua sih mikir cepetnya, kek misal tests under kategori X,
                itu dirun ketika file-file: A B C D berubah
```

The discussion landed on vitest's `--changed=main` flag (Bertrand researched the docs in parallel) and the agreement that the detection rules need to be documented in `AGENTS.md` so they stay in sync with the codebase as new directories appear.

The c2 angle: this isn't a deliverable, it's a brainstorming conversation that produced a concrete next-step for Bertrand to scope (the `--changed=main` exploration) and a coordination requirement (AGENTS.md update when the categorization changes). That kind of structured back-and-forth is most of what team communication actually looks like; it's not always announcements or reviews.

## What This Says About Communication

The thread through these four: **good team communication looks like reducing the next person's work**, whether that next person is a reviewer, a teammate trying to access infra, or a future-yanto handling a merge.

- MR sequencing reduces reviewer work (focused diffs)
- Review-depth matching reduces author work on irrelevant nitpicks
- yanto delegation + memory training reduces my work and future-yanto's work simultaneously
- The Bertrand conversation produced one explored direction and one coordination commitment, not just "go figure it out"

Each one trades some upfront effort (decide the MR structure, do the verification properly, train the agent, have the conversation) for ongoing savings across multiple people.

## What I Learned

**MR sequencing is a communication tool, not just a Git mechanic.** Targeting a child MR at a parent MR branch shrinks the reviewer's mental model by half. The team noticed the cleaner diffs on !308 versus what a combined MR would have shown. The cost (one extra rebase coordination step) was a few minutes; the benefit landed across every reviewer.

**Agent delegation works when the agent has a checklist, not just tool access.** yanto's autonomous merge was safe because of the four-point verification it ran before touching the merge API. Giving an agent merge tool access without a verification checklist would be reckless; giving it both is scaling.

**Help conversations land better when they end with a concrete action.** The Bertrand VPS+webtest thread ended with two specifics: "explore `--changed=main`" and "update AGENTS.md when categorization changes." Both are scoped enough to act on. A 30-minute conversation that ends with "let's think about it more" is worse than one that ends with "do X next, share what you find."

## Evidence

- [MR !307 SIRA-207 BE permission request system](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/307): parent MR for the PBI 45 stack
- [MR !308 SIRA-208 SIRA-209 FE permission request UI](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308): targets !307 branch initially, re-targeted to main after !307 merged
- [MR !310 SIRA-374 RBAC bypass closure](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310): security follow-up that closes the audit-surfaced gap
- Reviews delivered this week: [!304](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/304), [!316](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/316), [!311](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/311), [!269](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/269)
- yanto autonomous merge of !316 with 4-point verification: Discord `#dev` 2026-05-20 16:54-17:00
- yanto memory training (squash convention): Discord `#dev` 2026-05-20 16:59-17:00
- Bertrand VPS + web-test conversation: Discord `#dev` 2026-05-20 12:14-12:42
- yanto persona definition: `~/.hermes/SOUL.md` (on VPS), memory file: `~/.hermes/memories/USER.md`
