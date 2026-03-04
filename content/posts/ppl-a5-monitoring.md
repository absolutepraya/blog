---
title: "PPL: Platform Monitoring - GlitchTip, Sentry SDK, and Structured Logging"
date: 2026-03-05
description: "How SIRA monitors three services (FastAPI, Celery, React) with a self-hosted GlitchTip deployment, Sentry SDK integration, and structured JSON HTTP access logging."
tags: ["ppl", "monitoring", "sentry", "glitchtip", "devops"]
toc: true
---

## Why Self-Hosted

Sentry's free tier allows **one team member**. With five engineers needing access to error dashboards for IR evidence, the project needed a multi-user alternative.

**Decision (SIRA-59):** [GlitchTip](https://glitchtip.com) — an open-source, self-hosted error tracker that is **Sentry SDK-compatible**. Zero code migration: the same `sentry-sdk` and `@sentry/react` packages that were already integrated continue to work, just pointed at a different DSN.

The idea and architectural decision were mine. A teammate ([MR !33](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/33)) implemented the Docker services.

## GlitchTip Deployment

Three services in `infra/docker-compose.yml`, co-deployed alongside the main application:

```mermaid
graph LR
    subgraph app [Application Stack]
        A[api :8000]
        W[worker]
        B[beat]
    end

    subgraph glitchtip [GlitchTip Stack]
        GP[glitchtip-postgres]
        GW[glitchtip-web :8080]
        GWK[glitchtip-worker]
    end

    R[redis]

    A -->|DB 0| R
    W -->|DB 0| R
    GW -->|DB 1| R
    GWK -->|DB 1| R
    GW --- GP
    GWK --- GP
```

Redis uses **separate databases** — DB 0 for the application Celery broker, DB 1 for GlitchTip's Celery worker. No contention between application jobs and monitoring event processing.

GlitchTip is exposed on port 8080 and reverse-proxied via Nginx.

## Sentry SDK Integration

Three services instrumented. Each initialized independently so failures in one don't affect the others.

**FastAPI** (`apps/api/src/app/main.py`):

```python
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=1.0,
        environment=settings.environment,
        send_default_pii=False,
    )
```

Captures: unhandled exceptions with request context, performance transactions per endpoint. `send_default_pii=False` prevents JWT tokens and request bodies from leaking into error reports.

**Celery worker** (`apps/api/src/app/workers/celery_app.py`):

```python
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=1.0,
        environment=settings.environment,
    )
```

Captures: failed tasks with retry count and exception chain, task duration as performance transactions.

**React frontend** (`apps/web/src/main.tsx`):

```tsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
})
```

Plus an `ErrorBoundary` in `apps/web/src/components/error-boundary.tsx` that catches React render crashes and reports them instead of showing a blank screen.

When `SENTRY_DSN` / `VITE_SENTRY_DSN` is empty, the SDK is a complete no-op with zero overhead.

## Structured JSON Logging (SIRA-70)

`LoggingMiddleware` in `apps/api/src/app/middleware/logging.py` logs every HTTP request as structured JSON:

```json
{
  "timestamp": "2026-03-04T08:23:11.432Z",
  "level": "INFO",
  "method": "POST",
  "path": "/api/payments/",
  "status": 201,
  "duration_ms": 47.3,
  "request_body": { "amount_paid": 1500000, "payment_date": "2026-03-04" },
  "response_body": { "id": "abc123", "status": "PARTIAL" }
}
```

This enables structured latency analysis — filter by `path` to find slow endpoints, correlate `status` with `duration_ms` to identify timeout patterns. Configurable log level via `LOG_LEVEL` env var.

Source: `apps/api/src/app/middleware/logging.py`, [MR !37](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37)

## Evidence

- [MR !33 - SIRA-59 GlitchTip](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/33)
- [MR !37 - SIRA-70 Structured logging](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37)
- [Linear SIRA-59](https://linear.app/ppl-sira/issue/SIRA-59)
- [Linear SIRA-70](https://linear.app/ppl-sira/issue/SIRA-70)
- Source: `apps/api/src/app/main.py`, `workers/celery_app.py`, `middleware/logging.py`, `infra/docker-compose.yml`
