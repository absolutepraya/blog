---
title: "[S3, W3] PPL: Nine MRs and an Agent-Config Refactor"
date: 2026-05-06
description: "Nine authored MRs in seven days, six direct-to-main commits, a Playwright-driven repro before fixing a CSP bug, and a repo-wide refactor moving from CLAUDE.md to AGENTS.md as the source of truth across Claude, OpenCode, and Codex."
tags: ["ppl", "discipline"]
slug: "s3w3-discipline"
toc: true
---

## What I Worked On

Two threads of disciplined work this week. First, the cadence: nine merged MRs in seven days, all under paired commits, no force-pushes. Second, a repo-wide refactor moving the project's AI-agent configuration from `CLAUDE.md` to `AGENTS.md` as the single source of truth, with thin per-runtime wrappers for Claude, OpenCode, and Codex. The refactor is the kind of thing that's easy to defer indefinitely; doing it now meant the project's AI-tooling story stays portable as I rotate runtimes.

## Cadence: Nine MRs Without Slipping the Bar

The week's MRs:

```
!248  SIRA-298 feat(api,web): configurable Telegram suggestion rules
!252  SIRA-161 refactor(web): address @qenthm review on telegram-settings
!253  SIRA-304 feat(api,web): add Telegram template editor and runtime fallback
!255  SIRA-300 feat(api):     add telegram interactive button groundwork
!256  SIRA-314 fix(api):      unblock Swagger UI /docs and /redoc behind strict CSP
!257  SIRA-315 feat(api,web): require type-to-confirm verification for bulk client delete
!260  fix(api):               silence telegram in tests via autouse dry-run fixture
!261  feat(api,web):          payment proof delete + telegram preview + reminders modal
!206  SIRA-151 fix(web,api):  address post-merge review feedback for export modals
```

Three of them are Telegram feature work continuing the stream from S3W2. Two are bug-fixes (!256 CSP, !260 telegram-in-tests). One is a UX safety improvement (!257 type-to-confirm). One is a refactor responding to teammate review (!252). One is a follow-up to earlier review feedback (!206). One is a multi-feature MR (!261) bundling small UI improvements that didn't deserve individual MRs.

Quality indicators across all nine:
- **Zero force-pushes** on any branch
- **Zero CI regressions** post-merge
- **Every MR squash-merged with full pre-squash history visible**, so iterative work is reviewable

## Disciplined Investigation: Playwright Repro Before Fixing CSP

MR !256 (SIRA-314 unblock Swagger UI behind strict CSP) is a small fix on the surface, but the discipline showed in the investigation. The reported symptom was just "Swagger UI at https://sira-api.nashtagroup.co.id/docs renders blank."

The naive path is to grep for "CSP" in the codebase, see the strict `default-src 'self'` policy, and start whitelisting. Instead, I drove the page with Playwright on 2026-05-04 to capture exactly what was failing:

> The HTML loads (200 OK, correct title) but the DOM is empty because every Swagger asset is blocked by `Content-Security-Policy: default-src 'self'`:
>
> - `swagger-ui.css` / `swagger-ui-bundle.js` from `cdn.jsdelivr.net` — blocked
> - inline bootstrap script (no `'unsafe-inline'`), blocked
> - favicon from `fastapi.tiangolo.com` — blocked

That list is what made the fix surgical. The CSP relaxation lives only on the docs paths (`/docs`, `/redoc`, `/docs/oauth2-redirect`), and only whitelists the three specific origins Swagger UI needs. Every other route keeps the original strict policy. The MR also added three tests:

1. Parametrized check that each docs path gets the relaxed CSP with the expected directives
2. Assertion that non-docs routes still don't see `cdn.jsdelivr.net` in their CSP
3. (third test confirming HSTS + X-Frame-Options unchanged)

If I had started with "just relax the CSP," I might have shipped a global relaxation. The Playwright repro showed exactly which directives needed the exception, and the tests pin the narrow scope so a future refactor can't accidentally widen it.

## Agent-Config Refactor: AGENTS.md as Source of Truth

Three direct-to-main commits this week reshaped the repo's AI-agent configuration:

```
2ad406f9 chore: unify agent config around AGENTS.md and shared skills
971f2f47 chore: add shared command docs and runtime wrappers
4962a891 chore: align Superset worktrees with AGENTS layout
```

Before this refactor, the repo had `CLAUDE.md` files at root, `apps/api/`, and `apps/web/`. Anything I wanted Claude Code to know lived there. OpenCode and Codex each had their own conventions and largely had to be told the same things in different places.

After:

| Layer | Source of truth | Compatibility wrappers |
|-------|----------------|----|
| Repo instructions | `AGENTS.md` (root, `apps/api/`, `apps/web/`) | `CLAUDE.md` symlinks point at sibling `AGENTS.md` |
| Reusable workflows | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>` and `.codex/skills/<name>` symlink to `.agents/skills/<name>` |
| Command docs | `.agents/commands/<name>.md` | `.claude/commands/<name>.md`, `.opencode/commands/<name>.md`, `.codex/prompts/<name>.md` are thin wrappers that point at the shared doc |
| MCP config | tool-specific (`.mcp.json` for Claude, `opencode.json` for OpenCode) | unchanged — these are runtime-specific by design |

Skills like `commit-and-push`, `commit`, `create-mr`, `linear-management`, `sonarqube` now have one canonical `SKILL.md` under `.agents/skills/<name>/`, plus thin command files in each runtime that say "use the shared skill". When I improve a skill, I edit one file and every runtime picks it up.

The third commit (`4962a891`) propagated this layout to the Superset worktree setup script. New worktrees inherit the same `AGENTS.md → CLAUDE.md` symlink structure automatically, so spinning up a parallel feature branch in a new workspace doesn't lose the agent config.

Two more direct-main commits this week supported the refactor:
- `15fc901c` added the project-linking workflow into the `linear-management` shared skill
- `342fe950` set `ENVIRONMENT=test` on the integration-test and mutation:python CI jobs (so the Telegram silencer from S3W2's MR !234 actually fires in CI)

## What I Learned

Two patterns from this week.

**The disciplined investigation pays back even on small bugs.** The Swagger CSP fix was probably 30 minutes of code, but the Playwright repro was the artifact that made the fix narrow. Without it, I'd probably have shipped a too-wide CSP relaxation that some future security audit would have flagged.

**Refactor toward portability when the cost is still low.** The agent-config unification was three commits, ~50 minutes of work, mostly mechanical. Doing it after the project has another ten skills and three more agents would be ten times the work. The right time was now, before that growth.

## Evidence

- 9 authored MRs: [!248](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/248), [!252](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/252), [!253](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/253), [!255](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/255), [!256](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/256), [!257](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/257), [!260](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/260), [!261](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/261), [!206](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/206)
- Direct main commits: `2ad406f9`, `971f2f47`, `4962a891`, `15fc901c`, `342fe950`, `f6e7f6d8`
- Source: `AGENTS.md` (root, `apps/api/`, `apps/web/`), `.agents/skills/`, `.agents/commands/`, `scripts/superset-setup-env.sh`
