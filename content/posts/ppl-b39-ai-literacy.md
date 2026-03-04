---
title: "PPL: AI-Augmented Development with Claude Code and MCP"
date: 2026-03-04
description: "How CLAUDE.md evolved through 17 commits into a systematic AI workflow document, and how MCP servers give Claude project-aware context for code review and development."
tags: ["ppl", "ai", "claude-code", "mcp", "developer-tools"]
toc: true
---

## CLAUDE.md as a Living Document

`CLAUDE.md` is the AI instruction document for the SIRA project. It was not written once and left static. It evolved through **17 commits**, each one a direct response to a real friction point encountered during development.

```mermaid
gitGraph
    commit id: "init CLAUDE.md + AGENTS.md"
    commit id: "add branch naming convention"
    commit id: "add ticket code convention"
    commit id: "enforce Linear MCP usage"
    commit id: "add Sentry env vars"
    commit id: "add PR naming convention"
    commit id: "add Windows cross-platform scripts"
    commit id: "add process-compose docs"
    commit id: "add Supabase setup docs"
    commit id: "separate celery beat docs"
    commit id: "add SonarQube + GitLab CI docs"
    commit id: "migrate gh CLI to glab"
```

Selected commits and what triggered them:

| Commit | What triggered it |
|--------|-------------------|
| `add Linear MCP config and ENFORCE usage` | AI was using the wrong Linear workspace (personal vs. project) |
| `add cross-platform dev scripts (Windows)` | Teammate on Windows could not run `make dev` |
| `separate celery beat into dedicated process` | Production bug found; docs updated immediately to prevent recurrence |
| `add SonarQube + GitLab CI/CD docs` | SIRA-60 completed; new CI workflows documented for AI context |
| `migrate: gh CLI to glab` | Repository migrated from GitHub to GitLab; all CLI references updated |

The document is now 17KB and covers architecture patterns, naming conventions, Git policy, package manager enforcement (`pnpm`, `uv`), and explicit anti-patterns ("NEVER auto-commit", "NEVER use `any` type").

## MCP Server Setup

Claude Code connects to four MCP servers that give it live project context:

| Server | Purpose |
|--------|---------|
| `linear-server` | Read and write Linear tickets, subtasks, project status |
| `supabase` | Query the local dev database for schema exploration |
| `context7` | Fetch up-to-date library documentation by package name |
| `sonarqube` | Inspect code quality issues and security hotspots from CI results |

Configuration lives in `.mcp.json` at the repo root. The same file is consumed by Cursor, Copilot, and Codex via `AGENTS.md` symlinks (one source of truth for all AI tools).

This setup means queries like "what tests are currently failing in SonarQube?" or "what is the current schema for `app_users`?" are answered from live data, not from memory.

## AI in Code Review

Code reviews for MRs [!10](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/10), [!12](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12), [!17](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/17), and [!20](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20) used Claude Code as a tool. Each review:

1. Read the full diff
2. Cross-referenced against the codebase (existing patterns, CLAUDE.md conventions, `pyproject.toml` config)
3. Flagged concrete, actionable issues with file and line references

Issues were not accepted from AI as-is. Each finding was verified against the actual source before posting. Example: the N+1 equivalent in MR !12 (issue #5) was flagged by Claude, then confirmed by checking that `InvoiceDetail.payments` already contained the required data in the parent query.

Review comments were posted with attribution: *"Generated with Claude Code."*

## SIRA-67: AI-Assisted CI Automation

When the repo migrated from GitHub to GitLab, Linear's native GitLab integration did not work (GitLab is behind VPN). Instead of manual ticket updates, a CI job was built to automate it.

`scripts/linear-notify.sh` uses the Linear GraphQL API to:

- Auto-link MRs as attachments on the corresponding Linear issue
- Move the issue to "In Review" when an MR is opened
- Move the issue to "Done" when the MR is merged to main

This runs in the CI `quality` stage on every MR pipeline.

## Evidence

- `CLAUDE.md` at repo root (`git log --follow --oneline CLAUDE.md` shows 17 commits)
- `.mcp.json` - MCP server configuration
- `AGENTS.md` - symlink to CLAUDE.md (multi-tool compatibility)
- [MR !31 - SIRA-67 Linear auto-tagger CI job](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/31)
- [Linear SIRA-67](https://linear.app/ppl-sira/issue/SIRA-67)
- Code review notes: MR !10 (Note 4378), !12 (Note 4383), !17 (Note 4579), !20 (Note 4601)
