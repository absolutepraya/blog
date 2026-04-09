---
title: "PPL: New Learnings Applied to SIRA [Sprint 2, Week 1]"
date: 2026-03-30
description: "Six new technologies and concepts learned outside standard coursework and applied directly to SIRA during Sprint 2 Week 1: session management, user-agent parsing, Jinja2 email templating, CodeMirror, workspace isolation, and API schema hardening."
tags: ["ppl", "aptitude", "learning", "session-management", "email", "devops"]
slug: s2w1-aptitude
toc: true
---

## Overview

Sprint 2 Week 1 (Mar 24 to 30) combined feature development with infrastructure hardening. The week produced two full-stack features (multi-device session management and email integration), a developer tooling improvement (Superset workspace isolation), and iterative CI quality gate improvements. Each required learning at least one technology from scratch.

---

## 1. Multi-Device Session Management

SIRA needed per-device session tracking: users should see which devices are logged in, and admins should be able to revoke sessions remotely. This isn't a standard Supabase Auth feature; it required a custom session layer on top of the existing JWT auth.

### What I Learned

- **User-agent parsing** with the `user-agents` Python library. Parse raw UA strings into structured `{browser, os}` pairs for display on the Devices page.
- **JWT session binding**: embed a `session_id` claim into the JWT at login time, then validate it on every authenticated request. If the session is revoked, the next API call returns 401 and the frontend redirects to login.
- **Activity throttling**: updating `last_active_at` on every request would hammer the database. Instead, only update if the last activity was more than 5 minutes ago:

```python
ACTIVITY_THROTTLE_MINUTES = 5

async def _validate_and_track_session(db: Client, session_id: str) -> None:
    session = await get_session_by_session_id(db, session_id)
    if session is None:
        return
    if not session["is_active"]:
        raise HTTPException(status_code=401, detail="Session has been revoked")
    last_active = datetime.fromisoformat(session["last_active_at"])
    if datetime.now(UTC) - last_active > timedelta(minutes=ACTIVITY_THROTTLE_MINUTES):
        await update_last_active(db, session_id)
```

- **Session limit enforcement**: cap at 5 active sessions per user, evicting the oldest when a new login exceeds the limit. This prevents unlimited session accumulation without requiring manual cleanup.

### Implementation Scope

Full TDD across 4 layers: DB queries (8 tests), service (10 tests), router (7 tests), and auth dependency (8 tests), plus frontend tests for the Devices page and login session toast. The feature touched 24 files across both `apps/api` and `apps/web`.

The TDD commit history shows strict red-green discipline:
1. `red(api): add tests for user_sessions DB queries` → `green(api): implement user_sessions DB queries`
2. `red(api): add tests for session service` → `green(api): implement session service`
3. `red(api): add tests for session-aware get_current_user` → `green(api): add session validation and activity tracking`
4. `red(api): add tests for session router` → `green(api): implement session REST endpoints`

Each layer was tested before implementation, ensuring the interface contracts were defined by tests first.

**Evidence:**
- [MR !120](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/120)
- [Linear SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214)

---

## 2. Email Integration with Resend API and Jinja2

Built a complete email sending system: Resend as the transactional email provider, Jinja2 for server-side template rendering, and a settings page for managing templates.

### What I Learned

- **Resend API integration** via `httpx`. Resend's API is simpler than traditional SMTP: one POST request with JSON body, no connection pooling or TLS handshake management.
- **Jinja2 templating in FastAPI**: render HTML email templates with context variables (client name, invoice amount, due date). The `EmailTemplateService` handles CRUD for templates and rendering with variable substitution.
- **Email HTML is a different world**: `<table>` layout, inline styles, no CSS grid. Modern CSS features like flexbox and grid aren't supported by email clients (Outlook still uses Word's rendering engine). I had to exclude email templates from SonarQube analysis because web code quality rules don't apply to email HTML.
- **Template variable injection**: Jinja2's `Environment(autoescape=True)` prevents XSS in rendered HTML, but SonarQube's Bandit scanner flagged `Markup()` as a potential vulnerability (B704). The fix was a targeted `# nosec B704` suppression with a comment explaining why the input is safe (comes from sandboxed templates, not user input).

