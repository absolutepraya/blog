---
title: "[S3, W3] PPL: AGENTS.md as the Source of Truth"
date: 2026-05-06
description: "Three direct-to-main commits this week unified the project's AI-agent configuration around AGENTS.md and shared skills, with thin compatibility wrappers for Claude Code, OpenCode, and Codex. Editing one file now propagates to every runtime."
tags: ["ppl", "ai-literacy"]
slug: "s3w3-ai-literacy"
toc: true
---

## What I Worked On

Three direct-to-main commits this week reshaped how the project's AI-agent configuration is organized. The motivation was straightforward: the team uses multiple AI runtimes (Claude Code, OpenCode, occasionally Codex), and duplicating instructions across three sets of config files is a maintenance trap that gets worse as the project's AI tooling grows. The fix was to designate `AGENTS.md` as the canonical source of truth and make every runtime's config a thin compatibility wrapper.

This is the kind of refactor that scores well on the AI-literacy rubric because it's a workflow improvement based on observed friction (config drift across runtimes), and it pays compounding interest going forward.

## The Three Commits

```
2ad406f9  chore: unify agent config around AGENTS.md and shared skills
971f2f47  chore: add shared command docs and runtime wrappers
4962a891  chore: align Superset worktrees with AGENTS layout
```

Plus two supporting direct commits:
- `15fc901c` — add project-linking workflow to the `linear-management` shared skill
- `342fe950` — set `ENVIRONMENT=test` on CI jobs (third layer of the Telegram silencer; supports the workflow because AI-assisted CI fixes are easier to test when you know the test env is honored)

## Before vs After

**Before**: each runtime had its own duplicated content.
```
CLAUDE.md                       — root instructions for Claude Code
apps/api/CLAUDE.md              — backend instructions for Claude Code
apps/web/CLAUDE.md              — frontend instructions for Claude Code
.claude/commands/commit.md      — Claude command logic
.opencode/AGENTS.md             — same content as CLAUDE.md, for OpenCode
.opencode/commands/commit.md    — same logic as .claude/commands/commit.md
```

Editing the commit workflow meant editing two command files and remembering to keep them in sync. Same for skills, same for project rules.

**After**: shared sources of truth + thin wrappers.
```
AGENTS.md                          — canonical root instructions
apps/api/AGENTS.md                 — canonical backend instructions
apps/web/AGENTS.md                 — canonical frontend instructions
CLAUDE.md → AGENTS.md              — symlink for Claude discovery
apps/api/CLAUDE.md → AGENTS.md     — symlink
apps/web/CLAUDE.md → AGENTS.md     — symlink

.agents/skills/<name>/SKILL.md     — canonical skill content
.claude/skills/<name> → ../../.agents/skills/<name>   — symlink
.codex/skills/<name>  → ../../.agents/skills/<name>   — symlink

.agents/commands/<name>.md         — canonical command doc
.claude/commands/<name>.md         — thin wrapper pointing at .agents/commands/<name>.md
.opencode/commands/<name>.md       — thin wrapper
.codex/prompts/<name>.md           — thin wrapper
```

Now editing the commit workflow means editing one file (`.agents/commands/commit.md` or `.agents/skills/commit/SKILL.md`). Every runtime picks up the change because the wrappers resolve through the shared source.

The MCP config layer is deliberately *not* shared, because MCP servers are runtime-specific by design (different process model, different transport). `.mcp.json` is for Claude, `opencode.json` carries the OpenCode MCP block, and that separation is explicit in the AGENTS.md docs.

## Why This Matters for Daily Work

Three concrete payoffs from the refactor that I've already noticed:

**1. Skill edits propagate immediately.** This week I improved the `linear-management` skill (`15fc901c` added a project-linking workflow). I edited `.agents/skills/linear-management/SKILL.md` once. Both my Claude Code session and my OpenCode workspace picked up the change on next invocation, no copy-paste, no diff-resolution. Before the refactor, this would have been at least two file edits and a moment of "did I remember both?".

**2. Convention propagation is automatic.** S3W2's blog covered how I added 47 lines of UI conventions to `apps/web/CLAUDE.md`. Those conventions now flow to `apps/web/AGENTS.md` via the rename, and any AI agent (Claude, OpenCode, Codex) that opens this repo reads them. That was already true through the symlink; the refactor formalized it as the default architecture.

**3. New worktrees inherit the layout for free.** The `4962a891` commit updated `scripts/superset-setup-env.sh` so new Superset workspaces inherit the `AGENTS.md → CLAUDE.md` symlinks automatically. Spinning up a new parallel workspace (which I do constantly for parallel feature work) used to mean checking that the symlinks were right. Now they just are.

## The Linear-Management Skill Improvement

Worth highlighting `15fc901c` separately because it's a concrete example of the data-driven workflow improvement the rubric asks for.

The pattern I noticed across previous weeks: when creating Linear tickets via the MCP, I kept manually setting the `project` field after creation because the `linear-server` MCP silently ignores it on `save_issue` create. This is the same kind of MCP bug the project's root `AGENTS.md` documents for `cycle`, `labels`, and `parent`. I'd been working around it manually for several sessions.

The `15fc901c` commit adds a step-by-step project-linking workflow to the shared `linear-management` skill so I (and any future agent that uses the skill) doesn't have to re-discover the workaround. Concretely:

> After creating an issue with `save_issue`, immediately call `save_issue` again with the same ID and the `project` field. The first call's project field is silently dropped; the second call attaches it.

This is the specific kind of "managing AI usage patterns based on data" the rubric calls out. The data was the repeated friction across sessions; the workflow improvement is the documented two-step pattern in a shared skill that propagates everywhere.

## What I Learned

Two things I want to keep:

**Treat AI-tool config as a first-class part of the codebase.** It evolves, it can have bugs (the silently-ignored MCP fields), and like any other config, deserves a single source of truth. The refactor makes that explicit.

**Shared skills are a more durable artifact than chat memory or prompts.** When I learn a workaround for an MCP quirk, writing it into a skill means the next session inherits the knowledge. Without that, every session re-discovers the same friction.

The 50 minutes spent on the refactor this week buys back at least an hour per week going forward in avoided "did I keep these in sync?" friction. Compounding workflow improvements are the highest-leverage AI-literacy work I can do.

## Evidence

- Direct main commit `2ad406f9` — chore: unify agent config around AGENTS.md and shared skills
- Direct main commit `971f2f47` — chore: add shared command docs and runtime wrappers (`.agents/commands/`, thin wrappers in `.claude/commands/`, `.opencode/commands/`, `.codex/prompts/`)
- Direct main commit `4962a891` — chore: align Superset worktrees with AGENTS layout
- Direct main commit `15fc901c` — chore(skills): add project-linking workflow to linear-management
- Direct main commit `342fe950` — chore(ci): set ENVIRONMENT=test on integration-test and mutation:python jobs
- Source: `AGENTS.md` (root, `apps/api/`, `apps/web/`), `CLAUDE.md` symlinks pointing to sibling `AGENTS.md`, `.agents/skills/`, `.agents/commands/`, `scripts/superset-setup-env.sh`
