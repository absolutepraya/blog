---
title: "PPL: Bash Programming Discipline [Sprint 3, Week 1]"
date: 2026-04-15
description: "Three CI jobs needed their own Supabase stack to run in parallel. The solution was a 92-line bash script using flock-with-file-descriptors, a trap-based teardown, and strict port arithmetic. Every choice had to defend against partial failure."
tags: ["ppl", "programming", "bash", "ci"]
slug: s3w1-programming
toc: true
---

## What I Worked On

Before this week, `mutation:python` and `api:integration-test` both used a `resource_group: supabase-local` to prevent them from running at the same time. Serializing them was the cheap fix for port conflicts on port 54321. The cost was CI latency: two jobs running sequentially instead of in parallel.

This week's work removed the serialization by giving each job its own Supabase stack on a different port. `scripts/ci-supabase-slot.sh` claims one of three slots, exports all the env vars the job needs, and registers a teardown trap so the slot is released even if the script fails partway. The file is 92 lines and almost every line is defensive.

---

## The Core Problem: Port Reuse Without Races

Supabase's local CLI uses fixed ports by default: 54321 for the API, 54322 for the DB, 54323 for Studio. Two jobs on the same runner colliding on port 54321 was what `resource_group` was preventing.

The obvious fix is "use different ports per job." The hard part is answering which job gets which port. Options considered:

| Approach | Problem |
|----------|---------|
| Random port per run | Port collisions become random flakes; debugging requires log-diving |
| Hash of CI job ID → port | Still collides eventually with enough jobs |
| Slot file with `flock` | Exclusive lock per slot, port determined by slot index, predictable |

The slot approach won because port assignment is deterministic given the slot: slot 0 uses 54321/54322/54323, slot 1 uses 54421/54422/54423, slot 2 uses 54521/54522/54523. Three slots cap concurrency at three, which is enough for the current pipeline (integration-test + mutation-python + one spare).

---

## Why `flock` With an Explicit File Descriptor

`flock` is the POSIX advisory lock. The naive usage looks like:

```bash
flock /tmp/sira-sb/slot-0.lock -c "my_command"
```

That releases the lock when `my_command` exits. Problem: we want the lock to persist across the whole job, not just one command. Supabase CLI spins up Docker containers in `npx supabase start`, then pytest runs against those containers, then `npx supabase stop` tears them down in the `after_script`. That is dozens of commands across two CI stages. `flock -c` cannot hold the lock that long without blocking the whole job on one command.

The solution is `flock <FD>` where the file descriptor stays open in the shell. As long as the FD is open, the lock is held. When the shell exits, the kernel closes the FD and releases the lock.

```bash
exec {SLOT_FD}>"$SLOT_DIR/slot-$s.lock"
if flock -n "$SLOT_FD"; then
  SUPABASE_SLOT=$s
  return 0
fi
```

`exec {SLOT_FD}>...` opens a file and assigns a fresh FD number into the variable `SLOT_FD`. This is a bash-specific feature — POSIX sh does not support automatic FD allocation. Without it, the script would have to hardcode an FD number (say 9) and hope nothing else in the environment uses it.

`flock -n` tries to acquire non-blockingly. If slot 0 is busy, it returns failure, and the loop tries slot 1. First free wins.

---

## The Subshell Bug I Had to Fix (Commit `00bfa6ea`)

My first version of `acquire_slot` looked tidy enough that I called it inside command substitution:

```bash
SUPABASE_SLOT=$(acquire_slot)
```

Reading the value out and assigning it in one line felt clean. It also silently broke everything. Command substitution spawns a subshell. Every side effect of the function — including `exec {SLOT_FD}>...` — happens inside that subshell. When the subshell exits, its FDs close, and the lock releases immediately.

The symptom was a slot that appeared to acquire successfully but was actually no longer locked. Two jobs on different slots would acquire slot 0 "successfully" at the same time. I only caught it when I saw two parallel Supabase stacks both trying to claim port 54321.

The fix was to call the function directly in the caller's scope:

```bash
acquire_slot  # No command substitution. Side effects persist.
export SUPABASE_SLOT
```

The function now communicates its result by setting a shell variable (`SUPABASE_SLOT`) rather than echoing a value. Less elegant to read, but correct. A comment above the function records why:

```bash
# Assigns SUPABASE_SLOT and SLOT_FD in the caller's shell. MUST be called directly
# (not via command substitution) so exec {SLOT_FD} opens the FD in the caller's scope,
# preserving the flock across the remainder of the script.
```

This is the kind of comment the "no comments" rule correctly allows: the *why* is non-obvious, and a future reader who refactors this back into a command-substitution call would reintroduce the bug.

---

## Trap-Based Cleanup

The next defensive layer is the `EXIT` trap:

```bash
cleanup_slot() {
  local exit_code=$?
  set +e
  if [ -d "${SUPABASE_WORKDIR:-}" ]; then
    (cd "$SUPABASE_WORKDIR" && npx supabase stop --no-backup --project-id "$SUPABASE_PROJECT_ID" 2>/dev/null) || true
    rm -rf "$SUPABASE_WORKDIR"
  fi
  return $exit_code
}
trap cleanup_slot EXIT
```

Three things are doing work here:

**`local exit_code=$?` first.** The `$?` variable gets clobbered by any command that follows. Capturing it before anything else runs means the trap preserves the script's actual exit code and returns it at the end, so the CI job fails if the underlying test run failed.

**`set +e` before the cleanup.** The script runs with `set -euo pipefail`. If `npx supabase stop` errors (container already gone, Docker unreachable), the trap itself would exit early and leave the stage dir on disk. Relaxing `errexit` inside the trap means every cleanup step runs regardless.

