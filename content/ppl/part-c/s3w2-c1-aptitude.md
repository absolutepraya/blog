---
title: "PPL: Third-Party Integration Knowledge [Sprint 3, Week 2]"
date: 2026-04-29
description: "Four substantive new things learned this week to integrate Telegram as a notification channel: the Bot API surface (parse_mode, inline keyboards, message threads), Tenacity for retry-with-backoff, Celery Beat for scheduled jobs, and Markdown V2 escaping rules."
tags: ["ppl", "aptitude", "learning", "telegram", "integration"]
slug: "s3w2-aptitude"
toc: true
---

## Overview

Last week (Sprint 3 Week 1) the Telegram notification feature was in-flight on a dedicated Superset worktree under paired red/green commits. This week it shipped. Three feature MRs landed back-to-back: MR !221 (Phase 1 & 2 of SIRA-161, all 7 subtasks merged), MR !238 (delivery logs, SIRA-305), MR !243 (daily digest "Prioritas Hari Ini", SIRA-299). The interesting Part C angle is what I had to learn to make the integration land. Four new things this week, all outside standard Fasilkom coursework, all applied directly to SIRA.

---

## 1. The Telegram Bot API Surface (Beyond Just `sendMessage`)

Most public examples of Telegram bots stop at `bot.sendMessage(chat_id, text)`. A real notification system needs more: structured formatting, interactive buttons, message threading inside forum groups, and graceful handling when a feature is unavailable on a particular chat. I had to learn four distinct API behaviors:

**`parse_mode="MarkdownV2"`** is Telegram's strict-flavor Markdown. It requires escaping every literal `_`, `*`, `[`, `]`, `(`, `)`, `~`, ``` ` ```, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!` in user-supplied text or the API rejects the message with `400 Bad Request: can't parse entities`. I built an `escape_markdown_v2()` helper in `telegram_templates.py` because Indonesian client names commonly contain dots and parentheses ("PT. Maju (Persero)" being a typical pattern in the dataset).

**`reply_markup` with `InlineKeyboardMarkup`** lets you attach buttons under a message. We use this for deep-link routes back into SIRA: clicking "Lihat Faktur" opens `https://sira.nashtagroup.co.id/admin/invoices/<uuid>` in the browser. Each button is a `(text, url)` tuple, organized into rows. Learning the JSON shape that the Bot API expects took some reading because the Python wrapper I started with had a slightly different schema from the raw HTTP API.

**`message_thread_id`** routes a message to a specific topic inside a Telegram forum group. SIRA's team channel is a forum with topics like "AR Alerts", "Daily Digest", "System". Sending without `message_thread_id` would dump everything into the General topic. The catch: not every group has forums enabled. If you send `message_thread_id` to a non-forum group, the API returns `400 Bad Request: message thread not found`. I learned to **fall back automatically**: if the response matches that error, retry the send without `message_thread_id`. The structured `TelegramSendResult` dataclass tracks `used_thread_fallback: bool` so the dispatcher can record which channels needed the fallback.

**Connection-test and chat-id discovery flow.** A new admin onboarding the bot needs to know their chat ID. The Telegram-recommended approach is to message a bot like `@RawDataBot` and read your chat ID from its reply. I built that into the SIRA settings UI as a visual tutorial (with screenshots), so admins do not need to leave the app to set up notifications. The connection test at `POST /settings/telegram/test` validates the configured `bot_token` + `chat_id` by sending a "✅ Telegram terhubung" message; if it fails, the error message tells the admin which env var is wrong.

None of this is in any Fasilkom course. The official Telegram Bot API docs are 200+ pages. Learning the right subset for a real notification feature took most of two days.

---

## 2. Tenacity for Retry-with-Backoff

The Telegram Bot API rate-limits at 30 messages/second per bot, returning `429 Too Many Requests` with a `Retry-After` header. A naive `requests.post(...)` ignores that. We needed a retry library that:

- Retries on specific exceptions (HTTP 429, network errors), not on user errors (HTTP 400).
- Respects `Retry-After` when present.
- Caps at a small number of attempts so the worker does not block forever.
- Exposes the retry attempts in logs for observability.

