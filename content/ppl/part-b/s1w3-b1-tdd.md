---
title: "[S1, W3] PPL: Test-Driven Development"
date: 2026-03-13
description: "Red-green-refactor across three full-stack features, advanced mock patterns with FastAPI dependency overrides, and how test isolation caught a real auth bug."
tags: ["ppl", "tdd", "testing", "python", "fastapi"]
slug: s1w3-tdd
toc: true
---

## What I Worked On

This week shipped three full-stack features using strict TDD discipline: invoice management (CRUD + filtering), layout/dashboard (sidebar, header, dashboard with role-based navigation), and a payments sidebar navigation link. Each feature followed red-green-refactor with tagged commits.

The project now has **392 backend tests** and **195 frontend tests** (587 total), up from 51 last week.

## Red-Green-Refactor Commit Discipline

Every feature branch this week followed tagged commits so the TDD flow is auditable from the git history alone.

**Invoice management (MR !12)** had 8 red-green pairs across backend and frontend:

| Commit | Tag | What |
|--------|-----|------|
| `2112c15` | `[Red]` | Tests for invoice read operations |
| `18993b6` | `[Green]` | Implement invoice read operations |
| `1f37aa2` | `[Red]` | Tests for invoice POST and PUT with status validation |
| `13e0510` | `[Green]` | Implement invoice POST and PUT operations |
| `c5803b9` | `[Red]` | Unit test for invoices list and detail page |
| `79e13e9` | `[Green]` | Implement invoices list and detail page |
| `35ca88e` | `[Red]` | Tests for invoice filtering and sorting |
| `dd1f5d7` | `[Green]` | Implement invoice filtering and sorting |
| `28c54a0` | `[Red]` | Failing tests for DELETE invoice endpoint |
| `244014a` | `[Green]` | Implement DELETE invoice (admin only) |
| `b1c653b` | `[Refactor]` | Increase invoice test coverage to 100% |

**Layout and dashboard (MR !20)** had 5 red-green pairs for every UI component:

```
9116f5e test(web): add sidebar component tests [red]
8640f63 feat(web): implement sidebar with role-based navigation [green]
1dfa091 test(web): add header component tests [red]
ab89570 feat(web): implement header with user info and logout [green]
5057c55 test(web): add app-shell layout tests [red]
f9e7111 feat(web): implement app-shell layout with sidebar and header [green]
1dc6101 test(web): add use-dashboard hook tests [red]
8347ed7 feat(web): implement use-dashboard query hook [green]
f50e4c8 test(web): add dashboard page tests [red]
53be3d7 feat(web): implement dashboard page [green]
```

**Payments sidebar (MR !54)** used the same discipline for a smaller change:

```
2414214 red(web): add failing tests for Payments link in sidebar
625b49a green(web): add Payments link to sidebar navigation
```

## Advanced Test Isolation: FastAPI Dependency Overrides

The most impactful testing pattern this week is FastAPI's dependency injection override system. Rather than patching imports (which is fragile and breaks when modules get reorganized), we override the DI container itself.

`conftest.py` defines three fixture variants:

```python
MOCK_USER = AuthenticatedUser(
    id="user-test-001",
    auth_user_id="auth-test-001",
    email="test@example.com",
    full_name="Test User",
    role="AR_STAFF",
)

@pytest.fixture
def client() -> Generator[TestClient]:
    """Authenticated AR staff."""
    mock_db = MagicMock(spec=Client)
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture
def unauthenticated_client() -> Generator[TestClient]:
    """No auth override — tests 401 paths."""
    mock_db = MagicMock(spec=Client)
    app.dependency_overrides[get_db] = lambda: mock_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

This approach has a key advantage over `@patch`: when the router calls `Depends(get_current_user)`, the override kicks in at the framework level, meaning the entire auth chain (JWT decode, DB lookup, role check) is skipped cleanly. Tests for invoice CRUD don't need to know how auth works internally; they just get a pre-built `AuthenticatedUser`.

The `MagicMock(spec=Client)` ensures the mock only allows methods that exist on the real Supabase `Client`. Calling a method that doesn't exist raises `AttributeError`, catching typos before CI.

## AsyncMock for Database Query Isolation

For testing specific database behaviors (not found, duplicate, error), we patch at the query layer using `AsyncMock`:

```python
with patch(
    "app.db.queries.invoices.get_invoice_by_id",
    new_callable=AsyncMock,
) as mock:
    mock.return_value = None
    response = client.get("/api/invoices/nonexistent-id")
    assert response.status_code == 404
