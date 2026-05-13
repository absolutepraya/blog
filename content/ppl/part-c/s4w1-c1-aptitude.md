---
title: "[S4, W1] PPL: Applying Four Unfamiliar Technologies to Ship One Service"
date: 2026-05-13
description: "Building sira-mr-bot end-to-end meant first-time use of the Gemini SDK, Discord webhooks at the embed-edit level, Redis SETNX as a concurrency primitive, and FastAPI's lifespan event for graceful startup. Plus integrating all four with the existing CI/CD pipeline and Nashta VM infra."
tags: ["ppl", "aptitude"]
slug: "s4w1-aptitude"
toc: true
---

## What I Worked On

The sira-mr-bot service (MR !275 and follow-ups) required first-time application of four technologies I hadn't used in this project before:

1. **Gemini SDK** (`google-genai`) for MR summaries
2. **Discord webhooks at the embed-patch level** (not just POST)
3. **Redis SETNX** as a distributed lock primitive
4. **FastAPI lifespan events** for service startup

None of these is the most advanced technology in its category. The aptitude lens is "applied four unfamiliar things in seven days, end-to-end, with a working production deploy." That's the work this blog describes.

## Gemini SDK: From Tutorial to Production in One Module

The official `google-genai` Python SDK exposes a synchronous `generate_content` call. Our service is async. The integration at `services/sira-mr-bot/src/sira_mr_bot/summarize.py:67`:

```python
class GoogleGenAiClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def generate(self, *, model: str, prompt: str, timeout_s: float) -> str:
        from google import genai
        client = genai.Client(api_key=self._api_key)

        def _call() -> str:
            resp = client.models.generate_content(model=model, contents=prompt)
            text = getattr(resp, "text", None) or ""
            return str(text).strip()

        return await asyncio.wait_for(asyncio.to_thread(_call), timeout=timeout_s)
```

Three decisions worth calling out as "applied appropriately for the project," not just "copied a tutorial":

**Lazy import.** `from google import genai` lives inside the method, not at module top. Reason: tests pass a `FakeGemini` and shouldn't need the `google-genai` package installed at all. Top-level import would force the test environment to install a 50MB SDK for no reason.

**`asyncio.to_thread` + `wait_for`.** The Google SDK doesn't natively support async; running it in a worker thread via `asyncio.to_thread` lets it not block the FastAPI event loop. The `wait_for` adds an enforced timeout (default 8 seconds via Settings), so a hung Gemini call can't lock up the webhook.

**Lazy client construction.** A new `genai.Client(...)` is created per call rather than cached on the wrapper. This is the slower path but the safer one for a low-volume service; client caching would have invited surprising state-sharing bugs between requests.

I'd never used `google-genai` before this MR. The "applied appropriately" part is the three decisions above; without them, the integration would have worked in the happy path but crashed under any kind of load or failure.

## Discord Webhooks: Beyond POST to PATCH

Most Discord webhook examples show `POST /webhooks/<id>/<token>` to send a new message. The mr-bot needs to *edit* an existing message when an MR transitions (OPENED → MERGED → CLOSED). This requires hitting a different endpoint:

```python
# POST: create new message
POST https://discord.com/api/webhooks/<id>/<token>?wait=true

# PATCH: edit existing message
PATCH https://discord.com/api/webhooks/<id>/<token>/messages/<message_id>
```

The `?wait=true` on POST is required to receive the new message's id in the response body. Without it, Discord returns 204 No Content and you have no way to edit later. This is documented but easy to miss. The mr-bot wraps both endpoints in `discord.py` with explicit error handling for the cases where Discord returns 200 OK with a body that's missing the `id` field (it has happened; edge case covered by red commit `0a3c5029`).

The other Discord-specific learning was the embed structure: a Discord embed has up to 25 fields, each with a name and value, plus title, description, color, footer, timestamp, author. Each field's value is up to 1024 characters, the description is up to 4096, and the *whole embed* is up to 6000 chars. The Gemini summary lives in the description and is capped at `SUMMARY_MAX_CHARS` (configurable, default ~600) to leave room for the title, fields, and footer.

These constraints aren't obvious until you hit a 400 Bad Request from Discord and have to figure out which limit you exceeded. Encoding them as Settings constants (`SUMMARY_MAX_CHARS`, `TRUNCATION_FALLBACK_CHARS`) instead of magic numbers in the code makes them tunable when the constraints change.

## Redis SETNX as a Concurrency Primitive

GitLab webhooks are delivered with at-least-once semantics. The same webhook can fire twice (network blip, retry, manual replay). If the bot processes both, it would post duplicate Discord cards. The mr-bot uses Redis `SET key value NX EX ttl` (atomically set if not exists, with TTL) as a per-MR lock:

```python
async def acquire_lock(self, key: str, ttl_seconds: int) -> bool:
    try:
        return bool(await self._redis.set(key, "1", nx=True, ex=ttl_seconds))
    except RedisError as e:
        log.warning("redis lock acquire failed; failing open: %s", e)
        return True  # Caller proceeds without dedup
```

