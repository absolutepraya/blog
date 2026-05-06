---
title: "[S3, W3] PPL: State Machines, DB-Backed Templates, and Configurable Rules"
date: 2026-05-06
description: "How the Telegram interactive callback flow is structured around persisted state with row-level snooze snapshots, why template storage moved into the DB with a code-side fallback, and how the configurable suggestion rules use a parse-don't-validate boundary to stay safe at runtime."
tags: ["ppl", "programming"]
slug: "s3w3-programming"
toc: true
---

## What I Worked On

Three programming-design choices this week that I think generalize: the interactive callback state machine in MR !255, the DB-backed template storage with code-side fallback in MR !253, and the configurable rule parser pattern reused for suggestion rules in MR !248. Each one solved a problem where the obvious naive design would have created a sharp edge later.

## State Machine for Telegram Interactive Callbacks (MR !255)

When a Telegram alert message has buttons (Snooze, Mark Reviewed, Acknowledge), the system needs to track several things across time:

1. Which entity does the message refer to (`notification_id` → `entity_type` + `entity_id`)
2. What state the message is in (active vs snoozed-until-X vs acknowledged)
3. The history of actions taken (who clicked what, when)
4. Enough information to **reconstruct the footer** correctly when an action triggers a message edit

That last point is the design subtlety. The naive approach is to store just the current state and re-derive the footer from it. But the footer needs to show "Snoozed by @abhip until 14:00" with a snapshot of who snoozed and when, even if the snooze later expires or gets overridden. Re-deriving that from current state alone loses information.

The state model I landed on:

```python
class TelegramInteractiveState(BaseModel):
    notification_id: UUID
    entity_type: Literal["invoice", "client", "payment", "high_risk_alert"]
    entity_id: UUID
    chat_id: int
    message_id: int
    status: Literal["active", "snoozed", "acknowledged", "completed"]
    snoozed_until: datetime | None
    snoozed_by_user_id: UUID | None
    last_action_at: datetime | None
```

Plus a separate `telegram_action_history` table where each row is an immutable record of one button click, including a `snooze_snapshot` JSON column that captures the exact state at the moment of the snooze. That snapshot is what the footer renderer reads when reconstructing the display, so the footer is always faithful to what actually happened, not the current derived state.

The deliberate design choices:

**`status` as `Literal[...]` not enum.** Same reason as the failure-classification dataclass from S3W2: Pydantic and Supabase handle string literals natively, no enum-to-string friction at the storage boundary. Compile-time exhaustiveness through `match` statements still works.

**Immutable action history alongside mutable state.** The `telegram_interactive_state` row is the current truth (status, snooze, etc.). The `telegram_action_history` rows are append-only audit log. This is a pattern from event sourcing: keep the projection mutable for fast reads, keep the events immutable for audit and replay.

**Footer reconstruction from `snooze_snapshot`, not from current state.** This came from a "what if the snooze expires while we're editing?" thought experiment. If the renderer reads current state, the footer says "Snoozed until [past time]" which is nonsense. Reading the snapshot avoids this entirely.

## DB-Backed Templates with Code-Side Fallback (MR !253)

The Telegram message templates (overdue detected, payment received, reminder sent, daily digest) used to live as Python f-strings in `telegram_templates.py`. Editing them required a deploy. SIRA-304 moves them into the DB so admins can tune wording through the settings UI.

Naive design: read from DB on every render. Risks: DB outage breaks notifications, slow query stalls the worker, missing template row crashes.

The design I shipped:

```python
async def render_template(
    event: TelegramEvent,
    context: TemplateContext,
    db: Client,
) -> str:
    custom = await get_template(db, event=event)
    if custom is not None:
        try:
            return _render_jinja(custom.body, context)
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            # fall through to hardcoded default
    return _render_default(event, context)
```

Three things to call out:

**The hardcoded defaults stay in code.** They are the runtime safety net. A DB outage means we render with defaults; the notifications still go out. This is the same parse-don't-validate principle from S3W2's digest priority rules: a single misconfigured input must not crash the periodic job.

**The custom template is opt-in.** No row in the DB → use the default. There is no migration that pre-seeds rows with copies of the defaults; that would mean every default change requires a data migration to keep them in sync. Instead, the DB is for overrides only.

**Sentry capture on render failure, not silent swallow.** If a custom template has bad Jinja syntax, we want to know. The fallback runs (so the user gets a notification), but the operator gets a Sentry issue.

The Storage layer is correspondingly simple: a `telegram_templates` table with `(event, locale)` unique key, a `body` text column, and audit columns. CRUD endpoints map 1:1 to these rows.

## Parse-Don't-Validate for Suggestion Rules (MR !248)

The Telegram suggestion strings (the "tunggu 7 hari, eskalasi ke TEGAS" copy at the bottom of overdue alerts) used to live as hardcoded f-string fragments in `telegram_suggestions.py`. SIRA-298 moves them into `app_settings.telegram_suggestions` as a JSON rules map.

```json
{
  "low_risk_first_alert": "tunggu {grace_days} hari, eskalasi ke TEGAS jika belum ada pembayaran",
  "medium_risk_followup": "kirim pengingat TEGAS",
  "high_risk_first_alert": "kirim pengingat PERINGATAN, eskalasi ke manajemen jika perlu",
  ...
}
```

Two boundary points where this rules map can fail: at save (admin types something invalid) and at runtime (the saved rules don't match what the code expects).

I handled them differently:

**Save-time validation is strict.** The settings PATCH endpoint runs `validate_suggestion_rules(new_rules)` which checks every key against an allowlist and rejects unknown keys with HTTP 400 + a descriptive error. This is the user-facing boundary, so being strict is friendly: the admin gets immediate feedback about typos.

**Runtime parsing is forgiving.** `load_suggestion_rules(db)` reads the row, falls back to defaults for any missing key, and skips (with a Sentry warning) any rule whose value isn't a non-empty string. This is the system-facing boundary, so being lenient prevents a misconfigured row from breaking the daily digest at 8am.

This split is the right shape for any "user-tunable runtime config" feature. Strict where humans interact, lenient where the runtime reads.

## What I Learned

The thread connecting these three: **boundary discipline**. The state machine isolates current-state from event-history. The template system isolates DB overrides from code-side defaults. The rules parser isolates strict save validation from forgiving runtime load. In each case, the boundary lets one side fail without breaking the other.

These aren't novel patterns. The skill was recognizing where a boundary belonged in this specific feature, then keeping the boundary thin enough to be maintainable.

## Evidence

- [MR !255 SIRA-300 Telegram interactive button groundwork](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/255) — state machine + action history + footer reconstruction
- [MR !253 SIRA-304 Telegram template editor + runtime fallback](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/253) — DB-backed templates with code-side fallback
- [MR !248 SIRA-298 configurable Telegram suggestion rules](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/248) — strict save / lenient load boundary
- Source: `apps/api/src/app/services/telegram_callback_service.py`, `apps/api/src/app/db/queries/telegram_interactive_state.py`, `apps/api/src/app/services/telegram_templates.py`, `apps/api/src/app/services/telegram_suggestions.py`
