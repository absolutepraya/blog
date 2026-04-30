---
title: "[S3, W2] PPL: Telegram Feature Lands Under TDD"
date: 2026-04-29
description: "The Telegram notification feature I built on a worktree last week shipped this week, plus two follow-up MRs (delivery logs, digest priorities) that kept the same red-green-refactor discipline all the way through."
tags: ["ppl", "tdd"]
slug: "s3w2-tdd"
toc: true
---

## What I Worked On

Last week I wrote about the Telegram notification feature being built on a dedicated worktree under strict `red(api)` / `green(api)` paired commits. This week that work landed in main as MR !221 (Phase 1 & 2, all 7 subtasks of SIRA-161), and I followed it with two more feature MRs that kept the same TDD discipline going: MR !238 for delivery logs and MR !243 for the daily digest "Prioritas Hari Ini" section. There is also MR !234 which was a small fix that still went through a red commit before the green.

Three MRs, all paired commits, all merged within the same week. The discipline that started on a worktree stayed on after the merge.

## What "Paired Commits" Means in Practice

The team norm I have been building is that every implementation commit is preceded by a failing-test commit named `red(api):` and followed (or replaced) by an implementation commit named `green(api):`. This is not just naming theatre. The order matters because writing the test first forces me to name the contract before I lock it into code.

Here is the actual git log for MR !243 (daily digest priorities) on the feature branch:

```
b8be1b69 green(api): render digest priorities section
946da839 red(api):   cover digest priority rendering
243c4193 green(api): add daily digest priority queries
0db6fc68 red(api):   cover daily digest priority queries
bfb74c13 green(api): add digest priority settings
39e8f659 red(api):   cover digest priority settings
```

Three full red-green pairs covering three distinct layers: settings parsing, query layer, and the rendering surface. Each pair represents one contract that was named in tests before the implementation existed.

![MR !243 commits view showing the alternating red(api)/green(api) pairs with their commit hashes](/images/ppl/s3w2-b1-mr243-red-green-commits.png)

The screenshot above is the GitLab commits view of MR !243 before squash. Reading top to bottom you can see the discipline as a visual rhythm: every green commit has a red commit immediately below it. The hashes match the ones I quoted from `git log` directly.

The same shape repeats in MR !238 (delivery logs):

```
b8c1a0e2 green(api): persist Telegram delivery outcomes
645dcd84 red(api):   cover Telegram delivery logging
0e71c85b green(api): persist Telegram delivery outcomes
85b9f2d3 red(api):   cover Telegram delivery logging
```

And in MR !234 (test-mode guard for the Telegram bot):

```
86359687 green(api): require opt-in for live Telegram E2E
6bd1d046 red(api):   cover live Telegram E2E guard
47941303 green(api): disable Telegram connection checks in test mode
b2b06fdb red(api):   cover Telegram test-mode guard
```

The pattern is reflexive at this point. I do not write a service method without first writing the test that defines what the method should do.

## A Concrete Example: Why the Test-First Order Matters

The Telegram test-mode guard (!234) is a small example but a clean one for showing the value of red-first.

The problem: our integration-test job in CI runs against a real Supabase, and several tests touch the Telegram service. Without a guard, those tests would call the live Telegram API every CI run, spamming the test bot's chat history and potentially burning rate limits.

I started with the failing test (commit `b2b06fdb`):

```python
@pytest.mark.parametrize("env", ["test", "testing"])
def test_telegram_connection_test_skipped_when_environment_is_test(env, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", env)
    service = TelegramService()
    result = service.test_connection()
    assert result["skipped"] is True
    assert result["reason"] == "test environment"
    # Critically: no HTTP call happened.
    assert service._http_client.call_count == 0
```

Writing that test exposed a question I had not thought through: what should `test_connection()` *return* when it skips? An empty dict? A boolean? An exception? The test forced me to commit to a shape (`{"skipped": True, "reason": ...}`) before any production code locked it in. The implementation in `47941303` then simply made the test pass.

Then a second concern surfaced as I was writing the test: what if a developer wants to run a real end-to-end test against Telegram from their local machine? The skip should not be unconditional. That triggered a second red (`6bd1d046`) covering the opt-in escape hatch:

```python
def test_live_e2e_runs_when_explicitly_confirmed(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("CONFIRM_LIVE_TELEGRAM_TEST", "1")
    # Now the guard should yield to the explicit opt-in.
    ...
```

Both contracts named, both implementations small (`47941303`, `86359687`). If I had written the implementation first, I might have thought of the skip case but I am not sure I would have thought of the explicit-opt-in case. The red-first order surfaced the design constraint before the code was set.

## What Got Tested and How Much

The Telegram surface across the three MRs has substantial test coverage:

| File | Lines |
|------|------:|
| `tests/test_telegram_service.py` | 786 |
| `tests/test_telegram_notification_service.py` | 779 |
| `tests/test_daily_digest.py` | 115 |
| `tests/test_telegram_templates.py` | (covers Markdown V2 escaping, deep-link buttons) |
| `tests/test_telegram_context.py` | (covers digest context queries including priority rules) |

Most of those tests exist because of red-first discipline. Each notification path (`notify_overdue_detected`, `notify_payment_recorded`, `notify_reminder_sent`, `notify_high_risk_flagged`) has explicit positive cases, toggle-disabled cases, error cases, and rate-limit-retry cases. The dispatcher has explicit "short-circuit before constructing message" tests that came directly from a red commit asking "what happens when the toggle is off?".

The MR !221 description records the test counts at merge: **1452 backend tests passing, 782 frontend tests passing**. Those numbers grew across the three MRs as more red commits added more contracts.

## What I Learned

Three things showed up clearly this week.

First, **TDD discipline carries through merge boundaries when the naming convention is enforced**. The worktree had paired commits because I committed to the convention there. After merging into main, I kept committing on follow-up branches with the same prefix scheme, and the convention propagated naturally. There was no "now we're on main, let's relax" moment.

Second, **red-first surfaces the design questions you would otherwise punt**. The `{"skipped": True, "reason": ...}` shape from the test guard is one example. The dispatcher short-circuit is another (last week's blog covered that). In both cases, the design question existed regardless of test order; writing the test first just made me face it earlier and cheaper.

Third, **the test suite becomes a contract artifact, not just a regression net**. Looking at `test_telegram_service.py` (786 lines) tells you what `TelegramService` does without reading the production file. That is a documentation effect of TDD that is hard to get any other way.

## Evidence

- [MR !221 SIRA-161 Telegram Bot Notifications Phase 1 & 2](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/221) — squash `3f3549b4`
- [MR !238 SIRA-305 Telegram delivery logs](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/238) — squash `05fb6b01`
- [MR !243 SIRA-299 daily digest "Prioritas Hari Ini"](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/243)
- [MR !234 SIRA-306 prevent Telegram test notifications](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/234) — squash `a90e0aa8`
- Pre-squash red/green commits: `b2b06fdb` / `47941303`, `6bd1d046` / `86359687`, `85b9f2d3` / `0e71c85b`, `645dcd84` / `b8c1a0e2`, `39e8f659` / `bfb74c13`, `0db6fc68` / `243c4193`, `946da839` / `b8be1b69`
- Source: `apps/api/tests/test_telegram_service.py` (786 lines), `tests/test_telegram_notification_service.py` (779 lines)
