---
title: "PPL: Self-Hosted Error Monitoring with Custom Instrumentation"
date: 2026-04-11
description: "Why we self-hosted error monitoring instead of using Sentry Cloud, how custom performance spans on database queries and background tasks give visibility into what actually matters, and what alert rules catch before users notice."
tags: ["ppl", "monitoring", "sentry", "glitchtip", "observability", "devops"]
slug: monitoring
toc: true
---

Error monitoring is one of those things that feels optional until the first production bug slips through unnoticed. A user reports "the page is broken," you check the server, everything looks fine, and three hours later you discover a background task has been silently failing since the last deploy. This blog covers how we built monitoring that catches those failures before users do.

> **Note:** Our project is hosted on an internal GitLab instance, so we use the term **MR (Merge Request)** throughout this blog. If you're coming from GitHub, MRs are the equivalent of **Pull Requests (PRs)**.

## Why Self-Hosted Monitoring

Sentry is the industry standard for error tracking. It captures unhandled exceptions, attaches request context (method, path, status code), and groups similar errors into issues. The free tier works for solo developers, but it caps you at one team member.

In a university team of five engineers who all need access to error dashboards for individual assessment, that is a non-starter. We evaluated three options:

| Option | Cost | Multi-user | SDK Compatible | Self-Hosted |
|--------|:----:|:----------:|:--------------:|:-----------:|
| Sentry Cloud (Team) | Paid | Yes | Native | No |
| [GlitchTip](https://glitchtip.com/) | Free | Yes | Sentry SDK | Yes |
| Highlight.io | Free tier | Yes | Own SDK | Optional |

We chose GlitchTip because it is Sentry SDK-compatible. The same `sentry-sdk` Python package and `@sentry/react` JavaScript package work identically against both Sentry Cloud and GlitchTip. The only thing that changes is the DSN (Data Source Name) URL. This means zero code migration: swap the DSN, and every error, performance trace, and release tag flows to the self-hosted instance instead of Sentry Cloud.

## The GlitchTip Stack

GlitchTip runs as three Docker containers alongside the main application:

```yaml
glitchtip-postgres:
  image: postgres:15-alpine
  volumes:
    - glitchtip_postgres_data:/var/lib/postgresql/data

glitchtip-web:
  image: glitchtip/glitchtip:latest
  environment:
    DATABASE_URL: postgres://glitchtip:${GLITCHTIP_DB_PASSWORD}@glitchtip-postgres/glitchtip
    REDIS_URL: redis://redis:6379/1
    EMAIL_URL: ${GLITCHTIP_EMAIL_URL}
    DEFAULT_FROM_EMAIL: sira@noreply.abhipraya.dev

glitchtip-worker:
  image: glitchtip/glitchtip:latest
  command: ./bin/run-celery-with-beat.sh
```

A few things worth noting:

**Separate Postgres instance.** GlitchTip gets its own database, not the application's Supabase. This prevents monitoring data from affecting application queries and lets you back up or wipe monitoring data independently.

**Shared Redis.** GlitchTip uses Redis database 1 (`redis://redis:6379/1`), while the application uses database 0. Same Redis container, different logical databases. This saves memory on a constrained VPS.

**Email integration.** GlitchTip sends alert notifications via the same Resend SMTP relay the application uses. When an error occurs, the alert reaches the team's inbox within seconds.

Nginx routes `sira-glitchtip.nashtagroup.co.id` to the GlitchTip web container, giving the team a dedicated dashboard separate from the application.

## Conditional Initialization: Zero Overhead in Dev

The SDK is only initialized when a DSN is configured. In development, where `SENTRY_DSN` is empty, the Sentry SDK is a complete no-op: no network calls, no performance overhead, no error reporting.

```python
# apps/api/src/app/main.py
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        release=settings.commit_sha,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.environment,
        send_default_pii=False,
    )
```

The `send_default_pii=False` flag deserves attention. By default, Sentry captures request bodies and headers, which in our case would include JWT bearer tokens. A single flag prevents authentication tokens from leaking into a third-party monitoring service (even a self-hosted one) while still capturing the full exception stack trace and request metadata.

The `release=settings.commit_sha` parameter tags every error and performance trace with the exact git commit that produced it. When a new error appears after a deploy, you can immediately identify which commit introduced it.

## Custom Performance Spans: Monitoring What Matters

Default Sentry integration captures API request latency (how long each HTTP request takes end-to-end). That is useful but coarse. If a request takes 500ms, you do not know whether the bottleneck is a database query, a computation, or a downstream API call.

Custom performance spans break the request into labeled segments. Each span has an operation type (`db.query`, `db.insert`, `db.update`) and a human-readable name:

```python
# apps/api/src/app/services/payment_service.py
async def create(self, data: PaymentCreate, user_id: str | None = None) -> PaymentResponse | None:
    with sentry_sdk.start_span(op="db.query", name="validate_invoice_and_balance"):
        invoice = await get_invoice_by_id(self.db, data.invoice_id)
        existing_payments = await get_payments_by_invoice(self.db, data.invoice_id)
        # ... balance validation ...

    with sentry_sdk.start_span(op="db.insert", name="create_payment_record"):
        payment = await create_payment_record(self.db, ...)

    with sentry_sdk.start_span(op="db.insert", name="create_payment_version_v1"):
        await create_payment_version(self.db, ...)

    with sentry_sdk.start_span(op="db.update", name="recalculate_invoice_status"):
        await self._recalculate_invoice_status(data.invoice_id)
```

In GlitchTip's performance view, a single "create payment" transaction breaks down into four labeled segments. If the `validate_invoice_and_balance` span takes 300ms while the others take 10ms each, you know exactly where to optimize: the validation query is fetching too much data or missing an index.

The dashboard service uses the same pattern to instrument four parallel database queries:

```python
# apps/api/src/app/services/dashboard_service.py
async def get_dashboard_summary(db: Client) -> DashboardSummaryResponse:
    with sentry_sdk.start_span(op="db.query", name="get_total_invoices_count"):
        total_invoices = await get_total_invoices_count(db)
    with sentry_sdk.start_span(op="db.query", name="get_overdue_count"):
        overdue_count = await get_overdue_count(db)
    with sentry_sdk.start_span(op="db.query", name="get_total_outstanding"):
        total_outstanding = await get_total_outstanding(db)
    with sentry_sdk.start_span(op="db.query", name="get_clients_monitored_count"):
        clients_monitored = await get_clients_monitored_count(db)
```

Without custom spans, a slow dashboard load would require manual profiling to identify which of four queries is the bottleneck. With spans, the monitoring dashboard shows it immediately.

## Celery Worker Monitoring: The Invisible Layer

Background tasks are the hardest thing to monitor. They run in separate processes, have no HTTP request context, and their failures are invisible unless explicitly captured. A Celery task that fails after three retries just stops, and nobody knows until a user reports that their reminder was never sent.

### CeleryIntegration

The Celery worker initializes Sentry with an explicit `CeleryIntegration()`:

```python
# apps/api/src/app/workers/celery_app.py
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        release=settings.commit_sha,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.environment,
        integrations=[CeleryIntegration()],
    )
```

The `CeleryIntegration` is not redundant with Sentry's auto-discovery. In some SDK versions, Celery exceptions are captured automatically; in others, they are not. Explicitly listing the integration removes version-dependent ambiguity. We wrote a test that verifies the integration is present in the init call, so a future refactor cannot accidentally remove it.

### Context Tagging on Worker Tasks

The overdue invoice checker demonstrates context tagging, which attaches structured metadata to error events:

```python
# apps/api/src/app/workers/check_overdue.py
@celery_app.task(bind=True, max_retries=3)
def check_overdue_invoices(self: Task) -> None:
    try:
        db = create_supabase_client()
        start = time.monotonic()
        today_jakarta = datetime.now(_JAKARTA).date()

        with sentry_sdk.start_span(op="db.query", name="mark overdue invoices"):
            updated = mark_invoices_overdue(db, today_jakarta)

        elapsed = time.monotonic() - start
        sentry_sdk.set_context("task_data", {
            "invoices_count": len(updated),
            "task_elapsed_ms": round(elapsed * 1000, 3),
        })
    except Exception as exc:
        sentry_sdk.set_context("task_error", {
            "error_type": type(exc).__name__,
            "error_message": str(exc),
        })
        self.retry(exc=exc, countdown=60)
```

When this task fails, the GlitchTip error event includes not just the stack trace but also the `task_data` context: how many invoices were being processed, how long the task had been running before it failed. This turns a generic "database connection error" into "failed after processing 47 invoices in 3.2 seconds," which immediately narrows the debugging scope.

### Watchdog: Recovering from Missed Tasks

The watchdog task runs every 5 minutes and checks whether the daily overdue scan was missed (e.g., because the Beat scheduler was restarted mid-cycle):

```python
# apps/api/src/app/workers/watchdog.py
@celery_app.task
def watchdog_overdue_check() -> None:
    try:
        sentry_sdk.set_context("task_data", {"today_wib": now_jakarta.date().isoformat()})

        if now_jakarta < today_8am:
            sentry_sdk.set_context("task_data", {
                "after_8am": False,
                "recovery_triggered": False,
            })
            return

        if has_overdue:
            celery_app.send_task("app.workers.check_overdue.check_overdue_invoices")
    except Exception as exc:
        sentry_sdk.set_context("task_error", {
            "error_type": type(exc).__name__,
            "error_message": str(exc),
        })
        sentry_sdk.capture_exception(exc)
```

The watchdog explicitly calls `sentry_sdk.capture_exception(exc)` because, unlike the overdue checker, it does not retry. A watchdog failure means the recovery mechanism itself is broken, which should be visible immediately in the monitoring dashboard.

## Frontend Error Boundary

React applications crash silently by default: a rendering error in one component produces a blank white screen with no feedback. The `ErrorBoundary` component catches these crashes, shows a user-friendly fallback, and reports the error to Sentry with the component stack trace:

```typescript
// apps/web/src/components/error-boundary.tsx
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack },
        })
    }

    public render(): ReactNode {
        if (this.state.hasError) {
            return this.props.fallback ?? <DefaultFallback />
        }
        return this.props.children
    }
}
```

The `componentStack` in the `extra` field is critical. A JavaScript error like "Cannot read property 'name' of undefined" could come from anywhere. The component stack trace shows the exact React component tree: `App > Dashboard > InvoiceTable > InvoiceRow`, which pinpoints the failing component without requiring reproduction.

The frontend Sentry initialization mirrors the backend pattern: conditional on DSN, tagged with commit SHA for release correlation:

```typescript
// apps/web/src/main.tsx
if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        release: import.meta.env.VITE_COMMIT_SHA || 'development',
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 1.0,
        environment: import.meta.env.MODE,
    })
}
```

## Structured JSON Logging

Error monitoring captures exceptions. Structured logging captures everything else: successful requests, slow queries, rate limit hits, authentication failures. Every HTTP request is logged as a single-line JSON object:

```python
# apps/api/src/app/middleware/logging.py
class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "method": getattr(record, "method", None),
            "path": getattr(record, "path", None),
            "status": getattr(record, "status", None),
            "duration_ms": getattr(record, "duration_ms", None),
        })
```

The middleware measures request duration using `time.perf_counter()` (monotonic clock, not wall clock) and emits one log entry per request. JSON format means these logs are parseable by any log aggregation tool without regex.

## Release Tracking in CI/CD

Every deployment creates a GlitchTip release tagged with the git commit SHA:

```bash
# .gitlab-ci.yml deploy:promote stage
curl -sS -X POST \
    "${PROD_GLITCHTIP_DOMAIN}/api/0/organizations/sira/releases/" \
    -H "Authorization: Bearer ${PROD_GLITCHTIP_API_TOKEN}" \
    -d "{\"version\": \"${CI_COMMIT_SHA}\", \"projects\": [\"sira-api\", \"sira-web\"]}"
```

This creates a timeline of deployments in GlitchTip. When a new error appears, you can see which release introduced it. When an error disappears, you can see which release fixed it. The release creation is non-blocking (`|| true` on failure) so a GlitchTip outage never blocks a production deploy.

![GlitchTip releases page showing deployments tagged by commit SHA](/images/ppl/a5-glitchtip-releases.png)

## Alert Rules

Monitoring data is useless if nobody looks at it. Both projects (sira-api and sira-web) have identical alert rules configured:

**Rule: If an event happens 1 time in 1 minute, send an email to all team members.**

This is intentionally aggressive. In production, any unhandled exception is worth investigating immediately. The team receives an email within seconds of the first occurrence, before users have a chance to notice or report the issue.

The 1-event-in-1-minute threshold means the alert fires on the first occurrence, not after accumulation. For a system that should have zero unhandled exceptions in steady state, any exception is a signal worth acting on.

![GlitchTip alert configuration: 1 event in 1 minute triggers email to team](/images/ppl/a5-glitchtip-alert-config.png)

## What This Architecture Enables

| Layer | What it monitors | How |
|-------|-----------------|-----|
| FastAPI | API exceptions, request latency | Sentry SDK auto-capture + custom `start_span` |
| Celery | Task failures, retry exhaustion | `CeleryIntegration` + `set_context` metadata |
| React | Component crashes, JS errors | `ErrorBoundary` + `browserTracingIntegration` |
| Nginx | Request routing, health checks | Access logs + health endpoint exemption |
| CI/CD | Release correlation | Commit SHA tagged on every deploy |

The key insight is that monitoring is not a single tool or dashboard. It is layers: error capture for crashes, performance spans for latency, context tagging for debugging, structured logging for everything in between, and alerts for immediacy. Each layer answers a different question, and together they provide visibility into a system where three services (API, workers, frontend) run across two processes and one browser.
