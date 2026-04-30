---
title: "[S3, W2] PPL: Dispatcher, Templates, and Toggle Architecture"
date: 2026-04-29
description: "How the Telegram notification feature was structured around a dispatcher pattern with explicit toggle short-circuits, a typed delivery-result dataclass, and defensive parsing for runtime config that comes from a database."
tags: ["ppl", "programming"]
slug: "s3w2-programming"
toc: true
---

## What I Worked On

The Telegram feature merged this week (MR !221) is the first place in SIRA where one feature triggers four distinct downstream notification paths. That kind of fan-out is where good architecture pays off. I want to walk through three programming choices I made that the team can copy in future fan-out features: the dispatcher pattern with toggle short-circuits, a structured `TelegramSendResult` for delivery outcomes (MR !238), and the defensive runtime-config parser for the digest priority rules (MR !243).

## The Dispatcher Pattern with Toggle Short-Circuit

Four events trigger Telegram messages: an invoice flips to OVERDUE, a payment is recorded, a reminder is sent, and a client is flagged HIGH-risk. Each event lives in a different service (`overdue_checker`, `payment_service`, `reminder_service`, `risk_service`). Naive design would put `TelegramService.send_message(...)` calls scattered through all four service files.

That falls apart fast. Each event has its own:
- toggle (admin can turn off "notify on payment" without affecting the others)
- message template (different fields, different deep-link button)
- failure handling (we want delivery logs even when the send fails)

The right separation is a single dispatcher that owns the per-event policy and exposes a clean method per event. The downstream services know nothing about Telegram, they just call `notify_payment_recorded(...)`:

```python
class TelegramNotificationService:
    def __init__(self, db: Client) -> None:
        self._db = db
        self._telegram = TelegramService()

    async def notify_payment_recorded(
        self, invoice: Invoice, payment: Payment
    ) -> bool:
        if not await self._is_event_enabled("notify_payment_recorded"):
            return False  # short-circuit BEFORE building the message
        try:
            text = render_payment_recorded(invoice, payment)
            buttons = build_payment_buttons(invoice.id, payment.id)
            result = await self._telegram.send_message(
                chat_id=settings.telegram_chat_id,
                text=text,
                parse_mode="MarkdownV2",
                reply_markup=buttons,
            )
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            await persist_delivery_log(self._db, event="payment_recorded", success=False, error=str(exc))
            return False
        await persist_delivery_log(self._db, event="payment_recorded", success=True, message_id=result.message_id)
        return True
```

