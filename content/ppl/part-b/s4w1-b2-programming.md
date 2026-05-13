---
title: "[S4, W1] PPL: Eight Modules, One Responsibility Each"
date: 2026-05-13
description: "The new sira-mr-bot service uses a deliberately flat module layout: each of the eight src files owns exactly one concern, communicates through narrow function signatures or Protocol interfaces, and stays under 200 lines. Plus a small but pointed RBAC refactor that swaps string literals for role constants."
tags: ["ppl", "programming", "solid"]
slug: "s4w1-programming"
toc: true
---

## What I Worked On

Two MRs this week with structural rather than behavioral wins. MR !275 (sira-mr-bot service) is shaped around single-responsibility modules and dependency inversion via Protocol classes. MR !300 (RBAC expansion) shipped a small but important refactor at `apps/api/src/app/dependencies.py` and the invoice service that replaces hard-coded role string literals with named constants.

## sira-mr-bot: Eight Modules, Eight Responsibilities

The service is 681 lines of Python across exactly eight source files:

```
services/sira-mr-bot/src/sira_mr_bot/
├── __init__.py    1 line
├── config.py     52 lines    Settings (env) + UserMap (mtime-cached JSON)
├── transitions.py 79 lines   Classify GitLab webhook payload → Transition
├── linear.py     16 lines    Extract Linear ticket id from MR metadata
├── store.py      52 lines    Redis adapter: msg_id, summary cache, NX lock
├── summarize.py 121 lines    Gemini Flash client + truncation fallback
├── discord.py   170 lines    Discord webhook client + embed builder
└── main.py      190 lines    FastAPI routes + orchestration
```

Each file's name maps to one concern. The biggest is `main.py` at 190 lines and it deliberately does nothing except wire the others together. The smallest is `linear.py` at 16 lines and it does one thing: pull a Linear ticket id out of a branch name, MR title, or description with a regex.

The acid test for "single responsibility": for every file, can you describe what it does in one sentence that doesn't use the word "and"? Yes:

- `config.py` reads env vars into a typed Settings object.
- `transitions.py` classifies a GitLab webhook payload into an MR transition.
- `linear.py` extracts a Linear ticket id from text.
- `store.py` adapts Redis for the bot's three key namespaces.
- `summarize.py` calls Gemini and post-processes the response.
- `discord.py` posts and patches Discord embeds.
- `main.py` orchestrates the webhook flow.

When a file's purpose can't be stated without "and," that's a signal to split. None of these can.

## Dependency Inversion via Protocols

The summarizer is the cleanest example. `summarize.py` defines a `Protocol` for the Gemini client, and the production implementation `GoogleGenAiClient` satisfies it implicitly:

```python
class GeminiClient(Protocol):
    async def generate(self, *, model: str, prompt: str, timeout_s: float) -> str: ...


class GoogleGenAiClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def generate(self, *, model: str, prompt: str, timeout_s: float) -> str:
        from google import genai
        client = genai.Client(api_key=self._api_key)
        # ...
```

Tests pass a `FakeGemini` (a plain class with the same method) without needing to inherit from anything. The `summarize_mr(client: GeminiClient, ...)` function accepts either. This is structural typing, not nominal: any object with the right method shape works, and mypy verifies the shape statically.

The benefit shows up in `test_summarize.py`: not a single line of `MagicMock` or `monkeypatch`. The fake is 4 lines of plain Python that returns a hardcoded string. The summarizer's contract (input prompt, output text, timeout in seconds) is the only thing the test asserts.

Why this over a "regular" mock library? Two reasons. First, the test fake is a class I can grep for; if Gemini's interface ever changes, mypy yells at the production class AND at the test fake on the same line. Second, the Protocol doc-strings exactly the contract the summarizer needs, so the production class doesn't accidentally start to depend on Google-specific bells and whistles. The fake won't compile if the real call grew a sneaky parameter.

## State Machine, Not String Soup

GitLab MR transitions are a finite state machine. The bot only cares about four states (OPENED, DRAFTED, MERGED, CLOSED) and the moves between them. Representing this with strings ("opened", "draft", "merged", "closed") would have invited bugs the first time someone typo'd `"draftd"` and a comparison silently went false. Instead, `transitions.py` uses a `Literal` type:

```python
TransitionKind = Literal["OPENED", "DRAFTED", "MERGED", "CLOSED"]


@dataclass(frozen=True)
class Transition:
    kind: TransitionKind
    mr_iid: int
    title: str
    description: str
    author_username: str
    source_branch: str
    target_branch: str
    web_url: str
```

