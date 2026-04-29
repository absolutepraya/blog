---
title: "PPL: Quality Gates That Actually Catch Things [Sprint 3, Week 2]"
date: 2026-04-29
description: "Three quality interventions this week: source-controlling a runaway housekeeping cron, hardening pre-push to prevent CI lockfile drift, and fixing 11 issues during review of a teammate's MR by contributing 12 commits onto their branch."
tags: ["ppl", "code-quality"]
slug: "s3w2-code-quality"
toc: true
---

## What I Worked On

Code quality this week was less about writing new code and more about making sure bad code did not slip through. Three interventions: turning a 25-minute CI flake into a 60-second self-documenting failure (MR !232), adding pre-push checks for the failure modes that bypass pre-commit (MR !223), and contributing 12 commits onto a teammate's MR during review to fix sonar/auth/typing issues before merge (!215).

## Turning a Mystery Into a Self-Documenting Check

The full story is in the discipline blog, but the quality angle is worth pulling out separately. Before this week, when `api:integration-test` failed with `failed commit on ref ... no such file or directory`, the failure looked like:

```
ERROR: Job failed: execution took longer than 25m0s seconds
```

The developer who hit that had no signal about what to do. The runner host needed manual intervention from someone with SSH access. Most of the team would just retry the job and hope for the best.

After MR !232, the same failure mode produces:

```
[supabase-slot] Preflight failed for public.ecr.aws/supabase/postgres:17.6.1.106
[supabase-slot] Likely cause: containerd ingest race. See SIRA-303 in CLAUDE.md.
[supabase-slot] Runner needs ops attention.
ERROR: Job failed: exit code 1 (after 47s)
```

The job still fails, but it fails in 60 seconds instead of 25 minutes, and the failure carries its own remediation pointer. CLAUDE.md gained a new row in the CI debugging table that explains the root cause and the exact commands to fix the runner. Anyone hitting this failure later has a path forward without paging me.

The quality lesson is that **error messages are part of the system's quality**. A 25-minute timeout with no actionable info wastes developer time on every recurrence. A 60-second failure with a doc pointer makes the same recurrence cheap. The code change for the preflight is 30 lines; the documentation pairing it is what actually changes the team's experience.

## Pre-Push as a Quality Filter (MR !223)

Pre-commit ran format and lint. CI ran lint, typecheck, build, knip, and tests. Pre-push was a no-op. That meant several quality issues consistently slipped through pre-commit and only got caught after the push hit CI:

- `pnpm-lock.yaml` not committed when a dependency was added → `pnpm install --frozen-lockfile` fails in `web:lint`.
- `uv.lock` similarly out of sync after adding a Python dependency.
- Branch named `fix-stuff` instead of `daffa/fix/SIRA-123-stuff` → Linear-notify can't link the MR to a ticket.
- Vite build fails due to a Rollup-specific issue that `tsc --noEmit` does not catch (cyclical dynamic imports).
- Knip detects a newly-orphaned export from a refactor.

Each of these wasted at least 5 minutes of CI time per occurrence. I added them all to pre-push:

```bash
# 1. Branch naming validation (must match <name>/<type>/<SIRA-XX>-<desc>)
# 2. Lint fallback (in case pre-commit was skipped with --no-verify)
# 3. Knip dead-code detection
# 4. Frontend Vite build (catches Rollup errors tsc misses)
# 5. Lockfile freshness via `pnpm install --frozen-lockfile` and `uv sync --frozen`
# 6. Frontend tests (vitest)
# 7. Backend tests (pytest unit only, integration excluded for speed)
```

The pre-push hook adds about 90 seconds to a push. CI takes 4-5 minutes. So even one lockfile catch per week pays for the hook many times over. Across the team, the cumulative saving is much larger because every developer benefits from every check that fires.

The branch-naming check has been the most surprising in terms of impact. It is annoying for the first few hours then becomes invisible because branches just get named correctly. The Linear-notify CI job now succeeds on every MR, which means every MR gets auto-linked to its tickets in the table comment, which means I can actually see at a glance what's covered when reviewing.