Three things are deliberate here. First, the toggle check is the first thing the method does, **before** any client/invoice lookup or template rendering. This was a contract I wrote into the failing test before writing the method (last week's TDD blog has the example), and it matters because constructing the message touches DB lookups that can themselves fail. A disabled event should be a one-line, zero-cost path.

Second, the `try/except` wraps the network call only, not the toggle check or the persistence. Mixing those would mean a toggle DB error gets misclassified as a Telegram failure.

Third, `persist_delivery_log` runs in both branches but with different `success` and `error` values. This is explicit, not implicit. There is no `finally` block doing magic; both paths are visible in the method body.

## Structured Delivery Outcomes (MR !238)

The first version of `TelegramService.send_message` returned a raw `httpx.Response`. The dispatcher then had to inspect status codes and parse JSON to figure out what happened. That worked but pushed transport details into business logic. MR !238 (SIRA-305) replaced the raw response with a typed result class:

```python
@dataclass(frozen=True, slots=True)
class TelegramSendResult:
    success: bool
    message_id: int | None
    failure_category: Literal[
        "rate_limit", "chat_not_found", "thread_not_found",
        "bad_request", "network_error", "unknown"
    ] | None
    used_thread_fallback: bool
    raw_status_code: int | None
```

Two design choices to call out. The `frozen=True, slots=True` combo gives us value-object semantics: the result is immutable and has a fixed memory layout. This is the right shape for a delivery outcome that the dispatcher passes to the persistence layer. It cannot be mutated mid-flight by accident, and it is cheap to construct in a hot path.

The `failure_category` is a `Literal` union of strings rather than an enum. SIRA's serialization layer (Pydantic + Supabase) handles string literals natively, so we get the same compile-time exhaustiveness check as an enum without the friction of enum-to-string conversion at the storage boundary. The dispatcher classifies failures into known buckets so the delivery logs have a finite, queryable cardinality:

```python
def _classify_failure(response: httpx.Response, exc: Exception | None) -> str:
    if exc is not None and isinstance(exc, httpx.NetworkError):
        return "network_error"
    if response.status_code == 429:
        return "rate_limit"
    body = response.json() if response.content else {}
    description = body.get("description", "").lower()
    if "chat not found" in description:
        return "chat_not_found"
    if "message thread not found" in description:
        return "thread_not_found"
    if response.status_code == 400:
        return "bad_request"
    return "unknown"
```

When a Telegram group does not have forum topics enabled, sending with a `message_thread_id` returns "thread not found". The service retries without the thread ID and sets `used_thread_fallback=True` on the result. That fallback was the small backend safety-net mentioned in MR !228; once we had structured failures, expressing it was a 6-line addition.

## Defensive Parsing for Runtime Config (MR !243)

The daily digest's "Prioritas Hari Ini" section is driven by rules stored in the `app_settings` table. Admins can edit the rules through the settings UI. Every rule is a JSON document like:

```json
{
  "type": "high_risk_outstanding",
  "min_amount": 5000000,
  "max_per_section": 5,
  "priority": 1
}
```

The naive parser is `json.loads(row["config"])` followed by attribute access. That's a runtime crash waiting for the first admin who saves a malformed rule.

I wrote the parser to be defensive, with a typed return that always succeeds:

```python
@dataclass(frozen=True, slots=True)
class DigestPriorityRule:
    rule_type: Literal["high_risk_outstanding", "long_overdue_no_reminders", "failed_reminder_clusters"]
    min_amount: int
    max_per_section: int
    priority: int

_DEFAULT_MAX_PER_SECTION = 5

def parse_priority_rule(raw: Mapping[str, Any]) -> DigestPriorityRule | None:
    rule_type = raw.get("type")
    if rule_type not in get_args(DigestPriorityRule.__annotations__["rule_type"]):
        sentry_sdk.capture_message(
            "digest_priority_rule.invalid_type", level="warning",
            extras={"value": rule_type},
        )
        return None
    return DigestPriorityRule(
        rule_type=rule_type,
        min_amount=_safe_int(raw.get("min_amount"), default=0),
        max_per_section=_safe_int(raw.get("max_per_section"), default=_DEFAULT_MAX_PER_SECTION),
        priority=_safe_int(raw.get("priority"), default=99),
    )
```

The function returns `None` for unparseable rules instead of raising. The caller filters them out:

```python
rules = [parse_priority_rule(r) for r in raw_rules]
valid = [r for r in rules if r is not None]
```

This means a single bad rule does not silently kill the entire digest. The bad rule is reported to Sentry with its raw value (the only string that should ever exit this layer is the rule_type, no client data leaks into `extras`), and the rest of the digest renders normally. Liveness over correctness is the right tradeoff for a cron job that runs at 8am every day.

The pattern here is **parse, don't validate**. The boundary between "untrusted Mapping from DB" and "trusted dataclass we use everywhere else" is a single function. Once a value is a `DigestPriorityRule`, the rest of the codebase trusts it.

## What I Learned

Three patterns that I will reach for again whenever a new feature introduces fan-out, transport boundaries, or runtime config:

1. **Dispatcher with explicit toggle short-circuit** for any feature where one trigger drives multiple downstream effects. Toggles checked first, transport in a narrow `try`, persistence visible in both branches.
2. **Frozen typed result for transport outcomes** instead of raw library responses. The classifier becomes a boundary, business logic stays clean.
3. **Parse-don't-validate for runtime config** so a malformed entry never crashes a periodic job. Report and skip, render the rest.

These are not novel patterns, but applying them in SIRA's specific context (Pydantic + Supabase + Celery) takes care because the obvious shortcut (raw dicts everywhere) is always tempting.

## Evidence

- [MR !221 SIRA-161 Telegram Phase 1 & 2](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/221) — squash `3f3549b4`
- [MR !238 SIRA-305 Telegram delivery logs](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/238) — squash `05fb6b01`
- [MR !243 SIRA-299 daily digest priorities](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/243)
- Source: `apps/api/src/app/services/telegram_notification_service.py` (331 lines)
- Source: `apps/api/src/app/services/telegram_service.py` (235 lines)
- Source: `apps/api/src/app/services/digest_priority_rules.py`