`frozen=True` makes the dataclass immutable; a `Transition` can't be mutated after construction. `Literal[...]` constrains `kind` at type-check time; mypy rejects any code that compares it against a string outside the four allowed values. The webhook router downstream pattern-matches on `kind` with a clean four-arm match statement instead of a string ladder.

The classify function is pure: input is a webhook payload dict, output is `Transition | None`. No side effects, no IO. That makes it trivially testable (the red commit `33daa7be` pinned 11 cases including malformed payloads) and trivially composable; the integration test in `main.red` just calls `classify(payload)` and feeds the result into a fake Discord client.

## Fail-Open: The Most Important Design Decision

The webhook handler in `main.py` includes a single design decision that drove a lot of the module shapes: when Redis is unreachable, **still post the Discord card**. The whole point of the bot is "the team sees the MR card on Discord." Losing the dedup-check is acceptable; losing the notification is not.

This shows up in `store.py` as defensive coding:

```python
async def acquire_lock(self, key: str, ttl_seconds: int) -> bool:
    try:
        return bool(await self._redis.set(key, "1", nx=True, ex=ttl_seconds))
    except RedisError as e:
        log.warning("redis lock acquire failed; failing open: %s", e)
        return True  # Caller proceeds without dedup
```

The deliberate choice is to return `True` (lock acquired) on Redis failure, so the caller continues with the Discord post. The alternative (raise or return False) would have suppressed the notification entirely. The test `d18c8c64` pinned this behavior before the implementation existed.

This single decision changed two module shapes: `store.py` couldn't be a thin wrapper that propagates exceptions; it had to swallow Redis errors and log them. `main.py` couldn't gate the Discord post on lock acquisition; it had to proceed regardless. SRP doesn't mean "each module is independent"; it means "each module owns its policy decisions and the others trust it."

## RBAC: Strings to Constants

MR !300 (SIRA-364) shipped a small refactor in `apps/api/src/app/dependencies.py` and the invoice service. Before: role checks compared against string literals.

```python
# Before
if user.role != "admin":
    raise HTTPException(403, "Admin only")

if "admin" in {user.role, "ar_staff"}:
    ...  # noqa: this is a real example of the kind of confusion this caused
```

After:

```python
# After: apps/api/src/app/dependencies.py
ROLE_ADMIN = "admin"
ROLE_AR_STAFF = "ar_staff"

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
```

This is the smallest possible "constants over magic strings" refactor and it cost ~20 lines of diff. Why bother? Two reasons. First, grep-ability: `git grep ROLE_ADMIN` lands on every gate in the API. Grep for `"admin"` and you also catch model fixtures, error messages, and SQL queries. Second, future-proofing: when the RBAC expansion adds new roles (the design doc at `docs/rbac-role-matrix.md` foresees more), the constants are the canonical source of truth. A typo in `"admin"` is silent; a typo in `ROLE_ADMNI` fails import.

This is the kind of YAGNI-violating-but-cheap refactor I generally avoid, but when it's free in terms of diff size AND directly enables the integration tests that came in the same MR (437 lines in `test_rbac_expansion_integration.py` that use the same constants), it's worth doing.

## What I Learned

Two patterns held up under the week's load:

**Flat module layout scales further than I expected.** Eight files in one directory is more readable than three files at 250 lines each. Every file's name is its purpose; navigation is `find services/sira-mr-bot -name "*.py"` followed by a tab-complete. No nested packages, no `core/` vs `utils/`, no `helpers/`. When in doubt: one more file.

**Protocols beat ABCs in tests.** A `Protocol` is implicit; any class with the right method shape satisfies it. An `ABC` requires inheritance. For test fakes, that distinction matters: fakes shouldn't have to know about the real class hierarchy. They should know about the contract. Protocols make the contract the only thing tests depend on.

## Evidence

- [MR !275 SIRA-354 sira-mr-bot service](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/275): 681 LOC across 8 single-responsibility modules
- [MR !300 SIRA-364 RBAC expansion & hardening](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/300): role constants + 437-line integration test suite
- Source: Protocol example: `services/sira-mr-bot/src/sira_mr_bot/summarize.py:64`
- Source: Literal type + frozen dataclass: `services/sira-mr-bot/src/sira_mr_bot/transitions.py:4`
- Source: fail-open behavior: `services/sira-mr-bot/src/sira_mr_bot/store.py:30`
- Source: role constants: `apps/api/src/app/dependencies.py`, referenced from `apps/api/src/app/routers/clients.py:1`
- Design reference: `docs/rbac-role-matrix.md` (134 lines, single source of truth for capability matrix)
