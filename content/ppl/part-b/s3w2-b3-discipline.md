---
title: "PPL: Root-Cause Discipline on a CI Flake [Sprint 3, Week 2]"
date: 2026-04-29
description: "How a 25-minute integration-test flake got traced back to two competing Docker cleanup crons fighting an active pull, plus a pre-push hook hardening pass that catches lockfile drift before it reaches CI."
tags: ["ppl", "discipline"]
slug: "s3w2-discipline"
toc: true
---

## What I Worked On

Two pieces of plumbing this week, both small in code but careful in investigation. MR !232 fixed an integration-test flake that had been wedging the job for 25 minutes per attempt. MR !223 hardened the pre-push git hook to catch the kinds of failures that previously only showed up in CI. Both fit the same pattern: spend more time tracing the failure than writing the fix.

## The 25-Minute Flake

The failure surface was `api:integration-test` failing on every other pipeline with the cryptic Docker error:

```
failed commit on ref ... no such file or directory
```

The job uses `npx supabase start`, which pulls `public.ecr.aws/supabase/postgres:17.6.1.106` along with five other Supabase images. Once the pull failed, the CLI retried the same broken ingest path, looping until the 25-minute job timeout.

The first instinct is to add a retry loop and call it a day. I resisted that because the symptom (`no such file or directory` mid-pull) only happens when something is actively deleting layers under containerd's nose, and a retry would just re-trigger the race.

I ran a few diagnostics on the runner host:

```bash
ssh ubuntu@10.10.25.75 "sudo systemctl list-timers --all | grep docker"
ssh ubuntu@10.10.25.75 "sudo crontab -l"
ssh ubuntu@10.10.25.75 "crontab -u gitlab-runner -l"
```

Two competing crons surfaced:

1. **`/opt/smart-invoice/cleanup-docker.sh`** in root crontab, every 6 hours. It removed all `sha-*` GHCR tags, dangling images, and builder cache.
2. **`/usr/local/bin/sira-docker-housekeeping.sh`** in gitlab-runner's crontab, daily at 04:00. It ran `docker image prune -af --filter until=72h`. The `-a` flag deletes any unused tagged image, including the Supabase postgres pull.

The race was: cron #2 (or cron #1) starts pruning. CI starts a `docker pull` of `postgres:17.6.1.106` simultaneously. The pull is "unused" by the prune's definition because no container references it yet. The prune deletes a layer mid-stream. containerd's bolt-DB ingest metadata gets corrupted, and every subsequent pull retries the same dead ingest path.

The `.gitlab-ci.yml` had a comment at line 35 warning future contributors not to add pipeline-level prunes for exactly this reason. But the host-side root cron escaped that audit because it was set up months earlier and outside source control.

## The Fix Was Three Layers Deep

Just removing the bad cron would have fixed the immediate flake. But that leaves the runner one hand-edit away from re-introducing it, and gives nobody else on the team visibility. I structured the fix so that:

1. **Source of truth moves into the repo.** I added `infra/sira-docker-housekeeping.sh` to git so the script that gitlab-runner actually runs is reviewable and version-controlled. The new script drops the `-a` flag, so tagged registry images are never touched. It also explicitly trims old `sha-*` GHCR tags by keeping the newest 3 per repo, which preserves the original cleanup intent without nuking active pulls.

2. **The bad cron is decommissioned with a paper trail.** I disabled `/opt/smart-invoice/cleanup-docker.sh` by renaming it to `.disabled-SIRA-303` and removed its root crontab entry. The renamed file is a breadcrumb so anyone investigating later can find it and read the SIRA-303 ticket.

3. **Future regressions fail in 60 seconds, not 25 minutes.** I added a `docker pull` preflight to `scripts/ci-supabase-slot.sh`:

