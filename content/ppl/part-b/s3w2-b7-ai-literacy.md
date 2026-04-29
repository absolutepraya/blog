---
title: "PPL: AI Velocity Held Under TDD and a Hardened Hook [Sprint 3, Week 2]"
date: 2026-04-29
description: "Eight MRs shipped in seven days with AI assistance, but the red-green discipline stayed intact and a hardened pre-push hook caught the failure modes that AI-generated diffs are most likely to introduce."
tags: ["ppl", "ai-literacy"]
slug: "s3w2-ai-literacy"
toc: true
---

## What I Worked On

Eight authored MRs in the seven-day window. That cadence is only possible with AI assistance. The literacy question this week was not "should I use AI" (obviously yes) but "what disciplines do I keep, and what guardrails do I add, so AI-assisted code does not regress quality?". Two answers I can ground concretely: TDD discipline survived AI assistance on the Telegram feature, and the pre-push hook (MR !223) was deliberately structured to catch the failure modes AI-generated diffs are most likely to ship.

## TDD as the Anchor for AI-Assisted Implementation

The Telegram feature work this week (!221, !238, !243, !234) was substantially AI-assisted. Without the red-first discipline, AI generation tends to produce plausible-looking code that does not exactly match the contract you had in your head. The drift is subtle: function signatures slightly off, edge cases not handled, error returns that do not match what the caller expects.

Writing the failing test first changes that dynamic. The test fixes the contract before generation. The AI's job becomes "make these specific tests pass" rather than "implement this thing". Two examples from this week.

**The Telegram test-mode guard (!234).** I wrote the failing test first:

```python
def test_telegram_connection_test_skipped_when_environment_is_test(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    service = TelegramService()
    result = service.test_connection()
    assert result["skipped"] is True
    assert result["reason"] == "test environment"
```

The exact return shape (`{"skipped": True, "reason": ...}`) was decided here, not by the AI. When the AI generated the implementation, it had to satisfy that shape. The pre-squash commit pair (`b2b06fdb` for red, `47941303` for green) records this exact ordering.

**The dispatcher short-circuit pattern.** Last week's blog covered how the failing test forced the dispatcher to check the toggle *before* constructing the message. The contract was named in the test. The AI-generated implementation followed. If I had asked for the dispatcher first, I think the AI would have nested the toggle check inside `try:` along with everything else, which would have leaked toggle errors into the failure path.

The literacy point: **TDD is even more useful with AI assistance, not less**. The AI accelerates the green phase but cannot replace the red phase. The red phase is where the design happens; that has to come from the human.

## What AI-Generated Diffs Tend to Miss

When I switched to a high-cadence AI-assisted workflow, a pattern emerged in the kinds of CI failures that started happening more often. They were not new failure modes; they were old failure modes that became more frequent because AI tends to skip the boring parts of a change.

| Failure mode | Why AI tends to miss it |
|---|---|
| Lockfile drift | AI updates `package.json` or `pyproject.toml` but forgets to run `pnpm install` / `uv sync`, so the lockfile stays stale. |
| Knip dead code | AI moves or renames an export and leaves the old declaration orphaned. |
| Vite build (Rollup-only) errors | AI writes valid TypeScript that Rollup cannot tree-shake due to dynamic imports. `tsc --noEmit` passes but `vite build` fails. |
| Branch naming | AI suggests `fix/auth-bug` instead of `daffa/fix/SIRA-XXX-auth-bug`. |

Each of these wastes 5 minutes of CI on a "did not commit the lockfile" or similar trivial mistake. Once I noticed the pattern, I added all four to the pre-push hook (MR !223). The literacy decision behind the hook is treating it as **a defensive layer specifically calibrated for AI-assisted workflows**:

```bash
# 4. Frontend Vite build (catches Rollup errors tsc misses)
pnpm --dir apps/web build

# 5. Lockfile freshness via frozen install
pnpm install --frozen-lockfile --prefer-offline > /dev/null
(cd apps/api && uv sync --frozen > /dev/null)
```

The lockfile check has been the most-fired since I added it. Roughly one push out of three has had a lockfile drift, and the hook catches it before CI.

## Conventions in CLAUDE.md as a Steering Mechanism for AI

