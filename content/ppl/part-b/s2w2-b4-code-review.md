---
title: "PPL: Team Dev Management [Sprint 2, Week 2]"
date: 2026-03-30
description: "Code reviews on three major MRs this sprint — cancel invoice, blue/green deployment, and invoice grouping — with 29 review points including race conditions, SQL injection risks, and API guard gaps."
tags: ["ppl", "code-review", "team-management"]
slug: s2w2-code-review
toc: true
---

## What I Worked On

Three substantial MRs reviewed this week: Bertrand's cancel invoice feature (SIRA-125), Erdafa's blue/green deployment system (SIRA-134 to SIRA-141), and Rifqi's invoice grouping by status (SIRA-132). Total review points: 29 across P0/P1/P2/P3 severity.

---

## MR !118 — Cancel Invoice Feature (Bertrand)

The implementation was solid on the happy path: TDD discipline visible from commit history, clean Router-Service-DB layering, rollback migration included. Review focused on API-level guard gaps that the frontend UI hid but the API did not enforce.

**P0: CANCELED invoices can still be edited via direct API call**

The `update` method in `InvoiceService` only blocks PAID invoices. A direct `PUT /api/invoices/{id}` call can modify amount, due date, or client on a canceled invoice. The frontend hides the edit button but that is not sufficient.

```python
# fix: add CANCELED to the blocked statuses in update
if current.get("status") in ("PAID", "CANCELED"):
    raise PermissionError(f"{current.get('status')} invoice cannot be edited")
```

**P0: Payments can be recorded against a CANCELED invoice**

Same gap in `PaymentService.create()`. Only PAID is blocked, so `POST /api/payments` against a canceled invoice succeeds.

```python
if invoice["status"] in ("PAID", "CANCELED"):
    raise ValueError(f"Cannot record payment on a {invoice['status'].lower()} invoice")
```

**P0: `CANCELED` added as a union type hack**

`CANCELED` was added as `InvoiceStatus | 'CANCELED'` instead of being added to the `INVOICE_STATUSES` array. This breaks the single source of truth and forces `as unknown as InvoiceStatus` casts in tests.

**P1 items:** `/api/invoices?status=CANCELED` returns 422 (Literal type gap in query param), Send Email button visible for canceled invoices.

---

## MR !109 — Blue/Green Deployment (Erdafa)

The overall architecture was solid: Docker Compose profiles for slot separation, nginx upstream switching via a conf file volume mount, manual promote/rollback gates. Review focused on silent failure modes that could cause outages or data corruption.

**P0: Dual Celery Beat race condition**

Between the deploy job (starts full standby slot including beat) and the manual promote (stops old beat), two beat schedulers run against the same Redis broker for an unbounded window. Every scheduled task gets dispatched twice.

```bash
# fix: stop standby beat immediately after health check passes in deploy job
docker compose -f infra/docker-compose.yml stop beat-${STANDBY_SLOT} || true
```

**P0: nginx reload failure not checked**

If `nginx -s reload` fails, the script continues to stop old workers and update `.active-slot`. nginx still routes to the old slot but old workers are stopped, creating a silent outage.

```bash
docker exec sira-nginx nginx -t || { echo "ERROR: Nginx config invalid. Aborting."; exit 1; }
docker exec sira-nginx nginx -s reload || { echo "ERROR: Nginx reload failed. Aborting."; exit 1; }
```

**P0: Destructive ops before post-promote health check**

The promote job stops old workers and updates `.active-slot` before running a health check. If the health check fails, old workers are already dead. Correct order: switch nginx, health check, only then stop old slot.

**P0: `.active-slot` content never validated**

If `.active-slot` contains garbage or whitespace, the ternary silently defaults to "blue", potentially deploying over the live slot.

```bash
ACTIVE_SLOT=$(cat .active-slot | tr -d '[:space:]')
if [ "$ACTIVE_SLOT" != "blue" ] && [ "$ACTIVE_SLOT" != "green" ]; then
    echo "ERROR: .active-slot contains invalid value: '$ACTIVE_SLOT'"; exit 1
fi
```

**P1 items (4):** rollback doesn't health-check old slot, no locking between concurrent deploy/promote/rollback runs, uses `down` instead of `stop` (loses logs), worker stop failures silently swallowed.

**P2/P3 items (7):** no frontend health check in deploy, GlitchTip release curl missing `-f` flag, stale docstring, and others.

---

## MR !127 — Invoice Grouping by Status (Rifqi)

`Record<InvoiceStatus, number>` for compile-time completeness and thorough test coverage (~1000 lines) were highlights. Review focused on a security gap and type safety issues.

**P0: Unsanitized sort column passed to PostgREST**

`InvoiceFilter.sort` is `str | None` and is passed directly to `query.order()`. A crafted sort value goes straight to PostgREST without validation, creating a SQL injection risk.

```python
_ALLOWED_SORT_COLUMNS = {"due_date", "amount", "invoice_number", "status"}

def _apply_invoice_query_sort(query: Any, filters: InvoiceFilter | None) -> Any:
    if not filters or not filters.sort or filters.sort == "status":
        return query
    if filters.sort not in _ALLOWED_SORT_COLUMNS:
        return query
    return query.order(filters.sort, desc=(filters.order == "desc"))
```

**P1: `if value:` truthiness bug**

The filter loop uses `if value:`, so an empty string `""` (frontend sends empty instead of null) silently skips the filter, returning unfiltered results with no error.

**P1: `reverse=True` flips the entire composite sort key**

`_sort_by_status_priority(descending=True)` passes `reverse=True` to `sorted()`, which reverses tiebreakers (due date, amount, client name) alongside status. Only the status priority component should be negated.

**P1: Missing fallback for unknown status in frontend sort**

`INVOICE_STATUS_PRIORITY[status]` returns `undefined` for unknown statuses, causing NaN to propagate through the sort. The backend handles this with `.get(status, len(_STATUS_PRIORITY))`; the frontend should too.

---

## Results

| MR | Issues found | P0 | P1 | P2/P3 |
|----|-------------|----|----|-------|
| !118 cancel invoice | 8 | 3 | 2 | 3 |
| !109 blue/green deploy | 16 | 5 | 4 | 7 |
| !127 invoice grouping | 5 | 1 | 3 | 1 |
| **Total** | **29** | **9** | **9** | **11** |

---

## Evidence

- MR !118 — [SIRA-125](https://linear.app/ppl-sira/issue/SIRA-125): reviewed Bertrand's cancel invoice implementation
- MR !109 — [SIRA-134](https://linear.app/ppl-sira/issue/SIRA-134) through [SIRA-141](https://linear.app/ppl-sira/issue/SIRA-141): reviewed Erdafa's blue/green deployment
- MR !127 — [SIRA-132](https://linear.app/ppl-sira/issue/SIRA-132): reviewed Rifqi's invoice grouping by status
