---
title: "[S3, W1] PPL: Component Architecture"
date: 2026-04-22
description: "Separating a Tiptap rich editor into layered components and wiring Telegram notifications through existing services without creating a God object."
tags: ["ppl", "programming"]
slug: "s3w1-programming"
toc: true
---

## What I Worked On

This week I worked on two architectural problems: how to embed a Tiptap rich editor into our email template system without turning the page component into a mess, and how to add Telegram notifications without creating a notification God object.

## Tiptap Editor: Separation of Concerns

Email templates previously used raw HTML textareas. Replacing that with Tiptap (a ProseMirror-based editor) meant handling toolbar buttons, slash-command variable insertion, chip rendering, and HTML serialization. I kept the page component thin by extracting four focused pieces:

1. `RichEditor` — the top-level React component that mounts Tiptap and renders the toolbar
2. `VariableMenu` — the slash-command dropdown for inserting template variables
3. `VariableNode` — a custom ProseMirror node that renders `{{ variable }}` as a styled chip
4. `TEMPLATE_VARIABLES` — a canonical list in `apps/api/src/app/services/template_variables.py` that both frontend and backend consume

The email template page only imports `RichEditor` and passes `value`, `onChange`, and `variables`. It does not know about ProseMirror, Tiptap extensions, or chip styling. This made the page component stay under 50 lines even after the upgrade.

```tsx
// Email template page only cares about this interface
<RichEditor
  value={template.body_html}
  onChange={(html) => setTemplate({ ...template, body_html: html })}
  variables={variableList}
/>
```

## Telegram Notifications: Hook, Don't Own

The Telegram service (`TelegramService`) is intentionally small: it knows how to send a message to a chat ID and nothing else. The interesting architectural decision was where to call it.

Instead of adding Telegram logic to every service that might need it, I added thin notification hooks to the four services that already orchestrate business events:

- `PaymentService` — notifies when a payment is recorded
- `ReminderService` — notifies when a reminder is sent
- `RiskService` — notifies when a client is flagged HIGH risk
- `check_overdue` Celery task — notifies when invoices become overdue

Each service calls a single `notify_*` function from `telegram_notification_service.py`, passing only the event type and a summary. The notification service decides whether to send to Telegram, email, or both. This means `TelegramService` remains replaceable. If we switch to Slack tomorrow, only the notification dispatcher changes.

```python
# check_overdue.py: only knows that a notification *might* happen
async def _notify_all() -> None:
    for inv_id in ids:
        invoice = await get_invoice_by_id(db, inv_id)
        if invoice:
            await notify_overdue_detected(db, invoice)
```

## What I Learned

The Tiptap migration taught me that editor state is a separate concern from page state. Initially I tried to sync Tiptap's internal `editor.getHTML()` with React state on every keystroke. That caused cursor jumps. The fix was to let Tiptap own its state and only emit HTML when the user blurs or explicitly saves. This is the same pattern as native `<input>` versus controlled React inputs: sometimes uncontrolled is the right abstraction.

## Evidence

- [MR !200 - Tiptap WYSIWYG editor with slash-command variables](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200)
- Commit `d3c9c23d` — refactor: wire Telegram hooks into overdue, payment, reminder, risk services
- Source: `apps/web/src/components/rich-editor/rich-editor.tsx`
- Source: `apps/api/src/app/services/telegram_notification_service.py`
- Source: `apps/api/src/app/workers/check_overdue.py`
