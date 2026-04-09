---
title: "PPL: SOLID Principles in a FastAPI Invoice System"
date: 2026-04-09
description: "How Python Protocols, constructor injection, and a three-layer architecture turned a monolithic API into a system where adding an ML risk scoring model requires zero changes to existing code."
tags: ["ppl", "solid", "design-patterns", "fastapi", "architecture"]
slug: solid
toc: true
---

SIRA (Smart Invoice Reminder AI) is a system that automates invoice collection reminders. It monitors payment status, scores client risk using a weighted formula, and sends personalized reminders by email or messaging. The backend is built with FastAPI, Supabase (Postgres via REST), Celery for background jobs, and Redis as the message broker.

This blog walks through how SOLID principles shaped the architecture at three levels: the overall layer structure, service-level design patterns, and individual function design. The goal is not to explain what SOLID stands for (there are plenty of articles for that), but to show what it looks like in production code and why certain design choices were made over simpler alternatives.

> **Note:** Our project is hosted on an internal GitLab instance, so we use the term **MR (Merge Request)** throughout this blog. If you're coming from GitHub, MRs are the equivalent of **Pull Requests (PRs)**.

## The Architecture: Router, Service, Query

The first design decision was separating the codebase into three layers. FastAPI makes it easy to put everything in route handlers: read from the database, compute the result, return the response. For a small project that works fine. For a system with 14 services, 13 database query modules, background workers, and multiple API consumers, it does not.

SIRA uses a strict three-layer pattern:

```
routers/          → HTTP concerns only (validation, auth, status codes)
services/         → Business logic (risk scoring, reminders, payments)
db/queries/       → Data access (Supabase queries, one file per domain)
```

### What "Thin Routers" Means in Practice

A route handler does three things: validate input, call a service, return a response. It never contains business logic:

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
        raise HTTPException(status_code=404, detail="Client not found")
    return result
```

The router checks authentication (`Depends(get_current_user)`), gets the service instance, calls it, and handles the HTTP response. The `_user` underscore prefix signals that the dependency is evaluated for its auth side effect but the resolved value is not used in the handler body.

The service (`ClientService`) does the actual work: querying clients, encrypting PII fields, building response objects. The service itself never imports FastAPI types, never raises `HTTPException`, and never knows it is being called from a web server. This means the same service can be used from a Celery background task, a CLI script, or a test, with no changes.

### Why Separate the Query Layer?

Services call the `db/queries/` layer for all database interactions. They never use the Supabase client directly. Each domain has its own query file:

```
db/queries/
  clients.py         → get_all_clients, get_client_by_id, create_client, ...
  invoices.py        → get_overdue_invoices, update_invoice_status, ...
  payments.py        → create_payment, get_payments_for_invoice, ...
  risk_scoring.py    → insert_risk_scoring_log, get_client_risk_history, ...
  user_sessions.py   → get_session_by_session_id, deactivate_session, ...
  ... (13 files total)
```

This separation exists for testability. Integration tests use a real Supabase instance, but unit tests can mock the query layer without knowing how Supabase works internally. If the database engine changed (say, from Supabase REST to raw SQL via asyncpg), only the query files change. Services remain untouched.

---

## Strategy Pattern with Python Protocols

The most architecturally interesting part of SIRA is the risk scoring engine. Clients are scored as LOW, MEDIUM, or HIGH risk based on payment behavior. The current implementation uses a deterministic weighted formula. The product roadmap includes ML-based scoring. The design question: how do you build for the current formula while making it trivial to swap in a trained model later?

### Three Approaches Compared

| Approach | Add new algorithm | Requires inheritance | Type-checked at compile time |
|----------|:-:|:-:|:-:|
| if/elif chain | Modify existing code | N/A | No |
| ABC (Abstract Base Class) | Add new subclass | Yes | Yes |
| Python Protocol | Add any conforming class | No | Yes (structural) |

**if/elif** is the simplest but violates the Open/Closed Principle. Every new scoring method requires modifying the existing function. With two algorithms this is manageable; with five it becomes a maintenance problem.

**ABC** works and is what most Python tutorials recommend. Define `AbstractScoringStrategy`, subclass it. The limitation: every implementation must inherit from the ABC. If an ML team provides a scoring class from their own package, they need to import and subclass our ABC. That creates a coupling between packages that should be independent.

**Python Protocol** solves this with structural typing. A class satisfies a Protocol if it has the right methods and attributes, regardless of its inheritance chain. It is duck typing with type checker support. A scoring class from any package, any team, any codebase automatically satisfies the Protocol as long as it implements `calculate_score()` and `model_version`.

### The Protocol Definition

```python
@runtime_checkable
class RiskScoringStrategy(Protocol):
    """Interface for risk score calculation algorithms.

    Implement this protocol to add new scoring strategies (e.g., ML-based)
    without touching RiskScoringService — satisfying OCP and DIP.
    """

    model_version: str

    def calculate_score(
        self, features: dict[str, Any]
    ) -> tuple[float, Literal["LOW", "MEDIUM", "HIGH"]]:
        ...