```bash
PREFLIGHT_TIMEOUT=60
required_images=(
  "public.ecr.aws/supabase/postgres:17.6.1.106"
  "public.ecr.aws/supabase/gotrue:v2.184.0"
  # ...four more
)

for image in "${required_images[@]}"; do
  if ! timeout "$PREFLIGHT_TIMEOUT" docker pull "$image" >/dev/null 2>&1; then
    echo "Preflight failed for $image — runner needs ops attention"
    echo "Likely cause: containerd ingest race. See SIRA-303 in CLAUDE.md."
    exit 1
  fi
done
```

If the bug ever recurs, the job fails in 60 seconds with a clear message instead of looping for 25. The error string `runner needs ops attention` and the SIRA-303 reference are deliberate. They turn what used to be a mystery into a self-documenting check.

## Pre-Push Hook Hardening (MR !223)

The CI feedback loop on this project is fast (most jobs finish in under 5 minutes), but pushing a commit that fails CI still costs at least 5 minutes plus the context switch. The pre-commit hook runs format and lint, but several common failure modes were slipping through:

- Vite build errors that `tsc --noEmit` misses (Rollup-specific import cycles, dynamic import resolution).
- `pnpm` and `uv` lockfile drift (PR adds a dependency, lockfile not updated, CI fails on `pnpm install --frozen-lockfile`).
- Branch naming that doesn't match the `<name>/<type>/<SIRA-XX>-...` convention.
- Dead code introduced by the diff (Knip detection).

I added all four to a hardened pre-push hook. The hook runs **after** pre-commit (so format/lint already passed), but **before** the push hits CI:

```bash
#!/usr/bin/env bash
set -e

# 1. Branch naming validation
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "main" && ! "$branch" =~ ^[a-z]+/[a-z]+/[A-Z]+-[0-9]+-.+ ]]; then
  echo "Branch '$branch' does not match required format: <name>/<type>/<SIRA-XX>-<description>"
  exit 1
fi

# 2. Lint fallback (in case pre-commit was skipped with --no-verify)
pnpm --dir apps/web lint
(cd apps/api && uv run ruff check . && uv run ruff format --check .)

# 3. Dead code detection
pnpm --dir apps/web knip

# 4. Frontend build (catches Rollup errors tsc misses)
pnpm --dir apps/web build

# 5. Lockfile freshness
pnpm install --frozen-lockfile --prefer-offline > /dev/null
(cd apps/api && uv sync --frozen > /dev/null)

# 6. Tests
pnpm --dir apps/web test
(cd apps/api && uv run pytest tests/ -m 'not integration')
```

The lockfile check is the one that has caught the most false positives so far. `uv sync --frozen` and `pnpm install --frozen-lockfile` both fail loudly if the lockfile is out of sync with the manifest, which is exactly the failure mode that hits CI in `web:lint` or `api:lint` and blocks the merge until the developer pushes a second commit.

The branch naming check was added because half the team had been creating branches like `fix-bug` instead of `daffa/fix/SIRA-123-bug`, and the Linear-notify CI job could not link those to tickets. Catching it pre-push means it never reaches the MR creation step.

## What I Learned

Discipline on infrastructure work means **not stopping at the first plausible cause**. The integration-test flake had three candidate causes I considered before landing on the right one (network instability, Supabase CLI bug, runner disk pressure). Each of them would have led to a band-aid fix that did not address the actual race. The 30 minutes I spent reading containerd internals and crontabs was worth more than the 30 minutes a retry loop would have saved.

The pre-push hook is the same shape: each check exists because a specific class of CI failure had bitten me at least once. Adding a check costs nothing once you have done the diagnosis. Skipping the diagnosis costs every developer who hits the same failure later.

## Evidence

- [MR !232 SIRA-303 fix(ci): restore api:integration-test and fix containerd ingest race](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/232) — squash `895e06de`
- [MR !223 chore(hooks): harden pre-push with lint, build, knip, lockfile, branch validation](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/223) — squash `1decb91d`
- Source: `infra/sira-docker-housekeeping.sh`, `scripts/ci-supabase-slot.sh`
- Source: `.husky/pre-push`
- `CLAUDE.md` — added the SIRA-303 troubleshooting row to the CI debugging table
