---
title: "PPL: Secure Defaults in Rich Text and Notifications [Sprint 3, Week 1]"
date: 2026-04-22
description: "Sanitizing HTML input with Bleach, masking secrets in logs, and enforcing HTTPS for external API calls."
tags: ["ppl", "security"]
slug: "s3w1-security"
toc: true
---

## What I Worked On

This week I implemented security measures in two areas: the new Tiptap email template editor, where admins can input HTML, and the Telegram notification service, which handles bot tokens and chat IDs.

## HTML Sanitization in Email Templates

The Tiptap editor outputs HTML that gets stored in the database and later rendered into emails. To prevent XSS, I added a Bleach allowlist to the `EmailTemplateUpdate` Pydantic model:

```python
_ALLOWED_TAGS = {
    "p", "br", "strong", "em", "u", "s", "ul", "ol", "li",
    "a", "h1", "h2", "h3", "span"
}

_ALLOWED_ATTRS = {
    "a": ["href", "target"],
    "span": ["class", "data-variable"],
}

def _sanitize_html(value: str) -> str:
    return bleach.clean(value, tags=_ALLOWED_TAGS, attributes=_ALLOWED_ATTRS, strip=True)
```

The `strip=True` parameter removes disallowed tags entirely rather than escaping them, which prevents broken markup from appearing in emails. The `data-variable` attribute on `span` is preserved because our variable chips rely on it for styling.

I also added a regression test in `test_email_templates.py` that verifies a `<script>` tag is stripped while a `<p>` tag survives.

## Telegram Bot Token Masking

The `TelegramService` logs its actions for debugging, but logging a bot token would leak a secret. I added masking logic that shows only the last 4 characters of the chat ID in logs:

```python
masked = f"****{chat_id[-4:]}" if len(chat_id) > 4 else "****"
logger.info("Sending Telegram message to chat_id=%s", masked)
```

This is tested explicitly in `test_telegram_service.py` with exact value assertions:

```python
async def test_masking_long_chat_id_produces_correct_mask(self) -> None:
    service = TelegramService("test_token_mask_exact", "123456789")
    # ...
    assert any("****6789" in str(c) for c in info_calls)
```

## HTTPS Enforcement

All Telegram API calls use `https://api.telegram.org/bot{token}/sendMessage`. There is no HTTP fallback. The timeout is hardcoded to 10 seconds to prevent hanging connections. Both the URL construction and timeout are tested with exact assertions, so a configuration drift that switches to HTTP or changes the timeout would fail tests immediately.

## What I Learned

Security in a feature-rich editor is a balancing act. Tiptap supports links, headings, lists, and styled text. Bleaching too aggressively breaks legitimate formatting; bleaching too little creates XSS vectors. The allowlist approach forces an explicit decision for every tag and attribute. I expect this list to grow as we add more editor features, but each addition will be a conscious security review.

## Evidence

- [MR !200 - Tiptap WYSIWYG editor](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200)
- Commit `7c60d86f` — Telegram connection test and chat ID setup
- Source: `apps/api/src/app/models/email.py`
- Source: `apps/api/src/app/services/telegram_service.py`
- Source: `apps/api/tests/test_telegram_service.py`
