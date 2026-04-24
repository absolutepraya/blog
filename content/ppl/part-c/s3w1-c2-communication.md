---
title: "PPL: Sharing Tools and Responding to Feedback [Sprint 3, Week 1]"
date: 2026-04-22
description: "Sharing the Superset workspace tool with the team via a Discord demo, responding to CI feedback with iterative commits, and writing durable docs for the team handbook."
tags: ["ppl", "communication"]
slug: "s3w1-communication"
toc: true
---

## What I Worked On

Three communication threads this week. First, I shared a development tool (Superset) with the team via Discord, with a config walkthrough and a demo video, so they could adopt it without reading 260 lines of shell. Second, I responded to CI feedback on MR !200 with six follow-up commits, each carrying a message that explains the why. Third, I extended the team handbook with CI troubleshooting steps so the next person hitting an obscure runner timeout does not have to wake me up.

## Sharing Superset to the Team via Discord

[Superset](https://superset.dev) is a macOS app for isolated dev workspaces backed by git worktrees. Each workspace gets its own port block, Redis container, Supabase stack, and `.env.local`, so you can run multiple feature branches in parallel without port collisions or migration conflicts. I had been using it locally for a few sprints and finally landed a workspace setup that works cleanly with SIRA.

I packaged the share for the team in three pieces:

1. A Discord message in our team channel with the high-level pitch (parallel feature dev without `git stash` dances, no shared infra, per-workspace Supabase migrations).
2. A short demo video walking through creating a workspace, watching it auto-allocate ports, and running both the Telegram feature branch and the main branch side by side.
3. A pointer to the codebase config so anyone wanting to dig in could read it: `.superset/config.json`, `.superset/process-compose.yaml`, and the four scripts under `scripts/superset-*.sh`.

The config is the load-bearing part. `scripts/superset-setup-env.sh` runs once when a new workspace is created and does this:

- Allocates a 10-port block by reading `~/.superset/sira-port-allocations.json` and finding the next free base (3001, 3011, 3021, ...).
- Derives all eight service ports from the base (web, api, redis, supabase api/db/studio/auth/inbucket).
- Patches `.env.local` with the workspace-specific URLs so the API knows which Supabase to talk to.
- Generates a per-workspace `.superset/supabase/config.toml` with a unique `project_id = sira-ws-<base>` and the shifted ports.
- Starts a per-workspace Redis container (`sira-redis-ws-<base>`) and runs `supabase start` in the workspace's own supabase dir.
- Captures the freshly-minted Supabase keys via `supabase status -o env` and patches them back into `.env.local`.
- Seeds the database via `scripts/superset-seed.sh` so the workspace is immediately usable.

That last point is what makes the share land: a teammate creates a workspace, waits about three minutes, and they have a fully isolated SIRA stack with seeded data. No "did you remember to run the migrations" questions, no port-already-in-use errors.

## Iterative Response to CI Feedback on MR !200

MR !200 (Tiptap email editor) needed six follow-up commits after the initial push. Each one responded to a specific failure or review point:

1. `chore: host SIRA logo on Cloudinary` — base64 logo was bloating the bundle.
2. `chore(api): add 2px white border around email header logo` — visual review on the deploy preview.
3. `fix(ci): run web tests in a single fork to avoid onTaskUpdate timeouts` — Vitest parallel forks were exhausting the runner.
4. `refactor: resolve 6 SonarQube violations` — code smell cleanup from the new-code gate.
5. `test(web): cover rich-editor package + unblock SonarQube gate` — coverage went from 28.5% to 97.7%.
6. `chore(web): bump rich-editor coverage assertion to satisfy mutation gate` — final tweak after Stryker found surviving mutants.

Each commit message names the exact problem and the exact fix. A teammate reading the history six months later can see why the test runner uses a single fork without asking. That is the point of a commit message: durable communication that survives me.

## Post-Merge Review on Export Modals

After MR !195 merged, a review pointed out silent `.catch(() => {})` blocks in the CSV export modals. Errors were being swallowed, so a failed export looked identical to a successful one. I fixed it within 24 hours in commit `d54182ca`, replacing the silent catches with Sentry capture and toast notifications, and adding regression tests in `client-export-modal.test.tsx` and `payment-export-modal.test.tsx`. The commit message explained what was caught, why the silent catch had been wrong, and what the new behavior is.

## Team Handbook: CI Troubleshooting

I added a CI troubleshooting section to `CLAUDE.md` covering:

- Slot-related job failures (orphan PIDs, port collisions, container name reuse).
- The runner `maximum_timeout` GitLab admin setting (the YAML `timeout: 25 minutes` is silently capped at 10 if this is unset).
- Docker IPv6 fallback failures during `docker pull` and the exact `daemon.json` fix.
- How to read the `ci-report.sh` MR comment formats.

Each entry has a "log says X → root cause is Y → fix is Z" table row, so a teammate triaging a stuck pipeline at 11 PM does not need to ask in chat. This is durable communication: docs that answer the question before it is asked.

## What I Learned

There are two communication gears in a software team. The fast gear is Discord and standups. The slow gear is commit messages, MR descriptions, and team handbooks. Both matter, but the slow gear compounds. A good commit message helps every future reader for years; a Discord ping helps one person once. This week I tried to put real effort into the slow gear, especially the Superset share (which needed both Discord-fast and config-slow communication to actually land in the team's workflow).

## Evidence

- [MR !200 - Tiptap WYSIWYG editor](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200)
- [MR !195 - Preserve numeric CSV values and reuse invoice cache](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/195)
- Commit `d54182ca` — fix(web,api): address post-merge review feedback for export modals
- Commit `76b9e2f1` — docs(ci): document runner maximum_timeout check in CLAUDE.md
- Source: `scripts/superset-setup-env.sh`, `.superset/config.json`, `.superset/process-compose.yaml`
- Source: `CLAUDE.md` (CI troubleshooting section)
- Discord share: team channel, demo video attached
