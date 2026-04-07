---
title: "PPL: Programming [Sprint 2, Week 2]"
date: 2026-03-30
description: "Applying SRP and the layered Router-Service-DB architecture in the email integration and session management features this sprint."
tags: ["ppl", "programming", "solid", "architecture"]
slug: s2w2-programming
toc: true
---

## What I Worked On

Two major features this week, email integration (SIRA-160) and session management (SIRA-214), both followed the SOLID principles that have been established in the codebase. The email feature in particular offered a good opportunity to show SRP in action: sending an email and rendering an email template are genuinely different responsibilities, and keeping them separate made both easier to test.

---

## Email Integration: Separating Transport from Rendering

SIRA-160 (MR !108) introduced three distinct services:

- `EmailService` — handles only HTTP transport to the Resend API
- `EmailTemplateService` — handles template rendering (Jinja2, variable substitution, preview generation)
- `EmailDefaultsService` — manages default templates and per-client overrides

Each has one reason to change. `EmailService` changes if the email provider changes. `EmailTemplateService` changes if the template format changes. Neither knows about the other.

`EmailService` as written:

```python
class EmailService:
    """Sends emails via the Resend REST API."""

    def __init__(self, api_key: str, from_address: str) -> None:
        self._api_key = api_key
        self._from_address = from_address

    async def send_email(self, to: str, subject: str, html_body: str) -> EmailResult:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {self._api_key}", ...},
                json={"from": self._from_address, "to": [to], "subject": subject, "html": html_body},
                timeout=30.0,
            )
        ...
```

It receives an already-rendered `html_body`. It does not know how that HTML was produced. The router combines both:

```python
@router.post("/emails/send")
async def send_email(payload: SendEmailRequest, db: Client = Depends(get_db)) -> EmailResult:
    template_service = EmailTemplateService(db)
    html_body = await template_service.render(payload.template_id, payload.variables)

    email_service = get_email_service()  # injected from config
    return await email_service.send_email(payload.to, payload.subject, html_body)
```

The router orchestrates. The services stay focused.

---

## Session Management: SRP in the Service Layer

SIRA-214 (MR !120) added `SessionService`, which handles the session lifecycle: create, list, revoke, enforce device limits. The router is thin:

```python
@router.get("/sessions")
async def list_sessions(
    current_user: UserResponse = Depends(get_current_user),
    db: Client = Depends(get_db),
) -> list[SessionResponse]:
    service = SessionService(db)
    return await service.list_sessions(current_user.id, current_user.session_id)
```

All device-limit logic lives in `SessionService`, not in the router. The router handles HTTP concerns (auth dependency, response schema). The service handles business logic (MAX_SESSIONS cap, oldest-session eviction, ownership validation on revoke).

The DB layer (`db/queries/user_sessions.py`) handles only SQL: no business logic, no HTTP context. This three-layer separation means each layer can be tested in isolation, which was important for covering the session-limit edge cases.

---

## Router-Service-DB Pattern Maintained in Cancel Invoice

SIRA-125 (MR !118) added invoice cancellation. The same layered pattern holds:

- `routers/invoices.py`: validates the incoming request, calls service, returns 200
- `services/invoice_service.py`: enforces the cancellation rules (UNPAID/OVERDUE only), updates status
- `db/queries/invoices.py`: executes the DB mutation

No business logic leaked into the router. No DB calls from the service directly. Consistent with every other feature in the backend.

---

## Results

- 3 new services introduced this week, each with a single responsibility
- All services are dependency-injectable (accept `db: Client` in `__init__`)
- Router-Service-DB pattern maintained across email, sessions, and cancel invoice
- 100% test coverage on all new service code

---

## Evidence

- MR !108 — [SIRA-160](https://linear.app/ppl-sira/issue/SIRA-160): `apps/api/src/app/services/email_service.py`, `email_template_service.py`, `email_defaults.py`
- MR !120 — [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214): `apps/api/src/app/services/session_service.py`, `routers/sessions.py`, `db/queries/user_sessions.py`
- MR !118 — [SIRA-125](https://linear.app/ppl-sira/issue/SIRA-125): `apps/api/src/app/services/invoice_service.py`
