---
title: "PPL: SOLID and Layered Architecture [Sprint 1, Week 3]"
date: 2026-03-13
description: "How the Router-Service-DB pattern prevented HTTP leaking into business logic, why domain exceptions matter for maintainability, and dependency injection as the backbone of testability."
tags: ["ppl", "solid", "architecture", "python", "fastapi"]
slug: s1w3-programming
toc: true
---

## What I Worked On

This week's invoice management feature (MR !12) required a full CRUD stack with filtering, sorting, auth enforcement, and business validation (status transitions, admin-only delete). Building this properly meant enforcing strict layer boundaries and handling the tension between HTTP concerns and domain logic.

## The Three-Layer Pattern in Practice

SIRA's backend follows Router → Service → DB, where each layer has a single responsibility:

```
Router (HTTP)    →  knows status codes, request parsing, auth deps
Service (Logic)  →  knows business rules, validation, orchestration
DB (Data)        →  knows Supabase queries, table names, column mappings
```

Here's how the invoice create endpoint looks across all three layers:

**Router** (thin, HTTP-only):

```python
@router.post("/", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: Client = Depends(get_db),
    _: AuthenticatedUser = Depends(get_current_user),
) -> Any:
    return await InvoiceService(db).create(data)
```

The router does three things: parse the request body into a Pydantic model, inject DB and auth dependencies, and delegate to the service. It does not validate business rules.

**Service** (business logic):

```python
class InvoiceService:
    def __init__(self, db: Client) -> None:
        self.db = db

    async def create(self, data: InvoiceCreate) -> dict:
        # Business rule: auto-set OVERDUE if due_date is in the past
        invoice_data = data.model_dump()
        if data.due_date and data.due_date < date.today():
            invoice_data["status"] = "OVERDUE"
        return await create_invoice(self.db, invoice_data)
```

The service knows the domain rule (past due dates are automatically overdue) but doesn't know about HTTP status codes or request headers.

**DB** (data access):

```python
async def create_invoice(db: Client, data: dict) -> dict:
    result = db.table("invoices").insert(data).execute()
    return result.data[0]
```

The DB layer is a pure data bridge. It doesn't validate, transform, or make decisions.

## Why Layer Boundaries Matter: The HTTPException Leak

During code review of a teammate's MR (!12 itself, before refactoring), the invoice service was raising `HTTPException` directly:

```python
# Before refactoring — service layer leaking HTTP concerns
class InvoiceService:
    async def update(self, invoice_id: str, data: InvoiceUpdate) -> dict:
        existing = await get_invoice_by_id(self.db, invoice_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")
```

This violates the Single Responsibility Principle. The service now knows about HTTP status codes, which means:
1. It can't be reused by Celery workers (workers don't have HTTP context)
2. Testing requires importing FastAPI's HTTPException
3. Changing the API framework means changing business logic

The refactoring (commit `3194310c [Refactor]`) moved exception handling to the router:

```python
# After refactoring — clean layer boundary
class InvoiceService:
    async def get(self, invoice_id: str) -> dict | None:
        return await get_invoice_by_id(self.db, invoice_id)

# Router catches None and raises HTTP error
@router.get("/{invoice_id}")
async def get_invoice(...) -> Any:
    result = await InvoiceService(db).get(invoice_id)
    if not result:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return result
```

Now the service returns `None` for missing records, and the router decides what HTTP status that maps to. The service can be called from a Celery task or a CLI script without any HTTP import.

## Dependency Injection: Testability by Design

FastAPI's `Depends()` system is the backbone of SIRA's testability. Every external dependency (database, auth, admin check) is injectable:

```python
async def get_current_user(
    authorization: str | None = Header(None),
    db: Client = Depends(get_db),
) -> AuthenticatedUser:
    # JWT decode, user lookup, email fallback
    ...

async def require_admin(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

`require_admin` depends on `get_current_user`, which depends on `get_db`. This creates a dependency chain that FastAPI resolves automatically. In tests, overriding any point in the chain replaces everything downstream:

```python
# Override just get_db — get_current_user still works but hits mock DB
app.dependency_overrides[get_db] = lambda: mock_db

# Override get_current_user — skips JWT entirely
app.dependency_overrides[get_current_user] = lambda: MOCK_USER
```

This is the Dependency Inversion Principle in action. High-level modules (routers) depend on abstractions (`Depends(get_db)`), not concrete implementations. Swapping the concrete implementation (real Supabase vs. mock) requires zero code changes in the router.

## Open/Closed Principle: Invoice Filtering

The invoice list endpoint supports filtering by status, client, date range, and sorting. Rather than adding parameters one by one to the service method (violating Open/Closed), we use a Pydantic filter model:

```python
class InvoiceFilter(BaseModel):
    status: Literal["UNPAID", "PARTIAL", "PAID", "OVERDUE"] | None = None
    client_id: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    sort: str | None = None
    order: Literal["asc", "desc"] = "asc"
```

Adding a new filter field (e.g., `amount_min`) means adding one field to the model and one condition in the DB query. The router, service interface, and tests don't change. The system is open for extension (new filters) but closed for modification (existing code untouched).

## Result

The refactoring in MR !12 produced cleaner separation that paid off immediately:
- The overdue detection Celery worker (MR !49, reviewed this week) reuses `InvoiceService` without any HTTP imports
- Test fixtures are simpler because each layer can be tested independently
- Adding the admin-only DELETE endpoint required zero changes to the service layer; only the router and a test were added

## Evidence

- [MR !12 - SIRA-30 invoice management with [Refactor] commits](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12)
- [MR !20 - SIRA-27 layout/dashboard with DI-based auth](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20)
- Source: `apps/api/src/app/routers/invoices.py`, `apps/api/src/app/services/invoice_service.py`, `apps/api/src/app/dependencies.py`