A subtler but important AI-literacy choice this week was treating `apps/web/CLAUDE.md` as a primary surface for steering AI behavior, not just a human-facing doc. Across MR !228 (UIUX polish) I added 47 lines of conventions covering loading states, skeleton fidelity, table primitives, fonts, animations, and risk badge styling. Five separate commits, each documenting one decision so the next person (or agent) does not re-litigate it.

The AI angle is concrete: `apps/web/AGENTS.md` is symlinked to `apps/web/CLAUDE.md`. So a Claude Code session and an OpenCode session both read the same file when they open the repo. A new convention I write down on Monday becomes part of every AI-generated UI commit on Tuesday, without me needing to repeat it in every prompt. Once you internalize this, it changes what you do when you finish a feature: the polish itself ships, but the *convention behind the polish* gets written down so the next AI-generated diff inherits the standard.

The skeleton-fidelity rule (`2149df68`) is a clean example. Without the rule in CLAUDE.md, an AI asked to "add a skeleton for this new page" would generate a generic template with placeholder columns. With the rule:

> Read the real page's JSX first. Match column count, header buttons, filter rows, and breakpoints exactly — generic templates produce visibly wrong skeletons.

The AI now reads the actual page first and matches exactly. The behavior shift is dramatic, and it costs me four lines of docs once. That is the kind of compounding leverage that distinguishes "AI-assisted development" from "AI-steered development".

## Parallel Agent Workflow on the Pre-Push Hook Itself

The pre-push hook (MR !223) is itself an artifact of AI-assisted work. I was running two agents in parallel on Superset worktrees: one finishing the Telegram feature on `abhip/telegram`, one drafting the hook on a separate branch. Each agent had its own working tree, its own redis/supabase ports, and its own context. Neither blocked the other.

The literacy lesson here is workflow-level, not code-level. Parallel-agent work only makes sense when you have isolation infrastructure (Superset worktrees, port allocation, separate CI slots). Without isolation, two agents stomp on each other's database, cache, or build artifacts. With isolation, the cadence multiplies cleanly: one agent per feature, the human reviewer (me) merging when each branch is green.

This week was the first sustained week running this pattern, and the 8-MR cadence is the result. It does not work for every kind of work. Reviews are still serial because they are humans-in-the-loop with context I cannot easily share with another agent. Architecture decisions are still serial. But for "implement this small feature, with tests, behind a flag", parallel agents on isolated worktrees is a real productivity multiplier.

## What I Learned

Two things that I think generalize.

**TDD is not optional in AI-assisted workflows.** It is the cheapest mechanism for keeping the AI's generation aligned with the actual contract. The red commit is the contract; the green commit is the implementation. Both are visible in git. If a teammate later questions why something works the way it does, the test answers the question.

**Build a hook calibrated for the failures your specific workflow produces.** Generic linting is not enough. AI-assisted work fails in specific ways (lockfile drift, dead code, build errors that pass typecheck), so the hook should explicitly catch those.

The cadence this week (8 MRs) is not the point. The point is that the cadence did not break the discipline. Every MR has tests, every MR went through review, every red commit precedes a green commit. AI accelerates the implementation, but the discipline is what keeps the work merge-able.

## Evidence

- [MR !221 SIRA-161 Telegram Phase 1 & 2](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/221), [MR !238 delivery logs](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/238), [MR !243 digest priorities](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/243), [MR !234 test guard](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/234) — all AI-assisted, all under red/green TDD pairs
- [MR !223 chore(hooks): harden pre-push](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/223) — squash `1decb91d`, calibrated specifically for AI-assisted workflow failure modes
- [MR !228 SIRA-302 UIUX polish](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/228) — 47 lines added to `apps/web/CLAUDE.md` across 5 commits (`a5153c32`, `3af21df9`, `2149df68`, `62175a17`, `a78c6599`) steering future AI-generated UI work
- `apps/web/AGENTS.md` symlinked to `apps/web/CLAUDE.md` so Claude Code and OpenCode read the same conventions
- Pre-squash red/green commit pairs: `39e8f659`/`bfb74c13`, `0db6fc68`/`243c4193`, `946da839`/`b8be1b69`, `b2b06fdb`/`47941303`, `6bd1d046`/`86359687`, `85b9f2d3`/`0e71c85b`, `645dcd84`/`b8c1a0e2`
- Source: `.husky/pre-push` (defensive layer), `scripts/superset-setup-env.sh` (parallel-agent isolation infra)
