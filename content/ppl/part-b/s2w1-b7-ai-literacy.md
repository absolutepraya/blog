---
title: "PPL: AI-Assisted Sprint Planning [Sprint 2, Week 1]"
date: 2026-03-23
description: "Using Claude Code to plan an entire sprint: feature brainstorming, 64 ticket creation with acceptance criteria, codebase exploration, code implementation, and CI debugging."
tags: ["ppl", "ai-literacy", "claude-code", "sprint-planning", "linear"]
slug: s2w1-ai-literacy
toc: true
---

## What I Worked On

This week I used Claude Code (Anthropic's CLI agent) as my primary development partner for Sprint 2 planning, feature brainstorming, code implementation, and CI debugging. The session produced 20 PBIs, 64 subtasks, 3 service file changes, and a merged MR, all in one sitting.

## AI for Sprint Planning

### Feature Gap Analysis

I asked Claude to explore the entire codebase (frontend + backend + infra) and catalog what's implemented vs missing. It launched parallel exploration agents that traced through routes, services, workers, and the database schema, producing a comprehensive feature inventory.

Key insight the AI surfaced: the app's core value prop ("Smart Invoice Reminder AI") had the reminder and AI features entirely stubbed out. The CRUD and auth were solid, but the actual "smart" part was missing.

### Brainstorming with Preferences

Rather than generating a feature list in isolation, I had a conversational brainstorm where the AI proposed features and I refined them:

- "Email or WhatsApp?" → "Email for clients, Telegram for internal team"
- "Email templates: one or per-tone?" → "3 tones x 2 languages = 6 variants"
- "Export scope overlap with bulk actions?" → Clarified: full filter modal vs selected rows only
- "Duplicate detection: skip or flag?" → "Flag with red accent, edit or skip, can't proceed with unresolved"

Each decision was immediately incorporated into the ticket descriptions.

### Ticket Creation via Linear MCP

Claude created all 64 tickets directly in Linear via the MCP server integration. Each ticket had:
- Scope tags ([FE], [BE], [FE+BE])
- Detailed acceptance criteria with checkboxes
- Technical notes referencing existing patterns
- Cross-PBI blocking relations

The entire planning session (brainstorm → create tickets → set blockers → rebalance sprints) took about 2 hours for what would normally be a full day of solo planning.

## AI for Code Implementation (SIRA-136)

For the monitoring feature, I used plan mode to have Claude:
1. Explore the existing Sentry setup, service patterns, and middleware
2. Read the target service files and understand the architecture
3. Propose where to place spans (service layer, not routers)
4. Implement the changes across 3 files
5. Fix the SonarQube S1192 violation when quality gate failed
6. Commit, push, and create the MR

The AI followed the project's architecture conventions (thin routers, business logic in services) without being reminded. It read `CLAUDE.md` and the service files to understand the patterns.

## AI for CI Debugging

When the SonarQube quality gate failed, the AI:
1. Checked the CI pipeline status via `glab ci status`
2. Read the job logs via `glab ci trace`
3. Identified the specific rule violation (S1192: duplicated string literal)
4. Fixed it (extracted to constant)
5. Ran lint + tests locally
6. Pushed the fix

When web:test failed on CI (flaky timeout, not code-related), it correctly identified it as a CI runner performance issue and retried the job instead of trying to "fix" the code.

## What the AI Can't Do

Limitations I observed:
- **Can't access SonarQube directly**: the SonarQube instance requires VPN access that the AI doesn't have. I had to screenshot the dashboard.
- **Can't configure GlitchTip UI**: uptime monitors are a web UI task. The AI guided me step-by-step but couldn't click buttons.
- **Cycle assignment bug**: the Linear MCP didn't properly assign cycles during issue creation. The AI had to go back and update all 64 tickets in batches.

## Result

| Metric | Value |
|---|---|
| PBIs created | 20 |
| Subtasks created | 64 |
| Service files modified | 3 |
| MRs created and merged | 1 (MR !106) |
| CI issues debugged | 2 (SonarQube S1192, flaky web:test) |
| Time saved (estimate) | ~6 hours of manual ticket creation |

The AI is most effective as an accelerator for structured, repetitive tasks (ticket creation) and pattern-following code changes (adding spans to existing service methods). It's less useful for tasks requiring visual interaction (GlitchTip UI) or external system access (SonarQube behind VPN).

## Evidence

- [MR !106 - AI-assisted monitoring implementation](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/106)
- [Linear SIRA-146 to SIRA-209](https://linear.app/ppl-sira) (64 tickets created via AI)
- [Linear SIRA-136](https://linear.app/ppl-sira/issue/SIRA-136), [SIRA-137](https://linear.app/ppl-sira/issue/SIRA-137) (monitoring tickets)
- Claude Code session: brainstorming → ticket creation → code implementation → CI debugging → MR merge
