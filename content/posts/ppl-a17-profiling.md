---
title: "PPL: Profiling and Performance - Tracing, Structured Logging, and Query Optimization"
date: 2026-03-05
description: "Using Sentry SDK as a distributed tracer, structured JSON logs for latency analysis, PostgREST join queries to avoid N+1 patterns, and TanStack Query caching."
tags: ["ppl", "profiling", "performance", "fastapi", "python"]
toc: true
---

## Sentry as a Distributed Tracer

`traces_sample_rate=1.0` is set in both the FastAPI app and the Celery worker — 100% of requests and tasks are traced.

**FastAPI** (`apps/api/src/app/main.py`):

```python
sentry_sdk.init(
    dsn=settings.sentry_dsn,
    traces_sample_rate=1.0,
    environment=settings.environment,
    send_default_pii=False,
)
```

**Celery** (`apps/api/src/app/workers/celery_app.py`):

```python
sentry_sdk.init(
    dsn=settings.sentry_dsn,
    traces_sample_rate=1.0,
    environment=settings.environment,
)
```

The GlitchTip performance dashboard shows p50/p95 latency per endpoint and task duration over time. Spikes in `check_overdue_invoices` or `send_reminder` tasks are visible before they become user-facing issues.

## Structured Access Logs for Latency Analysis

`LoggingMiddleware` (SIRA-70, `apps/api/src/app/middleware/logging.py`) emits one JSON record per request:

```json
{
  "timestamp": "2026-03-04T08:23:11.432Z",
  "method": "POST",
  "path": "/api/payments/",
  "status": 201,
  "duration_ms": 47.3
}
```

Unlike uvicorn's plain-text access log, this format is filterable. Finding the slowest endpoints:

```bash
# top 10 slowest paths by average duration
docker logs sira-api | jq -s '
  group_by(.path) |
  map({path: .[0].path, avg_ms: (map(.duration_ms) | add / length)}) |
  sort_by(-.avg_ms) | .[0:10]
'
```

Source: [MR !37](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37), [Linear SIRA-70](https://linear.app/ppl-sira/issue/SIRA-70)

## PostgREST Joins — No N+1

The Supabase Python client supports embedded resources via PostgREST's `select` syntax. All queries that need related data use this pattern to fetch everything in one round-trip:

```python
# payments.py — invoice_number joined in one query
async def get_all_payments(db: Client) -> list[dict[str, Any]]:
    response = db.table("payments").select("*, invoices(invoice_number)").execute()
    return cast(list[dict[str, Any]], response.data)

# invoices.py — company_name joined in one query
async def get_overdue_invoices(db: Client) -> list[dict[str, Any]]:
    response = (
        db.table("invoices")
        .select("*, clients(company_name)")
        .eq("status", "OVERDUE")
        .execute()
    )
    return cast(list[dict[str, Any]], response.data)
```

This directly addresses the N+1 pattern flagged in code review ([MR !12, issue #5](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12#note_4383)): a teammate's `PaymentHistory` component was fetching all payments globally and filtering client-side. The fix used `InvoiceDetail.payments` already present in the parent query.

## Frontend Caching

TanStack Query is configured with `staleTime: 1000 * 60` (1 minute) in `apps/web/src/lib/api.ts`. Data fetched within the last minute is returned from cache without a network request. For a dashboard showing invoice and payment lists that don't change per-second, this eliminates redundant API calls on every tab focus or component remount.

## Evidence

- [MR !37 - SIRA-70 structured logging](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37)
- [Linear SIRA-70](https://linear.app/ppl-sira/issue/SIRA-70)
- Source: `apps/api/src/app/main.py`, `middleware/logging.py`, `db/queries/payments.py`, `db/queries/invoices.py`, `apps/web/src/lib/api.ts`