**Evidence:**
- [MR !108](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/108)
- [Linear SIRA-160](https://linear.app/ppl-sira/issue/SIRA-160)

---

## 3. CodeMirror Editor Integration

The email template editor needed syntax highlighting, line numbers, and a formatting toolbar. I integrated CodeMirror 6 into the React frontend.

### What I Learned

- **CodeMirror 6 architecture**: unlike v5, CodeMirror 6 is modular. You compose an editor from extensions (syntax highlighting, line numbers, keybindings). Each extension is a separate import.
- **React lifecycle issues with CodeMirror**: the editor div must exist in the DOM before CodeMirror mounts. When the component renders conditionally (behind a loading state), the editor initializes on an empty div and shows no content. Fix: defer CodeMirror initialization until the template data is loaded.
- **Active line highlighting and formatting toolbar**: added a sticky toolbar inside the editor border with bold/italic/link buttons that insert markup at the cursor position.

**Evidence:**
- [MR !110](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/110), [MR !111](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/111)

---

## 4. Toast Notification Audit

Audited all CRUD operations across the app and found inconsistent toast behavior: some mutations showed success/error toasts, others silently succeeded or failed. Created a standardized `getErrorMessage` utility that extracts readable error messages from API responses (handling different error shapes: string, object with `detail`, nested validation errors).

### What I Learned

- **Error shape normalization**: FastAPI can return errors in multiple formats (`{"detail": "string"}`, `{"detail": [{"msg": "...", "loc": [...]}]}`, or plain strings). A single utility that handles all shapes prevents each component from reinventing error extraction.
- **TanStack Query `onError`/`onSuccess` patterns**: centralized toast logic in the mutation hooks (`use-clients.ts`, `use-invoices.ts`, etc.) rather than in individual components. This way, every consumer of the hook gets consistent feedback.

**Evidence:**
- [MR !112](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/112)
- [Linear SIRA-131](https://linear.app/ppl-sira/issue/SIRA-131)

---

## 5. Superset Workspace Isolation

[Superset](https://superset.sh/) is a macOS app for isolated dev workspaces using git worktrees. Each developer gets their own workspace with persistent sessions. I configured it for the SIRA project, which required solving a non-trivial isolation problem: each workspace needs its own Redis, Supabase, and Celery instances on separate ports.

### What I Learned

- **Port block allocation**: each workspace gets a block of 10 ports (web+0, api+1, redis+2, supabase-api+3, supabase-db+4, studio+5, auth+6, inbucket+7). Port blocks are dynamically allocated based on available ranges.
- **Docker Compose profile isolation**: each workspace's infra services run in their own Docker Compose profile, preventing container name collisions across workspaces.
- **Worktree-aware database commands**: the `make db-*` commands needed to auto-detect which workspace they're running in and target the correct Supabase container. Fixed by checking `SUPERSET_WORKSPACE_NAME` and deriving the container name.

The challenge was making all of this transparent to the developer. After setup, `make dev` just works in any workspace without manual port configuration or container name management.

**Evidence:**
- [MR !116](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/116), [MR !119](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/119)
- [Linear SIRA-226](https://linear.app/ppl-sira/issue/SIRA-226)

---

## 6. Schema-Test CI Hardening

Iterated on the Schemathesis CI job through seven rounds of fixes (detailed in the [Part A QA blog]({{< ref "/ppl/part-a/a3-qa" >}})). Key new concepts learned:

- **JWT generation in CI**: generate valid test tokens using `PyJWT` so Schemathesis tests actual endpoint logic, not just auth rejection
- **Rate limiter bypass for test environments**: `ENVIRONMENT=test` disables the rate limiter so the fuzzer can fire rapid requests without getting 429s
- **UUID type validation in FastAPI**: changing path params from `str` to `UUID` gives you free input validation (422 instead of 500 for invalid UUIDs)

**Evidence:**
- [MR !107](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/107)
- Commits: `32ab3ce`, `155d856`, `450ce9f`

---

## 7. CI Reporting System (450+ Lines of Bash)

Built `ci-report.sh` from scratch: a shared bash script with 8 subcommands that parses output from pytest, vitest, vite build, schemathesis, bandit, pnpm audit, pytest-bdd, and SonarQube. Each parser extracts metrics from raw CI output and posts a formatted markdown table as an MR comment.

Key technical challenges solved:
- **ANSI escape code stripping**: `tee` captures raw terminal output with color codes (`\e[32m`). All regex parsing silently failed until I wrote `strip_ansi()` using `sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'`
- **SonarQube API exploration**: the `measures/component` endpoint returned 403 (insufficient privileges), so I designed a dual quality-gate fetch (PR gate + main branch gate) to show full metrics
- **Green/red collapsible UX**: HTML `<details>/<summary>` for passing results, expanded tables for failures

**Evidence:**
- [MR !126](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/126), [MR !132](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/132)
- [Linear SIRA-228](https://linear.app/ppl-sira/issue/SIRA-228), [SIRA-231](https://linear.app/ppl-sira/issue/SIRA-231)

---

## 8. PostgreSQL Connection Debugging

Connecting the CI runner to a staging Supabase project required solving a chain of infrastructure problems:
- **IPv4 vs IPv6**: Supabase direct connections are IPv6 only; VPS has no IPv6. Solution: use the Supavisor pooler (IPv4)
- **Pooler hostname**: documentation showed `aws-0-ap-southeast-1` but the actual host was `aws-1-ap-northeast-1` (different region numbering)
- **Password URL encoding**: special characters (`#`, `%`) in the DB password broke connection strings. Solution: `PGPASSWORD` env var instead of embedding in URL
- **PostgREST role grants**: after `DROP SCHEMA public CASCADE`, the `anon`/`authenticated`/`service_role` roles lose all table permissions. Fixed with `ALTER DEFAULT PRIVILEGES` before running migrations

**Evidence:**
- [MR !138](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/138)
- [Linear SIRA-224](https://linear.app/ppl-sira/issue/SIRA-224)

---

## 9. VPS Resource Analysis

Diagnosed OOM crashes on the 3.8GB VPS by mapping memory usage per process: Docker containers (~147MB total), dockerd (287MB), gitlab-runner (38MB). Found stale blue/green deployment containers consuming ~1GB unnecessarily. Drafted an upgrade proposal with specific recommendations (8GB RAM, 40GB disk).

**Evidence:**
- SSH session logs, `docker stats`, `free -h`, `ps aux --sort=-%mem`

---

## Evidence

- [MR !107](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/107): schema-test timeout and hardening
- [MR !108](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/108): email integration
- [MR !110](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/110), [!111](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/111): CodeMirror editor
- [MR !112](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/112): toast notification audit
- [MR !116](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/116), [!119](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/119): Superset workspace isolation
- [MR !120](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/120): multi-device session management
- [Linear SIRA-131](https://linear.app/ppl-sira/issue/SIRA-131), [SIRA-160](https://linear.app/ppl-sira/issue/SIRA-160), [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214), [SIRA-226](https://linear.app/ppl-sira/issue/SIRA-226)
