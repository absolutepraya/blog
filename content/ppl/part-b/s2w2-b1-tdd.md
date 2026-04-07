---
title: "PPL: TDD [Sprint 2, Week 2]"
date: 2026-03-30
description: "TDD discipline across session management, invoice cancellation, and auth hardening — with mock isolation and CI BDD visibility improvements this sprint."
tags: ["ppl", "tdd", "testing"]
slug: s2w2-tdd
toc: true
---

## What I Worked On

Three new features landed this week that each required TDD from scratch: multi-device session management (SIRA-214), invoice cancellation (SIRA-125), and blocking inactive accounts (SIRA-215). All three followed the red-green cycle and included mock isolation for external dependencies.

---

## Session Management: Testing Stateful Logic with Mocks

SIRA-214 (MR !120) introduced `SessionService`, which manages active sessions per user with a device limit. The service has non-trivial state: upsert if session already exists, kick oldest if at capacity, validate ownership before revoking.

Testing this required mocking the DB client to avoid real Supabase calls:

```python
@pytest.mark.asyncio
async def test_create_session_kicks_oldest_when_at_capacity(mock_db: MagicMock) -> None:
    user_id = "user-1"
    existing_sessions = [
        _make_session(f"s{i}", user_id) for i in range(MAX_SESSIONS)
    ]
    mock_db.table.return_value... # stub active sessions query

    service = SessionService(mock_db)
    await service.create_session(user_id, "new-session-id", "127.0.0.1", "Mozilla/5.0")

    # verify oldest was deactivated before inserting new
    deactivate_calls = [c for c in mock_db.method_calls if "deactivate" in str(c)]
    assert len(deactivate_calls) == 1
    assert deactivate_calls[0].args[1] == existing_sessions[-1]["id"]
```

The test suite covers: create with available capacity, create with capacity exceeded (kick oldest), upsert on duplicate session ID, revoke own session, revoke other user's session (should raise), revoke non-existent session. That's positive, negative, and corner cases.

Total test coverage for this feature: 260 lines in `test_session_service.py` + 193 lines in `test_session_queries.py` + 160 lines in `test_session_router.py`.

---

## Invoice Cancellation: State Machine TDD

SIRA-125 (MR !118) added cancellation for UNPAID and OVERDUE invoices. The business rule is a state machine: UNPAID and OVERDUE can be cancelled, PAID and already-CANCELLED cannot.

TDD forced me to enumerate the matrix explicitly before writing the service:

```python
# RED
async def test_cancel_paid_invoice_raises() -> None:
    ...
    with pytest.raises(PermissionError, match="Cannot cancel a PAID invoice"):
        await service.cancel_invoice(invoice_id)

async def test_cancel_overdue_invoice_succeeds() -> None:
    ...
    result = await service.cancel_invoice(invoice_id)
    assert result["status"] == "CANCELED"
```

This upfront test writing caught a gap before any service code existed: the confirmation dialog on the frontend tested accept and reject paths, which is often missed for destructive actions.

---

## Auth Guard Tests: Mocking JWT Validation

SIRA-215 (MR !104) blocks inactive accounts. The router calls `get_current_user`, which validates the JWT. Testing this without a real GoTrue instance required mocking the dependency:

```python
@pytest.fixture
def inactive_user() -> MagicMock:
    mock = MagicMock()
    mock.get.side_effect = lambda k, *_: {"is_active": False, "id": "u1"}.get(k)
    return mock

async def test_inactive_user_gets_403(client: AsyncClient, inactive_user: MagicMock) -> None:
    app.dependency_overrides[get_current_user] = lambda: inactive_user
    response = await client.get("/api/staff/")
    assert response.status_code == 403
    assert response.json()["detail"] == "Account is inactive"
```

The mock-via-`dependency_overrides` pattern keeps the test fast and deterministic without requiring a running GoTrue container.

---

## BDD in CI: Making Test Coverage Visible

MR !129 (SIRA-227) and !140 extract the BDD Gherkin feature file content and post it directly in the MR comment alongside the pass/fail table. This isn't a TDD change per se but it improves TDD discipline across the team: reviewers can read the behavior scenarios inline without opening the CI logs, which makes it easier to spot coverage gaps during code review.

---

## Results

| Feature | Test files | Lines of tests | Coverage |
|---------|-----------|---------------|----------|
| Session management | 3 | ~613 | 100% |
| Cancel invoice | backend + frontend | ~200 | 100% (new code) |
| Block inactive accounts | 1 | ~60 | 100% |

---

## Evidence

- MR !120 — [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214): `apps/api/tests/test_session_service.py`, `test_session_router.py`, `test_session_queries.py`
- MR !118 — [SIRA-125](https://linear.app/ppl-sira/issue/SIRA-125): backend + frontend cancel invoice tests
- MR !104 — [SIRA-215](https://linear.app/ppl-sira/issue/SIRA-215): `apps/api/tests/test_auth.py`
- MR !129 — [SIRA-227](https://linear.app/ppl-sira/issue/SIRA-227): BDD report in CI comments