```

This pattern is used consistently across invoice, payment, and auth tests. The mock targets the DB query function (not the service or router), so we're testing that the service correctly interprets a `None` return and that the router correctly maps it to a 404.

## Corner Case: Auth Email Fallback

The `get_current_user` dependency has a non-obvious corner case that TDD caught early. When a Supabase Auth user exists but hasn't been linked to an `app_users` row yet, the system falls back to email matching and auto-links the `auth_user_id`:

```python
# In dependencies.py
app_user = await get_app_user_by_auth_id(db, auth_user_id)

if not app_user:
    email = payload.get("email")
    if email:
        app_user = await get_app_user_by_email(db, email)
        if app_user:
            await link_auth_user_id(db, app_user["id"], auth_user_id)
```

This was originally discovered as a bug (MR !35 from last week), but this week the pattern was extended to all new features. The test for this corner case:

1. Mocks `get_app_user_by_auth_id` to return `None` (first-time login)
2. Mocks `get_app_user_by_email` to return a valid user (email exists)
3. Asserts `link_auth_user_id` is called with the correct `auth_user_id`
4. Asserts the request succeeds (not 401)

Without this test, the auto-link logic could silently break and new users would get locked out after their first login.

## TDD Enforced at the Process Level

The red-green-refactor discipline isn't just a convention I follow manually. It's built into the development workflow through the [Superpowers](https://github.com/obra/superpowers) plugin for Claude Code. When developing a feature, the process looks like this:

```mermaid
flowchart LR
    B(["/brainstorming"]) --> P(["/executing-plans"])
    P --> V(["/verification-before-completion"])
    V --> MR(["/create-mr"])
```

1. **`/brainstorming`** explores the feature requirements: what do I need, what are the edge cases, what's the scope? It asks questions, proposes approaches, and produces a design document with a concrete plan.
2. **`/executing-plans`** executes the plan from the brainstorming session. This is combined with **`/test-driven-development`** from the same plugin, which enforces the red-green-refactor cycle. The AI writes a failing test first, then implements just enough code to pass it, then refactors. It won't skip ahead to implementation without a test.
3. **`/verification-before-completion`** runs a final check before the work is considered done: are all tests passing, does the code match the plan, are there any loose ends?
4. **`/create-mr`** creates the merge request with a structured description.

The reason this matters for TDD specifically: it removes the temptation to "just write the code first and add tests later." When TDD is baked into the execution process, every feature starts with a test by default. The 18+ red-green pairs this week weren't the result of extra discipline; they were the natural output of a process that won't let you skip the red step.

## Coverage Pipeline

Coverage is collected in CI and flows into SonarQube:

```yaml
api:test:
  script:
    - uv run pytest --cov=app --cov-report=xml:coverage.xml
    - sed -i 's|filename="src/|filename="apps/api/src/|g' coverage.xml

web:test:
  script:
    - pnpm test -- --coverage --coverage.reporter=lcov
```

The `sed` rewrite on line 100 of `.gitlab-ci.yml` is worth noting: pytest generates paths relative to `src/` (since that's the source root), but SonarQube expects paths relative to the repo root. Without this one-liner, all Python coverage data shows as "unknown files" in SonarQube.

## Result

| Metric | S1W2 | S1W3 |
|--------|:---:|:---:|
| Total tests | 51 | 587 (392 backend + 195 frontend) |
| Red-green pairs (this week) | 6 | 18+ |
| Features with TDD | 2 | 5 |

All 587 tests pass locally and in CI. Coverage artifacts feed SonarQube for continuous quality tracking.

![Vitest (195 frontend tests) and pytest (392 backend tests) all passing](/images/ppl/pytest-s1w3.png)

## Evidence

- [MR !12 - SIRA-30 invoice management (8 red/green pairs)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12)
- [MR !20 - SIRA-27 layout & dashboard (5 red/green pairs)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20)
- [MR !54 - SIRA-89 payments sidebar (red/green)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/54)
- Source: `apps/api/tests/conftest.py`, `apps/api/tests/`, `apps/web/src/**/*.test.tsx`