**`trap` registered BEFORE `npx supabase start`.** If the `start` command fails halfway through (half-started containers), the trap still fires and stops whatever containers did come up. Registering the trap after the start call would leak containers on start failure.

The flock FD does not need explicit cleanup. It releases automatically when the shell exits, which happens after the EXIT trap returns.

---

## Port Arithmetic and `sed`-Patched Config

Port numbers come from slot index:

```bash
PORT_OFFSET=$((SUPABASE_SLOT * 100))
export SUPABASE_API_PORT=$((54321 + PORT_OFFSET))
export SUPABASE_DB_PORT=$((54322 + PORT_OFFSET))
export SUPABASE_STUDIO_PORT=$((54323 + PORT_OFFSET))
```

An offset of 100 per slot means slots are spaced well clear of each other. 10 would work too, but 100 leaves room for future internal services (auth on 54324, storage on 54325) without needing to widen the offset later.

The Supabase CLI reads ports from `supabase/config.toml`. Patching that file per-slot is done with `sed`:

```bash
sed -i \
  -e "s|^project_id = \".*\"|project_id = \"$SUPABASE_PROJECT_ID\"|" \
  -e "s|^port = 54321\$|port = $SUPABASE_API_PORT|" \
  -e "s|^port = 54322\$|port = $SUPABASE_DB_PORT|" \
  -e "s|^port = 54323\$|port = $SUPABASE_STUDIO_PORT|" \
  "$CONFIG"
```

The `^port = 54321\$` anchors matter. Without them, any port value that happens to contain `54321` as a substring would match. A comment warns that if new port fields are added to `config.toml`, this block needs extending:

```bash
# Current supabase/config.toml has exactly three port fields (54321/54322/54323).
# If new port fields are added later, extend the sed block below.
```

Patching over a full TOML parser was the right tradeoff here. A real TOML parser would add a Python dependency for a script that runs inside a minimal CI environment. `sed` is already there.

---

## Orphan Port Cleanup

If a prior job crashed without firing its EXIT trap (e.g., runner killed with SIGKILL), containers may be left listening on the slot's ports. Before starting new containers, the script best-effort kills any listeners:

```bash
for p in "$SUPABASE_API_PORT" "$SUPABASE_DB_PORT" "$SUPABASE_STUDIO_PORT"; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done
```

`fuser -k` sends SIGKILL to processes holding the port. `|| true` ensures the loop continues if no process holds the port (the expected case on a healthy runner).

The initial version only swept the 3 known ports. When the script hit production CI, we discovered a 4th: Supabase starts `inbucket` (an SMTP testing server) on port 54324 by default, which is not listed in `config.toml` and was not in our `--exclude` list. Two slots both tried to bind it. The fix was two-fold: add `inbucket` to `--exclude` in the Supabase start command, and extend the port sweep to include 54324.

---

## Three More Bugs the CI Runner Found

The initial 4-commit version of the script worked in theory. The CI runner found three more issues that required defensive additions:

**Cross-user permissions.** The `/tmp/sira-sb/` directory was created during a manual smoke test as `ubuntu`. When the `gitlab-runner` user tried to write lock files there, permission denied. Fix: `chmod 1777` on the directory (sticky bit preserves per-user ownership) and `umask 000` before creating files so any user on the runner can claim slots.

**Orphan containers from unknown project IDs.** A Supabase stack from a prior run (`lalvvkkgycwrliipqufv`, not matching any of our `sira-0`/`sira-1`/`sira-2` project IDs) was squatting on ports 54321 through 54324. The `fuser -k` port sweep already handled this, but the initial `npx supabase stop` used `--project-id` which only stops containers matching that specific project. Orphans with different project IDs survived. Fix: also `docker rm -f` any container listening on the slot's ports, regardless of project name.

**Inbucket port collision (described above).** Supabase silently starts services not listed in `config.toml`. The `--exclude` flag is the only way to prevent them, and the list of excludable services is not well-documented. Each new collision requires reading the error log and adding the service name.

These three bugs share a pattern: they only surface in multi-user, multi-run CI environments with persistent state across pipeline runs. None are reproducible on a clean local machine. The script grew from 92 to 110 lines, with every addition defending against a real failure mode observed on the Nashta runner.

---

## Results

Moving `mutation:python` and `api:integration-test` to this script removed `resource_group: supabase-local` from both. The jobs now run in parallel, each on its own slot, each with its own workdir, each cleaning up after itself. CI pipeline duration dropped by approximately the wait time that used to sit on the slower of the two jobs.

| Principle | How It Shows Up |
|-----------|----------------|
| Single Responsibility | The script does one thing: claim a slot and export env vars. Job-specific logic stays in `.gitlab-ci.yml` |
| Fail-safe defaults | `set -euo pipefail` + trap + `\|\| true` on best-effort ops. Either succeeds cleanly or leaves nothing behind |
| Deterministic state | Slot index → port triple via arithmetic. No randomness, no hashing |
| Explicit over implicit | Every tricky bash idiom has a comment explaining the *why* (FD subshell rule, trap ordering, sed anchors) |

---

## Evidence

- MR !197 — [SIRA-274](https://linear.app/ppl-sira/issue/SIRA-274): parallel Supabase stacks for CI (squash-merged as `f6c2d0cb`)
- MR !198 — disposable test MR to verify concurrent slot allocation (opened, verified, closed)
- Pipeline 15028 — all green: `api:integration-test` 1m59s, `mutation:python` 4m36s
- Source: `scripts/ci-supabase-slot.sh` (110 lines), `.gitlab-ci.yml`
