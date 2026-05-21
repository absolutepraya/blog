---
title: "[S4, W2] PPL: Agents as Teammates and Skills as Designers"
date: 2026-05-20
description: "Two concrete AI workflow moments this week. yanto autonomously merged MR !316 after running a four-point verification checklist, then learned the project's squash-only convention from a single Discord message and saved it to memory. Plus the ui-ux-pro-max skill drove the design system choices for the Permission Request UI without me writing a Figma spec."
tags: ["ppl", "ai-literacy"]
slug: "s4w2-ai-literacy"
toc: true
---

## What I Worked On

Last week's b7 was about embedding an LLM (Gemini Flash) into a product feature. This week's is about two different shapes of AI workflow: **an agent autonomously executing a workflow task with explicit verification checklists**, and **a skill driving design system decisions without a separate design phase**.

Both are still LLM-backed, but the unit of AI work isn't a single API call this time. It's an agent performing several actions in sequence with stable identity and persistent memory.

## yanto Autonomously Merging MR !316

The first moment is the autonomous merge of MR !316 (Fernanda's 7 HTTP security headers implementation) on 2026-05-20 evening. The Discord exchange in `#dev`:

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

merge result:
1. MR !316 sekarang status merged
2. merge commit: 0622841c738c548b25e48de4648ef40aab7085b6
3. squash commit: 737a715ee527d9eba357b34ac4efbdda9553d1b9

sempet kena 422 dulu, ternyata project ini wajib squash pas merge.
terus gua merge ulang pake squash=true, sukses
```

The interesting parts:

**The verification checklist was the agent's, not mine.** Yanto runs through the same four checks I would: is the MR mergeable, did the pipeline pass, are discussions resolved, was reviewer feedback actually addressed in the head MR. That last check is the one most likely to be skipped by a hasty human merger (just look at the resolved status without verifying the commits actually do what the reviewer asked). Yanto did it.

**The 422 retry is interesting because it's the agent learning from a real GitLab API response.** First attempt was a plain merge call. GitLab returned 422 with a message saying "this project requires squash on merge." Yanto's response: parse the error, set `squash=true`, retry. That's a single iteration of an autonomous loop where the failure path is part of the workflow.

**The follow-up was teaching the agent a project convention.** After the merge succeeded:

```
[16:59] praya: save ke memory lu bro, tiap merge selalu squash
jadi next kali buat SIRA, default merge pake squash enabled ya bro

[17:00] yanto: sip, udah gua simpen
```

The squash-only rule existed in `CLAUDE.md` already, but yanto had to discover it by trying and failing. Now it's in yanto's memory. Next time yanto handles a SIRA merge, the squash flag is set from the first call. The cost of the training was 20 seconds of typing. The benefit is that every future SIRA merge yanto handles skips the 422 retry.

And the pattern did carry over. The next morning, yanto handled an unrelated MR (!324, the CSP hotfix), and ran the same verification checklist on the first try with squash already set:

![Discord screenshot of dip pinging maintainers about MR !324, praya replying "merge @yanto", and yanto's response: a verbose status report saying "udah gua set auto merge buat MR 324 dengan squash", listing the 3-point status (mergeable, no conflict, no unresolved discussion, pipeline still running), explaining merge_when_pipeline_succeeds=true is set so it will merge automatically when CI passes. Yanto also notes hitting a 405 from the standard glab path and falling back to hitting the GitLab API directly with squash=true, which succeeded.](/images/ppl/s4w2-yanto-merge-mr324.png)

The new failure mode this time was a 405 from the standard merge path (not a 422 like the previous day), and yanto handled it by falling back to a direct API call with squash already in the payload. The previous day's training (squash=true as default for SIRA merges) meant the agent didn't have to rediscover the convention; it carried into the new failure handling path.

This is the pattern I want to internalize: when an agent (or a new teammate, same principle) discovers an unwritten project rule by tripping over it, the right immediate move is to write that rule somewhere durable. For a human teammate, "durable" means a CONTRIBUTING file. For yanto, it means asking the agent to save it to memory. Either way, the next person doesn't trip on the same edge.

## ui-ux-pro-max as Design Infrastructure

The second moment is in the FE design for MR !308 (Permission Request UI). The MR description records:

> Followed the `ui-ux-pro-max` recommendation pass (productivity / internal dashboard SaaS, Plus Jakarta Sans, flat design, 150-300ms transitions). Matched the existing app's visual language, same Tailwind palette, same shadcn primitives, same status-badge conventions, same TableEmptyState / LoadFailureState shells. No new dependencies.

`ui-ux-pro-max` is a skill I have installed. The shape of the interaction: I tell the skill "I'm building an internal admin queue page for a permission request approval system in a productivity SaaS context" and it returns concrete recommendations:

- **Typography**: Plus Jakarta Sans (already in the project, picked because it has a wide x-height for tabular admin data)
- **Style family**: flat design (no gradients, no soft shadows; matches the rest of the app)
- **Transition timing**: 150-300ms range (enough motion to signal state changes without feeling laggy on admin actions like approve-deny)
- **Status badge convention**: amber/emerald/red mapping to PENDING/APPROVED/DENIED (matches the existing `StatusBadge` convention in the app, so a new user doesn't have to learn a new color vocabulary)
- **Empty state pattern**: shared `TableEmptyState` and `LoadFailureState` components (already used elsewhere; reuse keeps the visual rhythm consistent)

The pattern is the same as asking a senior designer for a brief consultation, except the brief is in markdown, the response is structured, and the cost is one API call. For internal tools that don't have a design budget, this is the difference between "the FE looks like it was hacked together" and "the FE matches the rest of the app's polish."

The skill doesn't replace human design judgment for novel surfaces (a customer-facing landing page would need actual designer input). For internal CRUD that follows project conventions, the skill gives recommendations that are at least as good as I would have come up with on my own, faster, and reproducible by the next FE engineer who wants to add a similar page.

## Why This Matters: Stateful Identity vs Stateless Query

The thing that distinguishes both stories from the S4W1 Gemini-in-mr-bot work: in S4W1, the LLM was a stateless query. Each `generate_content()` call was independent; the model had no memory of previous interactions. In S4W2, both yanto and the ui-ux-pro-max skill have stable identity and persistent memory across sessions.

- **yanto** is a Hermes agent persona running as a systemd service on the VPS. Its persona is in `SOUL.md`, its memories are in `memories/USER.md` and `memories/MEMORY.md`. Talking to yanto on Tuesday and again on Friday addresses the same agent. The squash-merge memory I saved on Tuesday persists for Friday's interaction.
- **ui-ux-pro-max** is a skill in my Claude Code installation. It loads on demand when I invoke it. The recommendations it makes are deterministic for the same brief; reproducible by any teammate who has the skill installed.

The implication is that AI workflows can compound. The first time I asked yanto to merge a SIRA MR, I had to teach it the squash convention. The next time, that's free. Build up enough conventions in agent memory and the agent becomes a competent teammate for the workflow, not just a one-shot generator.

The same compounding applies to skills, but in a different direction: skills are durable across teammates. If Bertrand installs the same `ui-ux-pro-max` skill, his Permission Request page recommendations look like mine. The skill is shared design infrastructure, not personal tooling.

## What I Learned

**Agents need verification checklists, not just tool access.** Yanto's autonomous merge worked because it had an explicit four-point check before touching the merge API. An agent with merge tool access but no verification checklist would be dangerous; an agent with the checklist is safer than a hasty human merger, because the checklist is consistent. Build the checklist first, then give the agent the tool.

**Skill output gets better as the project's conventions get tighter.** The ui-ux-pro-max recommendations were good partly because the existing app had established conventions (Plus Jakarta Sans was already in use; the StatusBadge pattern existed; TableEmptyState was a component). The skill's job was to surface "use the things you already have" not "invent new visual language." Tighter project conventions = more useful skill output.

**Memory training is the cheapest workflow optimization there is.** Twenty seconds of Discord typing turned a recurring 422 retry into a one-time event. Any time an agent or a new teammate trips on the same rule twice, the rule needs to be written down. The cost is always lower than the recurring re-discovery.

## Evidence

- yanto autonomous merge of [MR !316 SIRA-377](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/316): Discord `#dev` 2026-05-20 16:54-17:00, squash commit `737a715e`
- Squash convention codification: Discord `#dev` 2026-05-20 16:59-17:00 ("save ke memory lu bro, tiap merge selalu squash" → "sip, udah gua simpen")
- ui-ux-pro-max recommendation pass cited in [MR !308 description](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308): "Followed the ui-ux-pro-max recommendation pass (productivity / internal dashboard SaaS, Plus Jakarta Sans, flat design, 150-300ms transitions)"
- yanto persona definition: `~/.hermes/SOUL.md` (universal voice + output rules)
- yanto user memory: `~/.hermes/memories/USER.md` (knows the owner is Abhip and which project this is)
- yanto guest memory: `~/.hermes/memories/MEMORY.md` (knows other allowed Discord users)
- Skills directory (shared across runtimes): `~/.agents/skills/` (canonical source of truth, symlinked into `~/.claude/skills/`, `~/.config/opencode/skills/`, `~/.codex/skills/`)
- ui-ux-pro-max skill location: `~/.agents/skills/ui-ux-pro-max/SKILL.md` (51 styles, 161 palettes, 57 font pairings, productivity-SaaS guidance)
