---
title: "[S2, W3] PPL: Separation of Concerns, Feature Code to Infra"
date: 2026-04-15
description: "Two weeks showing the same principle at different scales: pure-function + DI separation in application features (invoice number generation, auth on GET endpoints) AND the same isolation discipline in a 110-line bash script that claims one of three Supabase slots per CI job. SRP is not only for business logic."
tags: ["ppl", "programming", "solid", "bash", "ci"]
slug: s2w3-programming
toc: true
---

## What I Worked On

Two weeks of work that ended up demonstrating the same principle at two very different scales. In the application code: isolating invoice number generation as a pure function (SIRA-123, MR !130) and composing authentication onto GET endpoints via FastAPI dependency injection (SIRA-82, MR !154). In the infrastructure: designing `scripts/ci-supabase-slot.sh` (SIRA-274, MR !197) — a 110-line bash script that claims one of three parallel Supabase stacks and hands back an isolated environment to the caller. Different problem domains, same discipline: give each unit of code one reason to change.

---

## Feature Code: Invoice Number Generation as a Pure Function

Before SIRA-123, invoice numbers were either manually entered or generated ad hoc inside the invoice service. The new system generates them automatically in a dedicated module: `apps/api/src/app/lib/invoice_number.py`.

The format is `INV-{CLIENT_CODE}-YYYYMM-NNN`, where `NNN` is a zero-padded sequence number. For a client with code `TELK`, February 2026 invoices become `INV-TELK-202602-001`, `INV-TELK-202602-002`, and so on.

The signature makes the responsibilities explicit:

```python
def generate_invoice_number(
    client_code: str,
    month: date,
    existing_numbers: list[str],
) -> str:
```

No database. No HTTP. No side effects. The function takes existing numbers as a parameter rather than querying them itself, which means its entire behavior is determined by its inputs. This is SRP applied at function level: the function's only job is to compute the next number, not to know how numbers are stored or retrieved.

The implementation scans existing numbers for the highest sequence in the given client+month prefix, then increments:

```python
prefix = f"INV-{client_code}-{month.strftime('%Y%m')}-"
max_seq = 0
for number in existing_numbers:
    if number.startswith(prefix):
        try:
            seq = int(number[len(prefix) :])
            if seq > max_seq:
                max_seq = seq
        except ValueError:
            _logger.warning(
                "Invoice number %r has non-numeric sequence suffix; skipping", number
            )
next_seq = max_seq + 1
if next_seq > 999:
    raise ValueError(f"Invoice sequence overflow for {client_code} in {month.strftime('%Y%m')}")
return f"{prefix}{next_seq:03d}"
```

The `ValueError` on overflow is deliberate. If a client somehow generates 999 invoices in a single month, that is a data quality problem that should surface immediately rather than silently wrap or produce a malformed number.

Because the function is pure, tests require no mocking:

```python
def test_generate_raises_on_sequence_overflow() -> None:
    existing = [f"INV-TELK-202603-{i:03d}" for i in range(1, 1000)]
    with pytest.raises(ValueError, match="Invoice sequence overflow"):
        generate_invoice_number("TELK", date(2026, 3, 1), existing)
```

The invoice service calls this function after fetching existing numbers from the DB. DB concern stays in the service; computation concern stays in the lib module.

---

## Feature Code: Auth Composition via Dependency Injection

SIRA-82 (MR !154) fixed a gap: the `GET /api/clients/` and `GET /api/clients/{id}` endpoints had no authentication check. Any unauthenticated HTTP request could list all clients.

The fix adds `Depends(get_current_user)` to both handlers:

```python
@router.get("/")
async def list_clients(
    _user: AuthenticatedUser = Depends(get_current_user),
    service: ClientService = Depends(_get_service),
) -> list[ClientResponse]:
    return await service.list_clients()
```

Two things worth naming:

**The underscore prefix on `_user`** signals that the dependency is validated but the resolved value is not used in the handler body. FastAPI still calls `get_current_user()` and raises 401 if it fails. The underscore is the Python convention for "this variable exists for its side effect." Cleaner than `user` with a `# unused` comment.