## Code Quality During Review: 12 Commits Onto Someone Else's Branch

MR !215 (boneyard skeleton screens, by @hl) had 11 distinct review threads when I dug into it. Most reviewers would post the threads and wait for the author to address them. I took a different approach: where the fix was clear and small, I pushed commits directly onto the author's branch with explanatory commit messages, and explained in the thread what each commit did.

Across the review I pushed 12 commits to the branch (per the merge log on main):

```
bc62cbee fix(web): address sonar issues in boneyard
0cf2cc76 fix(ci): harden supabase slot orphan reaping
4340287f fix(web): localize boneyard typing workaround
b9aec76f fix(db): sync missing remote migrations
1d1419ba Merge remote-tracking branch
70fcc797 fix(web): localize boneyard typing workaround
89986001 merge main into branch
d967209f fix(db): sync missing remote migrations
a2ba161e fix(web): refine loading states and auth fallback
c1feb4be feat(web): restore Boneyard registrations after audit
1b7a29db fix(web): refine loading states and auth fallback
491a1e6e fix(infra): use Superset-patched Supabase dir in dev-infra targets
```

Two of these are worth highlighting for quality.

**The auth fallback commit (`1b7a29db`).** During review I noticed that the DEV capture auth fallback was failing *open* on unauthorized or invalid tokens, meaning a misbehaving production deploy could surface the dev capture to real users. I fixed it to fail *closed* (denying access on any error path) and pushed the change directly. The commit message explained the security implication so the author could see the reasoning when they pulled.

**The localized typing workaround (`4340287f` / `70fcc797`).** The author had added a global module override for `boneyard-js` to fix a tuple-vs-object typing mismatch. That global override would affect every TypeScript file in the project, including ones that had nothing to do with the rich editor. I rewrote the workaround to be local to `src/bones/registry.ts` and added `tests/types/boneyard-js.test.ts` to guard the public API types. Net diff was about the same size, but the blast radius dropped from "every file" to "one file".

The author's response (in the MR thread) was straightforward acceptance of all 12 commits. They called out the auth-fallback fix and the typing-localization explicitly as good catches in their reply. This kind of in-branch collaboration is faster than a back-and-forth review thread when the fix is small enough to write while reviewing.

## Direct Commits to Main (Cleanup Work)

Three small commits went straight to main this week, each one a quality-of-life fix that did not need an MR:

```
8a6cd615 fix(infra): enable storage in superset workspace config
88697bdd chore(security): remove SonarQube MCP and load token from .env.local
c461000e chore(config): remove sonarqube mcp from opencode.json
```

The `88697bdd` commit is interesting because it touches code quality tooling itself. The SonarQube MCP server was previously declared in our shared config with a hardcoded auth token. I removed the MCP entirely and switched to loading the token from `.env.local` only when needed. The shared config no longer carries a secret, and the `.opencode/` and `.claude/` setups stay in lockstep.

## What I Learned

Quality is mostly about feedback loops. A 25-minute mystery is poor quality not because the code is bad but because the developer experience around the failure is bad. A pre-push hook that catches lockfile drift is a quality investment because every push that does *not* fail saves 5 minutes downstream. Pushing fixes onto a teammate's branch during review is a quality investment because the alternative (back-and-forth threads) costs hours of calendar time for a 30-second fix.

Code quality is what happens when somebody else, including future-you, has to pick up the work. Every check, comment, and self-documenting failure message is a debt prepayment for that handoff.

## Evidence

- [MR !232 SIRA-303 fix(ci): containerd ingest race + 60s preflight](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/232) — squash `895e06de`
- [MR !223 chore(hooks): harden pre-push](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/223) — squash `1decb91d`
- [MR !215 SIRA-262 boneyard skeletons](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/215) — 12 commits contributed during review
- Direct commits to main: `8a6cd615`, `88697bdd`, `c461000e`
- Source: `infra/sira-docker-housekeeping.sh`, `scripts/ci-supabase-slot.sh`, `.husky/pre-push`
- `CLAUDE.md` — added SIRA-303 row to the CI debugging table