I learned [Tenacity](https://tenacity.readthedocs.io/), a Python retry library. The integration looks like this in `telegram_service.py`:

```python
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

@retry(
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.NetworkError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    reraise=True,
)
async def _send_with_retry(client, payload):
    response = await client.post(TELEGRAM_API_URL, json=payload)
    response.raise_for_status()
    return response
```

Three attempts maximum, exponential backoff at 1s, 2s, 4s. The `reraise=True` is important: after the final attempt fails, Tenacity re-raises the original exception so my structured failure classifier in `_classify_failure(...)` can categorize it as `network_error` or `rate_limit`. Without `reraise`, Tenacity wraps the exception in `RetryError` which loses the type information.

The discipline I picked up from Tenacity: **don't retry on 4xx that aren't 429**. A 400 is "you sent a malformed request" and retrying does not help; it just delays the inevitable error. The `retry_if_exception_type` filter prevents that. This is a small thing but easy to get wrong if you reach for a generic `try/except: retry()` pattern.

---

## 3. Celery Beat for Scheduled Tasks

SIRA already used Celery Workers for async jobs (risk scoring, reminder dispatch). The daily digest is different: it must fire at exactly 08:00 WIB every day, even if no business event triggers it. That is what Celery Beat is for.

What I had to learn:

**Worker vs Beat is two processes, not one.** The Celery Worker consumes tasks from Redis and runs them. The Beat scheduler is a separate process that *publishes* tasks to Redis on a schedule. Locally I run both via `make dev` (process-compose), but in production they are two separate Docker services (`api-worker` and `api-beat`). Forgetting Beat means scheduled tasks never fire; you only realize the next morning when the digest doesn't arrive.

**Schedule configuration in `celery_app.py`:**

```python
celery_app.conf.beat_schedule = {
    "send-daily-digest-08-00-wib": {
        "task": "app.workers.daily_digest.send_daily_digest",
        "schedule": crontab(hour=1, minute=0),  # 08:00 WIB = 01:00 UTC
        "options": {"expires": 60 * 30},  # Drop if not started within 30 min
    },
}
```

The timezone gotcha is real: Beat runs in UTC by default. WIB is UTC+7, so 08:00 WIB is 01:00 UTC. I encoded that as `crontab(hour=1, minute=0)` and added a comment so the next contributor does not double-convert.

The `expires` option is a safety. If the worker is down at 08:00 (deploy in progress, etc.), Beat still publishes the task. When the worker comes back up at 09:00, it would normally execute the stale task and send "Daily Digest for yesterday" at the wrong time. Setting `expires=30 minutes` makes the task self-discard if it hasn't started by 08:30. A small thing but it prevents user-visible weirdness on deploy days.

---

## 4. Structured Failure Classification (Beyond `try/except`)

The Telegram service can fail in roughly six ways: rate limit, chat not found, thread not found, bad request (malformed payload), network error, unknown. The naive approach is `except Exception: log_error()`. The disciplined approach is a typed result that names each failure case so downstream consumers can route on it:

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

The b2 (programming) blog this week walks through the design of this dataclass. The Part C angle here is the *learning*: I did not know about `frozen=True, slots=True` as a value-object pattern in Python. The `frozen=True` makes the object immutable (so passing it to `persist_delivery_log(...)` cannot accidentally mutate it). The `slots=True` removes the `__dict__` overhead so each result is cheaper to construct in a hot path. Together they give you "Python's version of a Rust struct".

Combined with `Literal[...]` for the failure category (instead of an enum), the result is type-safe at compile time without serialization friction at the storage boundary. Pydantic and Supabase both handle string literals natively.

This pattern (`frozen` + `slots` + `Literal` for unions) is industrial Python that is rarely covered in coursework. Most Fasilkom Python material treats dataclasses as a syntactic shortcut for `__init__`. The deeper use as a value-object boundary between transport and business logic is what shipped this week.

---

## What Connects These Four

The unifying theme is **integration with a third-party API done responsibly**. The naive integration is `import telegram; telegram.send(...)`. The disciplined integration is:

1. Read the API docs deeply enough to know the failure modes (Bot API surface).
2. Wrap retries on the right exceptions only, never on user errors (Tenacity).
3. Schedule the periodic job with a proper scheduler, not a sleep loop (Celery Beat).
4. Type the result so downstream code can route on it without parsing strings (structured failure classification).

Each of those is a distinct lesson the Fasilkom curriculum does not teach. Collectively they are the difference between "I sent a Telegram message in a hackathon" and "Telegram is a reliable notification channel for SIRA in production".

---

## Evidence

- [MR !221 SIRA-161 Telegram Phase 1 & 2](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/221) — squash `3f3549b4`
- [MR !238 SIRA-305 Telegram delivery logs](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/238) — squash `05fb6b01`
- [MR !243 SIRA-299 daily digest priorities](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/243)
- [MR !234 SIRA-306 prevent Telegram test notifications](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/234) — squash `a90e0aa8`
- Source: `apps/api/src/app/services/telegram_service.py` (235 lines, including Tenacity decorator)
- Source: `apps/api/src/app/services/telegram_notification_service.py` (331 lines, structured `TelegramSendResult`)
- Source: `apps/api/src/app/services/telegram_templates.py` (Markdown V2 escaping + deep-link button builders)
- Source: `apps/api/src/app/workers/celery_app.py` (Beat schedule for daily digest)