**No business logic changes.** The auth check is injected as a dependency, completely separate from the service call. Adding authentication to these endpoints required zero changes to `ClientService` or the DB queries. The router composes two concerns (auth and data retrieval) without mixing them. Write operations use `require_admin` via the same pattern, so adding a new role check is a one-line swap at the router level:

```python
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    _admin: AuthenticatedUser = Depends(require_admin),  # admin only
    ...
```

Composition over modification: the classic OCP shape. The service and queries don't know about auth at all; the router layers it on.

---

## Infra: The Same Principle in Bash

The week after, I wrote `scripts/ci-supabase-slot.sh` for SIRA-274. Before this script, the CI pipeline had `mutation:python` and `api:integration-test` jobs both using `resource_group: supabase-local` to prevent running at the same time. Serialization was the cheap fix for port conflicts on 54321. The cost was CI latency.

The script replaces serialization with slot-based isolation. Three slots, each with its own project ID (`sira-0`, `sira-1`, `sira-2`), each with its own port triple (54321/54322/54323 for slot 0; 54421/54422/54423 for slot 1; +100 per slot), each with its own workdir under `/tmp/sira-sb/sira-N/`. Any CI job can claim a free slot, get exclusive ownership, and release on exit.

The script does one thing: claim a slot and export the env vars the caller needs. Job-specific logic (running tests, running mutmut) stays in `.gitlab-ci.yml`. Same SRP principle as `generate_invoice_number` — single responsibility, composable by callers.

---

## The Core Problem: Port Reuse Without Races

Three approaches considered for port assignment:

| Approach | Problem |
|----------|---------|
| Random port per run | Collisions become random flakes; debugging requires log-diving |
| Hash of CI job ID → port | Still collides eventually with enough jobs |
| Slot file with `flock` | Exclusive lock per slot, port determined by slot index, predictable |

The slot approach won because port assignment is deterministic given the slot, and `flock` gives OS-level mutual exclusion. Three slots cap concurrency at three, which is enough for the current pipeline (integration-test + mutation-python + one spare).

---

## Why `flock` With an Explicit File Descriptor

The naive `flock` usage is:

```bash
flock /tmp/sira-sb/slot-0.lock -c "my_command"
```

That releases the lock when `my_command` exits. Problem: we want the lock held across the whole CI job, not just one command. Supabase CLI spins up Docker containers in `npx supabase start`, pytest runs against them, then `npx supabase stop` tears them down. Dozens of commands across two CI stages. `flock -c` cannot hold the lock across that without blocking everything on one long command.

The solution is `flock <FD>` where the file descriptor stays open in the shell. As long as the FD is open, the lock is held. When the shell exits, the kernel closes the FD and releases the lock.

```bash
exec {SLOT_FD}>"$SLOT_DIR/slot-$s.lock"
if flock -n "$SLOT_FD"; then
  SUPABASE_SLOT=$s
  return 0
fi
```

`exec {SLOT_FD}>...` opens a file and assigns a fresh FD number into the variable `SLOT_FD`. Bash-specific feature; POSIX sh does not support automatic FD allocation. Without it, the script would have to hardcode an FD number (say 9) and hope nothing else uses it.

`flock -n` tries to acquire non-blockingly. If slot 0 is busy, returns failure, the loop tries slot 1. First free wins.

---

## The Subshell Bug (Commit `00bfa6ea`)

The first version of `acquire_slot` looked tidy enough that I called it inside command substitution:

```bash
SUPABASE_SLOT=$(acquire_slot)
```

Reading the value out and assigning it in one line felt clean. It also silently broke everything. Command substitution spawns a subshell. Every side effect of the function — including `exec {SLOT_FD}>...` — happens inside that subshell. When the subshell exits, its FDs close, and the lock releases immediately.

The symptom: a slot that appeared to acquire successfully but was no longer locked. Two jobs on different slots would both claim slot 0 at the same time. I only caught it when I saw two parallel Supabase stacks both trying to bind port 54321.

The fix changed the calling convention — the function sets a shell variable rather than echoing a value:

```bash
acquire_slot  # No command substitution. Side effects persist.
export SUPABASE_SLOT
```

Less elegant to read, but correct. A comment records why:

```bash
# Assigns SUPABASE_SLOT and SLOT_FD in the caller's shell. MUST be called directly
# (not via command substitution) so exec {SLOT_FD} opens the FD in the caller's scope,
# preserving the flock across the remainder of the script.
```

This is the kind of comment the "no comments" rule correctly allows: the *why* is non-obvious, and a future refactor that re-applies command substitution would reintroduce the bug.

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

Three things doing work here:

**`local exit_code=$?` first.** `$?` gets clobbered by any command that follows. Capturing it before anything else runs means the trap preserves the script's actual exit code — so the CI job correctly fails if the underlying test run failed.

**`set +e` before cleanup.** The script runs with `set -euo pipefail`. If `npx supabase stop` errors (container already gone), the trap itself would exit early and leave state on disk. Relaxing `errexit` inside the trap ensures every cleanup step runs.

**`trap` registered BEFORE `npx supabase start`.** If the start command fails halfway through (half-started containers), the trap still fires and stops whatever came up. Registering the trap after start would leak containers on start failure.

The flock FD does not need explicit cleanup — it releases automatically when the shell exits after the EXIT trap returns.

---

## Bugs the CI Runner Found

The initial 4-commit version worked in theory. The CI runner found three more issues that required defensive additions:

**Cross-user permissions.** `/tmp/sira-sb/` was created by `ubuntu` during a manual smoke test. When `gitlab-runner` tried to write lock files there, permission denied. Fix: `chmod 1777` on the directory (sticky bit preserves per-user ownership of contained files) and `umask 000` before creating files so any user on the runner can claim slots.

**Orphan containers from unknown project IDs.** A Supabase stack from a prior run (`lalvvkkgycwrliipqufv`, not matching any of our `sira-N` project IDs) was squatting on ports 54321 through 54324. The `fuser -k` port sweep handled the process side, but `npx supabase stop --project-id` only stops containers matching that project name. Orphans with different project IDs survived. Fix: also `docker rm -f` any container listening on the slot's ports, regardless of project name.

**Inbucket port collision.** Supabase silently starts an SMTP testing server on port 54324 by default, not listed in `config.toml` and not in our `--exclude` list. Two slots both tried to bind it. Fix: add `inbucket` to the Supabase start `--exclude` flags, and extend the port sweep to 54324.

These three share a pattern: they only surface in multi-user, multi-run CI environments with persistent state across pipeline runs. None reproduce on a clean local machine. The script grew from 92 to 110 lines, with every addition defending against a real failure mode observed on the Nashta runner.

---

## Common Thread

The features and the bash script share one design principle: each piece of code has one reason to change.

- `generate_invoice_number` changes only if the invoice number format changes, not if storage changes.
- `get_current_user` dependency changes only if the auth mechanism changes, not if a handler's business logic changes.
- `ci-supabase-slot.sh` changes only if slot allocation logic changes, not if what any CI job does while holding a slot changes.

| Piece | Scope | Responsibility |
|-------|-------|----------------|
| `generate_invoice_number()` pure function | App logic | Compute the next number from inputs |
| `Depends(get_current_user)` DI | Router | Validate auth, produce `AuthenticatedUser` |
| `ci-supabase-slot.sh` | Bash/CI | Claim a slot, export env vars, release on exit |

Three very different layers of the stack. Same discipline.

---

## Evidence

- MR !130 — [SIRA-123](https://linear.app/ppl-sira/issue/SIRA-123): auto-generate invoice number with client code
- MR !154 — [SIRA-82](https://linear.app/ppl-sira/issue/SIRA-82): add auth to GET client API endpoints
- MR !197 — [SIRA-274](https://linear.app/ppl-sira/issue/SIRA-274): parallel Supabase stacks for CI (squash-merged as `f6c2d0cb`)
- MR !198 — disposable test MR to verify concurrent slot allocation (opened, verified, closed)
- Pipeline 15028 (post-merge): all green, `api:integration-test` 1m59s, `mutation:python` 4m36s
- Source: `apps/api/src/app/lib/invoice_number.py`, `apps/api/src/app/routers/clients.py`, `scripts/ci-supabase-slot.sh` (110 lines), `.gitlab-ci.yml`
