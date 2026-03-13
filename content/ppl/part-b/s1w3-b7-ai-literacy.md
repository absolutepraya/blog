---
title: "PPL: AI Literacy [Sprint 1, Week 3]"
date: 2026-03-13
description: "Using AI strategically across 14 MRs: how CLAUDE.md evolved as a living document, MCP servers provided live project context, and AI-assisted code review caught real bugs."
tags: ["ppl", "ai", "claude-code", "developer-tools"]
slug: s1w3-ai-literacy
toc: true
---

## What I Worked On

This week tested whether the AI development infrastructure built in Sprint 1 Weeks 1-2 actually pays off under heavy workload. With 14 MRs and 10 code reviews in one week, every tool in the AI stack was used extensively. I also updated the CLAUDE.md documentation based on new patterns discovered during development.

## CLAUDE.md as Living Documentation

The project's AI instruction document (`CLAUDE.md`) was updated this week to reflect new patterns encountered during development. Commit `80b127b` added `fullName` to the documented auth context values in `apps/web/CLAUDE.md`:

```markdown
# Auth Context Values
- id, auth_user_id, email, full_name, role
```

This seems minor, but it's an example of the feedback loop: during MR !78 (UI polishing), the AI generated code that referenced `user.name` instead of `user.full_name` because the CLAUDE.md didn't list the exact field names. After correcting the code, I updated the docs so future AI sessions don't repeat the mistake.

### The three-file hierarchy in action

With 14 MRs spanning frontend, backend, and infrastructure, the three-level CLAUDE.md hierarchy proved its value:

| Working in | Files loaded | Effect |
|-----------|-------------|--------|
| `apps/web/` | Root CLAUDE.md + web CLAUDE.md | AI knows TanStack patterns, Biome rules, component conventions |
| `apps/api/` | Root CLAUDE.md + api CLAUDE.md | AI knows Router → Service → DB, mypy strict, Celery patterns |
| Root (CI, infra) | Root CLAUDE.md only | AI knows monorepo structure, branch naming, commit format |

When reviewing MR !72 (TanStack Query invalidation), the web CLAUDE.md's documentation of query key conventions helped the AI identify that `['invoices']` (list) and `['invoices', id]` (detail) are separate cache entries that require independent invalidation. This is the kind of project-specific knowledge that generic AI doesn't have.

## MCP Servers for Live Context

Four MCP servers provide real-time project data during AI sessions:

| Server | Used for this week |
|--------|-------------------|
| **Linear** | Checking ticket status for all 14 MRs, linking MRs to tickets |
| **Supabase** | Exploring schema during invoice management development |
| **SonarQube** | Verifying zero issues on main after each merge |
| **Context7** | Looking up TanStack Query v5 docs during !72 review |

The **Linear MCP** was particularly valuable this week. The CI pipeline automatically links MRs to Linear tickets and updates their status (via `linear:notify` in `.gitlab-ci.yml`). During development, the MCP let me check ticket status without switching to the Linear web app:

```
"What's the status of SIRA-98?"
→ SIRA-98 is In Review (linked to MR !67)
```

![Claude Code terminal session analyzing SonarQube quality gate alongside Hugo blog server](/images/ppl/claude-code-sonarqube.png)

The **Context7 MCP** was used during the code review of MR !72 to verify TanStack Query v5's invalidation behavior. Rather than relying on training data (which may be outdated), Context7 fetched the current v5 documentation:

```
resolve-library-id: "@tanstack/react-query"
→ query-docs: "invalidateQueries"
```

This confirmed that invalidating `['invoices', id]` does not bubble up to `['invoices']`, validating my review comment.

## AI-Assisted Code Review: Critical vs. Accepting

The most important AI literacy practice this week was **verifying AI suggestions before posting them**. Every code review comment was generated with Claude Code's assistance, but each finding was manually verified:

**Verified and posted (MR !72):**
The AI identified the missing `['invoices']` list invalidation in `useCreatePayment`. I verified this by:
1. Reading the TanStack Query v5 docs via Context7
2. Checking the existing invalidation code in `use-payments.ts`
3. Confirming the invoices list page would show stale data

**Verified and posted (MR !45):**
The AI flagged the auth/DB desync risk in the staff `update` method. I verified by:
1. Reading the `create` method (which has proper error handling)
2. Confirming `update` has no try/except
3. Tracing the failure mode (Auth succeeds, DB fails → desync)

**AI suggestion rejected:**
During review of MR !64 (frontend foundation), the AI suggested wrapping all API calls in a retry mechanism. I rejected this because:
- SIRA's API calls are mostly mutations (create/update), not idempotent reads
- Retrying a `POST /invoices/` could create duplicate invoices
- The real fix for transient failures is proper error handling in the UI, not silent retries

This is the difference between score 3 (using AI) and score 4 (using AI critically). AI suggests; the developer decides. Every suggestion gets the "does this actually make sense for our project?" filter.

## Custom Slash Commands Under Load

The three custom commands (`/commit`, `/commit-and-push`, `/create-pr`) handled the volume well:

- `/commit` ran the 5-hook pre-commit stack (Biome → Ruff → tsc → mypy → Knip) for every commit. When hooks failed, it auto-fixed formatting issues and retried without `--no-verify`.
- `/create-pr` generated MR descriptions from commit history, ensuring each MR had a structured description explaining what changed and why.

With 14 MRs, these commands saved significant time on repetitive Git operations while ensuring consistent quality (no commits bypassing hooks, no MRs without descriptions).

## Measuring AI Impact

Rough metrics from this week:

| Metric | Value |
|--------|-------|
| MRs authored | 14 |
| MRs reviewed | 10 |
| AI review suggestions accepted | ~80% |
| AI review suggestions rejected | ~20% |
| CLAUDE.md updates | 1 (auth context fields) |
| MCP queries (estimated) | 30+ |

The 20% rejection rate is healthy. It means the AI is generating non-trivial suggestions (trivial ones would be 100% accepted), and the developer is exercising judgment.

## Result

The AI infrastructure built in Weeks 1-2 directly enabled the Week 3 output volume. Without the MCP servers, custom commands, and CLAUDE.md context, the same 14 MRs + 10 reviews would have required significantly more context switching and manual reference lookups.

## Evidence

- Commit `80b127b` - CLAUDE.md update (fullName auth context)
- `.mcp.json` - 4 MCP server configurations
- `.claude/commands/` - 3 custom slash commands
- MR review comments on !72, !75, !64, !49, !45, !46 (AI-assisted, manually verified)
- All code review comments attributed with "Generated with Claude Code" footer
