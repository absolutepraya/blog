---
title: "PPL: SRP and Dependency Injection in Practice [Sprint 2, Week 3]"
date: 2026-04-08
description: "Two features this week (invoice number generation and auth on GET endpoints) demonstrate how isolating concerns into pure functions and composable dependencies keeps business logic clean and testable."
tags: ["ppl", "programming", "solid", "dependency-injection"]
slug: s2w3-programming
toc: true
---

## What I Worked On

Two features landed this week that each demonstrate a different application of the Single Responsibility Principle: auto-generating invoice numbers (SIRA-123, MR !130) and adding authentication to previously unprotected GET endpoints (SIRA-82, MR !154). Neither feature is large, but both show why separating concerns at the right level makes code easier to test and easier to reason about.

---

## Invoice Number Generation as a Pure Function

Before SIRA-123, invoice numbers were either manually entered or generated ad hoc inside the service. The new system generates them automatically in a dedicated module: `apps/api/src/app/lib/invoice_number.py`.

The format is `INV-{CLIENT_CODE}-YYYYMM-NNN`, where NNN is a zero-padded sequence number. For a client with code `TELK`, February 2026 invoices would be `INV-TELK-202602-001`, `INV-TELK-202602-002`, and so on.

The function signature makes its responsibilities explicit:

```python
def generate_invoice_number(
    client_code: str,
    month: date,
    existing_numbers: list[str],
) -> str:
```

No database. No HTTP. No side effects. It takes the existing numbers as a parameter rather than querying them itself, which means the function's entire behavior is determined by its inputs. This is the SRP applied at function level: the function's only job is to compute the next number, not to know how numbers are stored or retrieved.

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

The `ValueError` on overflow is a deliberate design choice: if a client somehow generates 999 invoices in a single month, that is a data quality problem that should surface immediately rather than silently wrap or produce a malformed number.

Because the function is pure, tests require no mocking:

```python
def test_generate_raises_on_sequence_overflow() -> None:
    existing = [f"INV-TELK-202603-{i:03d}" for i in range(1, 1000)]
    with pytest.raises(ValueError, match="Invoice sequence overflow"):
        generate_invoice_number("TELK", date(2026, 3, 1), existing)
```

The invoice service calls this function after fetching existing numbers from the DB, keeping the DB concern in the service and the computation concern in the lib module.

---

## Auth Dependency Injection on GET Endpoints

SIRA-82 (MR !154) fixed a gap: the `GET /api/clients/` and `GET /api/clients/{id}` endpoints had no authentication check. Any unauthenticated HTTP request could list all clients.

The fix adds `Depends(get_current_user)` to both handlers:

```python
@router.get("/")
async def list_clients(
    _user: AuthenticatedUser = Depends(get_current_user),
    service: ClientService = Depends(_get_service),
) -> list[ClientResponse]:
    return await service.list_clients()


@router.get("/{client_id}")
async def get_client(
    client_id: str,
    _user: AuthenticatedUser = Depends(get_current_user),
    service: ClientService = Depends(_get_service),
) -> ClientResponse:
    result = await service.get_client(client_id)
    if result is None:
        raise HTTPException(status_code=404, detail=_CLIENT_NOT_FOUND)
    return result
```

Two things worth noting:

**The underscore prefix on `_user`** signals that the dependency is validated but the resolved value is not used directly in the handler. FastAPI still calls `get_current_user()` and raises 401 if it fails. The underscore is a Python convention for "this variable exists for its side effect." This is cleaner than assigning to `user` and then never referencing it.

**No business logic changes.** The auth check is injected as a dependency, completely separate from the service call. This is the Open/Closed Principle at work: adding authentication to these endpoints required zero changes to `ClientService` or the DB queries. The router composes two concerns (auth and data retrieval) without mixing them.

Comparing read and write endpoints makes the contrast explicit. Write operations use `require_admin`:

```python
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    _admin: AuthenticatedUser = Depends(require_admin),  # admin only
    service: ClientService = Depends(_get_service),
) -> ClientResponse:
```

`get_current_user` permits any authenticated user. `require_admin` additionally checks the role. By composing these as injectable dependencies, adding a new role check in the future is a one-line change at the router level.

---

## Results

| Feature | Principle | Outcome |
|---------|-----------|---------|
| `generate_invoice_number()` pure function | SRP: computation isolated from I/O | Fully testable without mocks or DB |
| Auth on GET endpoints | OCP: auth added via composition | No changes to service or DB layer |

---

## Evidence

- MR !130 — [SIRA-123](https://linear.app/ppl-sira/issue/SIRA-123): auto-generate invoice number with client code
- MR !154 — [SIRA-82](https://linear.app/ppl-sira/issue/SIRA-82): add auth to GET client API endpoints
- Source: `apps/api/src/app/lib/invoice_number.py`, `apps/api/src/app/routers/clients.py`
