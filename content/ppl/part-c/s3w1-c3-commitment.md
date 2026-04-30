---
title: "[S3, W1] PPL: Sustained Delivery Across Domains"
date: 2026-04-22
description: "Maintaining consistent output across frontend features, backend services, CI infrastructure, and team documentation, while developing the Telegram notification feature on a dedicated worktree under strict TDD discipline."
tags: ["ppl", "commitment"]
slug: "s3w1-commitment"
toc: true
---

## What I Worked On

This week I delivered work across four domains: a frontend feature, an in-development backend feature, CI infrastructure, and team documentation. The breadth was wide and one of the four tracks (Telegram) is still in active development on a dedicated worktree, but the discipline was the same across all four: every change ships with a failing test first, and every infrastructure tweak ships with an explanation in the commit message.

## Frontend: Tiptap Email Editor (Merged)

MR !200 replaced the raw HTML textarea on the email-template page with a Tiptap WYSIWYG editor. This involved:

- Integrating Tiptap (ProseMirror under the hood) with React, including the `key`-based remount fix to avoid a `setContent` race.
- Building custom variable chips with a slash-command insertion menu via `@tiptap/suggestion` and `tippy.js`.
- Adding a toolbar with bold, italic, underline, lists, and links.
- Writing a 9-assertion test suite (`rich-editor.test.tsx`) that pushed new-code coverage from 28.5% to 97.7% and unblocked the SonarQube quality gate.
- Hosting the SIRA logo on Cloudinary instead of base64 to reduce bundle size.

The MR merged after six iterative commits responding to CI and review feedback. Commits: `b47c3c6e`, `7c60d86f`, `2f3ab4e1`, `65742c09`, `79632ddc`, `d54182ca`.

## Backend: Telegram Notifications (In Active Development)

In parallel with the Tiptap work, I developed the Telegram notification feature on a dedicated Superset worktree (`abhip/telegram` branch, `SIRA/impartial-daffodil` workspace). The feature is **not yet merged** to main: it is still going through internal testing and a self-review before opening the MR. What is done so far, all under strict red-green TDD:

- `red(api)` + `green(api)` pair for the Telegram connection-test endpoint (`b47c3c6e`, `7c60d86f`).
- `red(api)` + `green(api)` pair for the daily AR digest Celery task with metrics query and toggle check (`085b1d90`, `61b13bc8`).
- `red(api)` + `green(api)` pair for the notification dispatcher with toggle checks (`37c19055`, `2ac28520`).
- `red(api)` + `green(api)` pair for Telegram message templates with Markdown V2 formatting (`298c1f06`, `3b2d4cdb`).
- `red(api)` + `green(api)` pair for tenacity retry logic in `TelegramService` (`df7d1fdf`, `3cafb268`).
- `red(api)` + `green(api)` pair for deep-link inline keyboard buttons (`85df5640`, `ed3bb0a1`).
- A refactor commit (`d3c9c23d`) wiring notification hooks into `PaymentService`, `ReminderService`, `RiskService`, and the `check_overdue` Celery task, so business events automatically trigger Telegram notifications when toggled on.

Test count for the Telegram surface alone: 268 lines in `test_daily_digest.py`, 552 lines in `test_telegram_notification_service.py`, 425 lines in `test_telegram_templates.py`, 149 lines added to `test_telegram_service.py`, plus 56 lines in `test_settings_telegram.py`. The work is staged carefully so the eventual MR is reviewable in chunks rather than landing as a 2,000-line dump.

The point for c3: even though this feature has no merged MR yet, the work is real, tracked, and disciplined. Sustained delivery does not mean every commit hits main this week.

## Infrastructure: CI Hardening (Merged)

Three CI fixes that landed in main this week, each unblocking a recurring flaky failure:

- Orphan Supabase slot cleanup in `ci-supabase-slot.sh` (`c7e18ac0`).
- Bandit B704 false positive with documented `# nosec` (`ec2ef1d0`).
- Docker IPv6 preflight check in the deploy script (`a343d4a5`).

Each fix required SSH access to the Nashta runner, log reading, and understanding the interaction between the CI scheduler and the underlying tooling.

## Documentation and Tooling Sync (Merged)

I updated `CLAUDE.md` with a CI troubleshooting section covering runner timeouts, slot cleanup, and Docker networking (`76b9e2f1`), and synced the OpenCode runtime with my Claude Code skills, commands, and rules via symlinks plus a shared SonarQube MCP entry (`ba0939b0`). This last one means that the team's shared `.mcp.json` and the symlinked skills work for whichever AI runtime a teammate prefers to use.

## What I Learned

Commitment in a team context means showing up across multiple arenas, even when the visible-to-main output for one of them is zero this week. The Telegram work has produced no merged MR yet, but it has produced 1,000+ lines of red-green-paired commits and 1,500+ lines of test code on a worktree. That is sustained work, and when the MR opens it will be reviewable in disciplined chunks rather than as a panic-dump near a deadline.

The other learning is that "infrastructure" deserves the same commitment as features. It is easy to focus only on feature code and treat CI as someone else's problem. This week the slot orphan fix, the Bandit nosec, and the Docker IPv6 preflight each took longer than writing a component test, but each saved every future pipeline run from failing in the same way.

## Evidence

- [MR !200 - Tiptap WYSIWYG editor](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200) (merged)
- [MR !195 - Preserve numeric CSV values and reuse invoice cache](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/195) (merged)
- Telegram worktree: `abhip/telegram` branch (in development, not yet merged)
- Commit `7c60d86f` — green(api,web): add Telegram connection test and chat ID setup
- Commit `61b13bc8` — green(api): add daily AR digest Celery task
- Commit `d3c9c23d` — refactor(api): wire Telegram notification hooks into overdue, payment, reminder, risk services
- Commit `c7e18ac0` — fix(ci): orphan slot cleanup
- Commit `76b9e2f1` — docs(ci): document runner maximum_timeout check in CLAUDE.md
- Commit `ba0939b0` — chore: sync OpenCode with Claude Code skills/rules and add SonarQube MCP
- Source: `apps/web/src/components/rich-editor/rich-editor.tsx`
- Source: `apps/api/src/app/services/telegram_*.py`, `apps/api/src/app/workers/daily_digest.py`
- Source: `scripts/ci-supabase-slot.sh`, `CLAUDE.md`
