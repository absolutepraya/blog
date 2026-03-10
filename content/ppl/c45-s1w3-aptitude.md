---
title: "PPL: New Learnings Applied -- Nginx, SMTP Alerting, Migration Validation, and More"
date: 2026-03-10
description: "Seven new technologies and concepts learned outside standard coursework and applied directly to the SIRA project during Sprint 1 Week 3."
tags: ["ppl", "aptitude", "learning", "devops", "infrastructure"]
toc: true
---

## Overview

Sprint 1 Week 3 (Mar 4--10) was infrastructure-heavy. The project needed production-grade tooling that goes well beyond standard coursework: reverse proxies, email alerting, migration safety nets, security scanning, structured logging, and AI-integrated code quality analysis. Each of these required learning a new technology from scratch and applying it directly to the project.

---

## 1. Nginx Reverse Proxy for Subdomain Routing

SIRA runs three services on a single Nashta VM, each needing its own subdomain:

- `sira.nashtagroup.co.id` -- web frontend
- `sira-api.nashtagroup.co.id` -- FastAPI backend
- `sira-glitchtip.nashtagroup.co.id` -- error monitoring

Instead of exposing multiple ports, I configured Nginx as a reverse proxy that routes based on `Host` header:

```nginx
server {
    server_name sira.nashtagroup.co.id;
    location / {
        proxy_pass http://web:80;
    }
}

server {
    server_name sira-api.nashtagroup.co.id;
    location / {
        proxy_pass http://api:8000;
    }
}

server {
    server_name sira-glitchtip.nashtagroup.co.id;
    location / {
        proxy_pass http://glitchtip-web:8080;
    }
}
```

This is not taught in any Fasilkom course. I learned Nginx proxy configuration, Docker networking (containers communicating via service names), and DNS setup from scratch.

**Evidence:**
- [MR !44 -- Nginx reverse proxy](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/44)
- [Linear SIRA-57](https://linear.app/ppl-sira/issue/SIRA-57)

---

## 2. Resend SMTP for GlitchTip Email Alerting

GlitchTip (our self-hosted error monitoring) needed email alerts so the team gets notified when production errors occur. I integrated Resend -- a third-party transactional email service -- as the SMTP relay.

Setup involved:
- Configuring Resend SMTP credentials in GlitchTip's Docker environment
- Verifying the sender domain for deliverability
- Testing end-to-end: trigger error in production, verify GlitchTip captures it, verify email alert arrives

The team can now receive email notifications for production errors without manually checking the GlitchTip dashboard.

**Evidence:**
- [MR !39 -- GlitchTip email alerting](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/39)
- [Linear SIRA-75](https://linear.app/ppl-sira/issue/SIRA-75)

---

## 3. Supabase Migration Dry-Run Validation in CI

After a deployment broke because of out-of-order migration timestamps, I created a CI job that validates migrations on every MR before merge:

```yaml
migrate:check:
  stage: ci
  script:
    - supabase db push --dry-run
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

`supabase db push --dry-run` simulates applying pending migrations without actually touching the database. If timestamps conflict or SQL is invalid, the MR pipeline fails before it can reach `main`.

This concept -- dry-run validation as a CI gate -- is not standard coursework. I learned it from Supabase CLI docs and applied it to prevent the exact class of deployment failures we experienced.

**Evidence:**
- [MR !67 -- migration dry-run CI](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/67)
- [Linear SIRA-98](https://linear.app/ppl-sira/issue/SIRA-98)

---

## 4. CI/CD Migration Rollback with `supabase migration repair`

Production migrations can fail. I implemented a manual rollback mechanism in the CI pipeline:

1. Each forward migration has a corresponding rollback file with inverse SQL
2. The CI `migrate:rollback` job (manual trigger) executes the rollback SQL
3. `supabase migration repair --status reverted` marks the migration as rolled back in Supabase's migration history

This went through an iteration: initially I made ALL migrations manual-trigger (MR !41), then realized that was too conservative -- auto-migrate on deploy with manual rollback only (MR !42) was the right tradeoff.

```
supabase/migrations/
  20260310000000_add_feature.sql                    # Forward
  rollbacks/20260310000000_add_feature.rollback.sql # Reverse DDL
```

**Evidence:**
- [MR !41 -- manual trigger & rollback](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/41)
- [MR !42 -- restore auto-migrate](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/42)
- [Linear SIRA-76](https://linear.app/ppl-sira/issue/SIRA-76)

---

## 5. Bandit (Python SAST) + pnpm audit in CI

I added static application security testing directly into the GitLab CI pipeline:

- **Bandit** scans Python source code for common security vulnerabilities (SQL injection, hardcoded passwords, insecure function usage)
- **pnpm audit** scans JavaScript dependencies for known CVEs

Both run automatically on every MR and merge to `main`. If either finds issues, the pipeline reports them (currently as warnings, with plans to block on critical findings).

```yaml
security:sast:
  stage: ci
  script:
    - uv run bandit -r apps/api/src/ -f json -o bandit-report.json || true
    - pnpm --dir apps/web audit --audit-level=high || true
```

**Evidence:**
- [MR !38 -- security SAST job](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/38)
- [Linear SIRA-71](https://linear.app/ppl-sira/issue/SIRA-71)

---

## 6. Structured JSON HTTP Access Logging Middleware

Standard `print()` or `logging.info()` statements produce unstructured text that is hard to query in production. I built a custom FastAPI middleware that logs every HTTP request/response as structured JSON:

```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration_ms, 2),
        client=request.client.host if request.client else None,
    )
    return response
```

Each log line is a JSON object with `method`, `path`, `status`, `duration_ms`, and `client` fields -- queryable, filterable, and ready for production observability tools.

**Evidence:**
- [MR !37 -- structured HTTP access logging](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37)
- [Linear SIRA-70](https://linear.app/ppl-sira/issue/SIRA-70)

---

## 7. SonarQube MCP Server for AI-Integrated Code Quality

I set up SonarQube as an MCP (Model Context Protocol) server for Claude Code, the AI assistant used in development. This allows the AI to directly query code quality metrics, issues, and coverage from SonarQube during development sessions -- bridging AI tooling with code quality infrastructure.

This is a novel integration: most teams use SonarQube as a standalone dashboard. By making it accessible to the AI agent, code quality checks happen inline during development, not as an afterthought.

**Evidence:**
- [Linear SIRA-60](https://linear.app/ppl-sira/issue/SIRA-60)

---

## Evidence

- [MR !37](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37) -- structured HTTP access logging
- [MR !38](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/38) -- security SAST CI job
- [MR !39](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/39) -- GlitchTip email alerting
- [MR !41](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/41) -- migration rollback CI
- [MR !42](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/42) -- restore auto-migrate
- [MR !44](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/44) -- Nginx reverse proxy
- [MR !67](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/67) -- migration dry-run CI
- [Linear SIRA-57](https://linear.app/ppl-sira/issue/SIRA-57), [SIRA-60](https://linear.app/ppl-sira/issue/SIRA-60), [SIRA-70](https://linear.app/ppl-sira/issue/SIRA-70), [SIRA-71](https://linear.app/ppl-sira/issue/SIRA-71), [SIRA-75](https://linear.app/ppl-sira/issue/SIRA-75), [SIRA-76](https://linear.app/ppl-sira/issue/SIRA-76), [SIRA-98](https://linear.app/ppl-sira/issue/SIRA-98)