```

The `@runtime_checkable` decorator allows `isinstance()` checks at runtime, not just static type checking. The interface is minimal: a version string (for audit logging) and a scoring function that takes feature vectors and returns a score with a label.

### The Concrete Strategy

The rule-based implementation uses a weighted sum with configurable weights and thresholds:

```python
class RuleBasedScoringStrategy:
    """Deterministic weighted formula per spec.

    Risk Score = (delay_score       × 0.35)
               + (overdue_count     × 0.20)
               + (outstanding_amt   × 0.20)
               + (payment_consist.  × 0.15)
               + (invoice_age       × 0.10)

    Thresholds: <= 30 -> LOW | <= 60 -> MEDIUM | > 60 -> HIGH
    """

    model_version: str = "rule-based-v1"

    _LOW_THRESHOLD: float = 30.0
    _HIGH_THRESHOLD: float = 60.0

    _WEIGHTS: dict[str, float] = {
        "delay_score": 0.35,
        "overdue_count_score": 0.20,
        "outstanding_amount_score": 0.20,
        "payment_consistency_score": 0.15,
        "invoice_age_score": 0.10,
    }

    def calculate_score(
        self, features: dict[str, Any]
    ) -> tuple[float, Literal["LOW", "MEDIUM", "HIGH"]]:
        missing = [k for k in self._WEIGHTS if k not in features]
        if missing:
            raise ValueError(f"Features dict missing required keys: {missing}")
        score = round(
            sum(features[key] * weight for key, weight in self._WEIGHTS.items()),
            4,
        )
        if score <= self._LOW_THRESHOLD:
            return score, "LOW"
        if score <= self._HIGH_THRESHOLD:
            return score, "MEDIUM"
        return score, "HIGH"
```

Notice: `RuleBasedScoringStrategy` does not inherit from anything. It does not import `RiskScoringStrategy`. It simply has the right shape (a `model_version` attribute and a `calculate_score` method with the correct signature), and mypy verifies structural conformance at type-check time.

Weights and thresholds are class constants, not magic numbers in the function body. Adjusting the formula means changing constants in one place. Adding a new feature to the formula means adding one entry to `_WEIGHTS`. Neither requires touching the scoring service.

### Constructor Injection with a Default

The service accepts any scoring strategy via its constructor:

```python
class RiskScoringService:
    def __init__(
        self,
        db: Client,
        strategy: RiskScoringStrategy | None = None,
        feature_service: FeatureEngineeringService | None = None,
    ) -> None:
        self._db = db
        self._strategy: RiskScoringStrategy = (
            strategy if strategy is not None else RuleBasedScoringStrategy()
        )
        self._feature_service: FeatureEngineeringService = (
            feature_service if feature_service is not None else FeatureEngineeringService(db)
        )
```

The `strategy` parameter defaults to `None`, which falls back to the rule-based implementation. Callers that do not care about the scoring algorithm (most of them) create `RiskScoringService(db)` and get the default. Callers that want a different strategy pass it explicitly: `RiskScoringService(db, strategy=MLScoringStrategy(model_path))`.

This is the Dependency Inversion Principle in action: the service depends on the abstraction (`RiskScoringStrategy` Protocol), not on a concrete class. The concrete class is injected from outside.

---

## SRP: Feature Engineering as a Separate Service

The risk scoring pipeline has two distinct jobs: (1) extract and normalize features from raw payment/invoice data, and (2) compute a risk score from those features. These could live in one class. They do not, because they change for different reasons.

`FeatureEngineeringService` handles extraction and normalization. It reads invoices and payments, computes raw metrics (average days late, overdue count, outstanding amount), and normalizes each to a 0 to 100 scale:

```python
class FeatureEngineeringService:
    """Extracts and normalizes payment risk features for a given client."""

    def __init__(self, db: Client) -> None:
        self._db = db

    async def extract_features(self, client_id: str) -> dict[str, Any]:
        invoices = await get_client_invoices_for_scoring(self._db, client_id)
        payments = await get_client_payment_history(self._db, client_id)

        # ... compute raw metrics from invoices and payments ...

        return {
            "avg_days_late": round(avg_days_late, 4),
            "overdue_invoice_count": overdue_invoice_count,
            "outstanding_amount": outstanding_amount,
            "payment_consistency_ratio": round(payment_consistency_ratio, 4),
            "max_invoice_age_days": max_invoice_age_days,
            # Normalized scores (0–100)
            "delay_score": round(delay_score, 4),
            "overdue_count_score": round(overdue_count_score, 4),
            "outstanding_amount_score": round(outstanding_amount_score, 4),
            "payment_consistency_score": round(payment_consistency_score, 4),
            "invoice_age_score": round(invoice_age_score, 4),
        }
