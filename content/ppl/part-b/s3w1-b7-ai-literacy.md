---
title: "[S3, W1] PPL: AI Tooling Strategy"
date: 2026-04-22
description: "Switching from Claude Pro to OpenCode Go for cheaper access to frontier Chinese models, then migrating my Claude-only skills, slash commands, and MCP servers into a single source of truth that both runtimes can consume."
tags: ["ppl", "ai-literacy"]
slug: "s3w1-ai-literacy"
toc: true
---

## What I Worked On

Two AI-tooling decisions this week. First, I used AI assistants to scaffold the Tiptap email editor migration and the CI troubleshooting docs in `CLAUDE.md`. Second, and more interesting from a literacy standpoint, I switched my primary coding agent from Claude Code to OpenCode and migrated my entire workflow (custom skills, slash commands, MCP servers) so both runtimes share the same single source of truth.

## Switching from Claude Pro to OpenCode Go

I had been on Claude Pro for months. Claude Opus is excellent for complex reasoning, but the per-month cost was high and the usage limits felt restrictive when running multiple agents in parallel for SIRA work (one for backend TDD, one for frontend, one for CI debugging).

I moved to **OpenCode Go**, a $10/month plan that gives high-volume access to a roster of frontier Chinese models via the OpenCode runtime: GLM-4.6 (Zhipu), Qwen3-Max (Alibaba), DeepSeek-V3.x, and Kimi K2 (Moonshot). On public coding benchmarks like SWE-bench Verified and Aider polyglot, these models sit in the same tier as Claude Opus and GPT-5 class models, sometimes ahead on raw code editing, sometimes behind on long-context reasoning. For day-to-day SIRA work — service writing, test scaffolding, refactoring — they are competitive with what I had.

The literacy lesson here is not "pick the cheap one." It is **don't anchor on a single vendor**. The frontier model list shifts every two months. Anyone who locked their workflow into one runtime in early 2025 had to re-learn their tools when better models showed up elsewhere. The right move is to build your workflow so swapping the underlying model or even the runtime is cheap.

## The Two-Runtime Problem

Claude Code and OpenCode have different config layouts:

| Asset | Claude Code | OpenCode |
|-------|------------|----------|
| Custom skills | `.claude/skills/<name>/SKILL.md` | `.opencode/skills/<name>/SKILL.md` |
| Slash commands | `.claude/commands/*.md` | `.opencode/commands/*.md` |
| Project rules | `.claude/rules/personal.md` | `.opencode/rules/personal.md` |
| MCP servers | `.mcp.json` (project-scope) or `~/.claude.json` | `~/.config/opencode/opencode.json` or `opencode.json` (project) |

Naively duplicating each file would mean editing two copies every time I tweak a skill. That is a maintenance trap.

## The Migration: Symlinks, Not Copies

The fix was simple but worth thinking through. Instead of duplicating, I made `.opencode/` point at the existing `.claude/` directories via relative symlinks:

```bash
.opencode/commands -> ../.claude/commands
.opencode/rules    -> ../.claude/rules
.opencode/skills   -> ../.claude/skills
```

This was committed in `ba0939b0` (`chore: sync OpenCode with Claude Code skills/rules and add SonarQube MCP`). The diff is tiny on purpose:

```
.opencode/rules  | 1 +
.opencode/skills | 1 +
.mcp.json        | 19 +++++++++++++++++++
opencode.json    | 8 ++++++++
```

Two new symlinks (commands was already symlinked from an earlier commit `88daa04c`), one shared `.mcp.json` for project-scope MCP servers, and one `opencode.json` that re-declares the same MCP servers in OpenCode's config format because OpenCode does not yet read `.mcp.json` natively.

Single source of truth for the assets that change often (skills, commands, rules), explicit duplication only for the one boundary that the two runtimes do not share (MCP config). That is the right tradeoff: I edit a skill once and both agents pick it up; I add a new MCP server in two places, but MCP servers change rarely.

## Why This Matters for SIRA Work

The migration paid off the first time I needed to invoke our `/pr-review-toolkit` slash command from OpenCode to review a teammate's MR. The command file lives in `.claude/commands/pr-review-toolkit/` (originally Claude-only). After the symlink, OpenCode auto-discovered it and ran the same six review agents (code, tests, errors, types, comments, simplify) against the diff. Zero config drift, zero "which version of the command is current" confusion.

The same applies to skills. The `superpowers:using-superpowers` skill that gates my response flow is defined once and binds to whichever runtime is open. If I add a new skill tomorrow for, say, drafting Linear ticket descriptions, both runtimes will have it the moment I commit.

## AI for the Tiptap Migration

On the actual SIRA feature work this week, I used AI to scaffold the Tiptap migration in MR !200. The Tiptap ecosystem is large (core editor, StarterKit, slash commands via `@tiptap/suggestion`, custom nodes, React integration), and writing the full scaffold from docs would have taken half a day. The AI produced a working first draft in one shot. Two issues surfaced during human review:

1. **Race condition on tone switch.** The AI used `editor.commands.setContent()` to update the editor when the selected template changed. This caused cursor jumps because `setContent` runs asynchronously while React re-renders. The fix was a `key={selectedTemplate.id}` prop forcing a full remount on switch:

   ```tsx
   <RichEditor
     key={selectedTemplate.id}
     value={template.body_html}
     onChange={...}
     variables={variableList}
   />
   ```

2. **Inline styling bloat.** The AI generated per-span class strings for variable chips, inflating the stored HTML size. I moved styling to a shared `[data-variable]` CSS rule in `index.css`, keeping the persisted markup minimal.

Both fixes were committed in `79632ddc` (`refactor(web): tighten rich-editor per review`) with messages explaining what the AI's approach got wrong and why my version was different.

## What I Learned

AI assistants give you a confident first draft, but they optimize for the average case in their training data, not your specific constraints. The `setContent` race did not appear in the AI's mental model because it was reasoning about a simpler React setup. The role of the developer is to validate, not just accept. The speed gain is in starting from a draft, not in skipping the review.

The bigger AI literacy point this week was not about prompt engineering or model selection. It was about **treating your AI workflow as an asset you own**. Skills, commands, rules, and MCP server configs are portable. If you organize them as a single source of truth, switching runtimes (Claude Code today, OpenCode tomorrow, Codex next year) is a one-time chore, not a rewrite.

## Evidence

- [MR !200 - Tiptap WYSIWYG editor](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200)
- Commit `ba0939b0` — chore: sync OpenCode with Claude Code skills/rules and add SonarQube MCP
- Commit `88daa04c` — chore: add opencode configuration for cross-tool compatibility
- Commit `79632ddc` — refactor(web): tighten rich-editor per review
- Commit `76b9e2f1` — docs(ci): document runner maximum_timeout check in CLAUDE.md
- Source: `.opencode/` (symlinks to `.claude/`), `.mcp.json`, `opencode.json`
- Source: `apps/web/src/components/rich-editor/rich-editor.tsx`