`nx=True` means "set only if the key doesn't already exist." `ex=ttl_seconds` means "expire after this many seconds." The combination gives us a self-expiring lock: the lock auto-releases if the holder crashes mid-process, so we don't need a separate "release" call in the happy path either.

I'd seen the SETNX pattern before but never implemented it. The interesting part was choosing the TTL. Too short (a few seconds): a slow Gemini call could lose its lock and the webhook could re-process. Too long (minutes): a real duplicate webhook would be silently dropped for too long, hiding bugs. The bot uses 30 seconds, which is the p99 of "Gemini summary + Discord POST" measured locally with bad-day timeouts. Bumped from 5 seconds to 30 seconds in commit `8012f10a` after we observed real Gemini calls occasionally taking 15-20 seconds.

## FastAPI Lifespan + Worker Architecture

The service uses FastAPI's lifespan context manager to set up the Redis connection at startup and tear it down at shutdown:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    redis_client = await create_redis_client(settings)
    app.state.store = Store(redis_client)
    yield
    await redis_client.close()
```

Lifespan is FastAPI's recommended pattern (replacing the older `@app.on_event("startup")`). The reason it matters: Redis connection pooling lives at the app instance level. If you create a new client per request, you exhaust the OS's TCP file descriptor budget under load. If you create one at module import, you can't shut it down cleanly. Lifespan threads the needle.

This is the kind of "should work" detail that turns into a production incident on day 14 if you skip it. Setting it up correctly from day 1 cost ~10 lines of code.

## Integration With Existing Infra

The bot doesn't run in isolation. It plugs into:

- **CI pipeline**: `.gitlab-ci.yml` got two new jobs (`mr-bot:build` and `mr-bot:deploy`). Build runs Docker build + push; deploy SSHes to Nashta and restarts the container. Both are gated to `main` only.
- **Nashta nginx**: a new server block routes `sira-mr-bot.nashtagroup.co.id` to the container at `127.0.0.1:18080`. Set up in commit `44841980` and refined for deploy-without-sudo in MR !286.
- **Docker Compose**: `infra/docker-compose.yml` got a new service entry. The bot connects to the same Redis instance the rest of the app uses, on db `/3` (so it doesn't collide with Celery's `/0`, the app's `/1`, or cache's `/2`).
- **GitLab webhook**: configured manually post-merge with the bot's URL + secret token.

Eight files across `.gitlab-ci.yml`, `infra/docker-compose.yml`, `nginx`, and DNS. None individually complex; doing all of them correctly so the bot actually fires on real MRs is the real test of aptitude. Pipeline 16244 (after MR !286 + MR !288) was the first one where the deploy succeeded and the bot posted its first card.

## What This Demonstrates About Aptitude

Aptitude isn't "knows the most technologies." It's "picks up unfamiliar technologies and applies them appropriately for the project's constraints." The four new things this week each had a project-specific decision attached:

- Gemini: free tier matters more than absolute quality for our volume
- Discord: edits matter, so PATCH endpoint matters, so storing message ids matters
- Redis SETNX: 30-second TTL because that's the p99 of our slowest happy path
- FastAPI lifespan: because we need connection pooling and clean shutdown, not just a working hello-world

None of those choices is obvious from the SDK's getting-started docs. They came from thinking about how the technology meets the project's actual requirements.

## What I Learned

Two patterns from this week:

**Reading the SDK docs is necessary, not sufficient.** Every one of the four technologies has a tutorial that gets you a working demo in 20 minutes. The hard part is the 20 minutes of demo plus the 5 hours of "now make it work in our project's constraints." Aptitude is the second half.

**Integration with existing infra is its own skill.** The bot's code is 681 lines; the integration with CI, nginx, Docker Compose, GitLab webhook, and Nashta is another ~300 lines spread across 6 files. The integration work is unglamorous but it's what makes a service real instead of a demo.

## Evidence

- [MR !275 SIRA-354 mr-bot service](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/275): Gemini + Discord + Redis + FastAPI lifespan
- [MR !286 SIRA-356 deploy without sudo, route via sira-api nginx](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/286): infra integration
- [MR !288 SIRA-356 make mr-bot:deploy self-sufficient](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/288): CI deploy job
- Source: Gemini async wrapper: `services/sira-mr-bot/src/sira_mr_bot/summarize.py:67`
- Source: Discord client with PATCH support: `services/sira-mr-bot/src/sira_mr_bot/discord.py`
- Source: Redis SETNX lock: `services/sira-mr-bot/src/sira_mr_bot/store.py`
- Source: FastAPI lifespan: `services/sira-mr-bot/src/sira_mr_bot/main.py`
- Source: CI deploy job: `.gitlab-ci.yml` `mr-bot:build:` and `mr-bot:deploy:` blocks
- Source: Nashta nginx routing commit `44841980`: `feat(infra): route /_mr-bot/ through sira-api nginx to bot container`
- Pipeline 16244: first successful deploy and webhook fire
