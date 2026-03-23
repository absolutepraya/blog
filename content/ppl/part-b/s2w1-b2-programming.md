---
title: "PPL: Service Layer Instrumentation [Sprint 2, Week 1]"
date: 2026-03-23
description: "Applying clean architecture principles when adding observability: why Sentry spans belong in the service layer, not routers, and how the existing pattern made it trivial."
tags: ["ppl", "programming", "solid", "clean-architecture", "sentry"]
slug: s2w1-programming
toc: true
---

## What I Worked On

This week I implemented custom Sentry span instrumentation across 3 key API services to track sub-operation latency in GlitchTip. The interesting part wasn't the Sentry API itself; it was **where** to place the instrumentation in our layered architecture, and how the existing SOLID patterns made the change trivially simple.

## Following the Architecture: Spans in Services, Not Routers

SIRA follows a strict Router → Service → DB pattern. Routers handle HTTP concerns (auth, status codes). Services hold business logic. DB queries are isolated in `db/queries/`.

When adding Sentry spans, the question was: where do they go?

**Option A: Router level** — wraps the entire handler. Shows total time but no breakdown.
**Option B: Service level** — wraps individual operations. Shows DB query time vs business logic.
**Option C: DB query level** — most granular but pollutes the data access layer with monitoring concerns.

I chose **Option B**. The service layer is where the interesting work happens: validation, calculation, status recalculation. Placing spans here shows exactly where time is spent without violating the Single Responsibility principle of any layer.

## Implementation: Three Services

### Dashboard Service (4 spans)

The dashboard aggregates 4 independent DB queries. Each gets its own span:

```python
_SPAN_DB_QUERY = "db.query"

async def get_dashboard_summary(db: Client) -> DashboardSummaryResponse:
    with sentry_sdk.start_span(op=_SPAN_DB_QUERY, name="get_total_invoices_count"):
        total_invoices = await get_total_invoices_count(db)
    with sentry_sdk.start_span(op=_SPAN_DB_QUERY, name="get_overdue_count"):
        overdue_count = await get_overdue_count(db)
    # ... 2 more queries
```

Note the `_SPAN_DB_QUERY` constant. SonarQube flagged the `"db.query"` string as duplicated 4 times (rule S1192). Extracting to a constant satisfies the quality gate and improves maintainability.

### Payment Service (3 spans: validate → insert → recalculate)

Payment creation is a multi-step operation. The spans reveal exactly which phase is slow:

```python
async def create(self, data: PaymentCreate) -> PaymentResponse | None:
    with sentry_sdk.start_span(op="db.query", name="validate_invoice_and_balance"):
        invoice = await get_invoice_by_id(self.db, data.invoice_id)
        # ... validation logic
    with sentry_sdk.start_span(op="db.insert", name="create_payment_record"):
        payment = await create_payment_record(...)
    with sentry_sdk.start_span(op="db.update", name="recalculate_invoice_status"):
        await self._recalculate_invoice_status(data.invoice_id)
```

### Invoice Service (2 spans: query → serialize)

Separates DB fetch from the days_overdue calculation loop.

## Why This Was Easy

The existing architecture made this a 3-file change. Because services are the single place where business logic lives, I didn't need to touch routers, DB queries, or tests. `sentry_sdk.start_span()` is a no-op when `SENTRY_DSN` is empty, so development environments have zero overhead.

All 459 backend tests passed without modification. The spans are transparent wrappers that don't change behavior.

## Result

- 3 service files modified, 0 routers touched, 0 tests changed
- 9 custom spans across 3 endpoints (dashboard: 4, payment: 3, invoice: 2)
- SonarQube quality gate passed after extracting the `_SPAN_DB_QUERY` constant
- MR !106 merged to main, all CI jobs green

The clean layered architecture paid off: adding observability was a mechanical change that didn't require architectural decisions or test rewrites.

## Evidence

- [MR !106 - API latency monitoring + uptime monitors](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/106)
- [Linear SIRA-136](https://linear.app/ppl-sira/issue/SIRA-136)
- Source: `apps/api/src/app/services/dashboard_service.py`, `invoice_service.py`, `payment_service.py`