```

`RiskScoringService` orchestrates the pipeline without knowing how features are computed:

```python
async def score_client(self, client_id: str) -> ScoreRiskResponse:
    client = await get_client_by_id(self._db, client_id)
    if client is None:
        raise ValueError("Client not found")

    features = await self._feature_service.extract_features(client_id)
    risk_score, risk_label = self._strategy.calculate_score(features)

    log = await insert_risk_scoring_log(
        self._db,
        client_id=client_id,
        risk_label=risk_label,
        probability_score=risk_score,
        features_snapshot=features,
        model_version=self._strategy.model_version,
    )
    await update_client_risk(self._db, client_id, risk_label, risk_score)
    # ... build and return response ...
```

Why does this separation matter? Feature extraction changes when the database schema changes (new columns, renamed fields). Scoring changes when the algorithm changes (new weights, ML model). If both lived in one class, a schema migration could break the scoring tests, and a formula change could break the extraction logic. With separate services, each has exactly one reason to change.

---

## Dependency Injection via FastAPI Depends

FastAPI's `Depends()` function acts as a lightweight dependency injection container. SIRA uses it to provide database connections, authentication, and authorization without global state:

```python
def get_db() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase_client


async def get_current_user(
    authorization: str | None = Header(None),
    db: Client = Depends(get_db),
) -> AuthenticatedUser:
    # ... JWT decode, user lookup, session validation ...
    return AuthenticatedUser(id=app_user["id"], role=app_user["role"], ...)


async def require_admin(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

Dependencies compose: `require_admin` depends on `get_current_user`, which depends on `get_db`. FastAPI resolves the chain automatically. Adding a new authorization level (say, `require_supervisor`) means writing one new function that depends on `get_current_user`, not modifying any existing code.

For testing, FastAPI allows overriding dependencies:

```python
app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
    id="test-user", role="AR_STAFF", ...
)
```

This means integration tests can bypass JWT authentication without changing any service code. The auth logic is testable independently, and the services are testable without auth.

---

## Pure Functions: Isolating Logic from I/O

Not everything needs to be a class. Some operations are naturally pure functions: given inputs, produce outputs, with no side effects.

Invoice number generation (`apps/api/src/app/lib/invoice_number.py`) is one example:

```python
def generate_invoice_number(
    client_code: str,
    month: date,
    existing_numbers: list[str],
) -> str:
    prefix = f"INV-{client_code}-{month.strftime('%Y%m')}-"
    max_seq = 0
    for number in existing_numbers:
        if number.startswith(prefix):
            seq = int(number[len(prefix):])
            if seq > max_seq:
                max_seq = seq
    next_seq = max_seq + 1
    if next_seq > 999:
        raise ValueError(f"Invoice sequence overflow for {client_code}")
    return f"{prefix}{next_seq:03d}"
```

No database. No HTTP. No global state. The function receives everything it needs as parameters, including the list of existing numbers. The service that calls this function is responsible for fetching existing numbers from the database. The generation logic is testable with a plain function call and a list of strings.

Field-level encryption (`apps/api/src/app/lib/encryption.py`) follows the same pattern:

```python
def encrypt(value: str | None, key: str) -> str | None:
    if value is None:
        return None
    key_bytes = base64.urlsafe_b64decode(key)
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = AESGCM(key_bytes).encrypt(nonce, value.encode(), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode()
```

Pure functions are the simplest form of SRP: one function, one job, no entanglement with the rest of the system.

---

## What This Enables

| Principle | Where it appears | What it enables |
|-----------|-----------------|----------------|
| SRP | 14 services, 13 query files, 2 lib modules | Each component has one reason to change |
| OCP | Strategy Protocol for scoring | New scoring algorithms without modifying existing code |
| LSP | Any `RiskScoringStrategy` conformant works in `RiskScoringService` | Swap rule-based for ML without behavioral surprises |
| ISP | Minimal Protocol interface (2 members) | Implementors only need `model_version` + `calculate_score` |
| DIP | Constructor injection, FastAPI Depends | Services depend on abstractions, not concretions |

The practical test: adding an ML-based scoring model requires implementing a class with `model_version` and `calculate_score()`. Pass it to `RiskScoringService(db, strategy=ml_strategy)`. Zero lines of existing code change. The service orchestrates, the strategy scores, the feature service extracts. Each layer stays focused on its own job.
