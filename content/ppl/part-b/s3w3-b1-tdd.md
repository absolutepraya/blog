---
title: "[S3, W3] PPL: Red-Green on Three Telegram Surfaces"
date: 2026-05-06
description: "Three feature MRs landed under paired red/green commits this week: configurable Telegram suggestion rules with validation tests, a DB-backed template editor with regression coverage, and the interactive callback button groundwork with persisted state and snooze handling."
tags: ["ppl", "tdd"]
slug: "s3w3-tdd"
toc: true
---

## What I Worked On

Three feature MRs this week each came with paired `red(api)` / `green(api)` commits visible in the pre-squash history. MR !248 (configurable suggestion rules) added the validation contract before the implementation. MR !253 (Telegram template editor with runtime fallback) added regression coverage across four behavior dimensions. MR !255 (interactive callback button groundwork) shipped six green commits on a state-machine surface where the test contracts had to be named first because the callback flow has too many edge cases to chase later.

## MR !248: Validation Contract Before Code

The `suggest_*` functions used to live in code as hardcoded Indonesian strings. SIRA-298 moves them into `app_settings` as a JSON rules map so admins can tune them without a deploy. The risky part of this kind of change is the schema, not the code: a malformed JSON rule shouldn't crash the daily digest or block reminder sends.

The MR description records the discipline:

```
red(api):   cover configurable suggestion rules                  63df2d9a
green(api): add configurable suggestion rules
red(api):   test suggestion rules validation in settings service 2fa07e9a
green(api): validate suggestion rules on save and wire into notification service
fix(api):   filter empty suggestion rule values
```

Two red-green pairs covering two distinct contracts: the loader behavior with safe-fallback (does the runtime survive a malformed rule?) and the save-time validation (does the API reject unknown keys with HTTP 400?). The first red I wrote (`63df2d9a`) was a single test asserting that `load_suggestion_rules(db)` returns the default rule set when the DB has no row, AND that it logs but does not raise when the row contains malformed JSON. That second clause was the design decision I had to commit to before writing the loader — runtime liveness over correctness for a periodic job that runs at 8am.

Test counts at merge: **117 backend tests passing** in the affected modules, **38 frontend tests passing** for the new settings editor. None of those tests existed before the red commits.

## MR !253: Regression Coverage Across Four Dimensions

MR !253 added DB-backed Telegram template storage with CRUD endpoints, runtime rendering, and fallback behavior. The MR description explicitly calls out the four test dimensions added:

> add backend and web regression coverage for **template validation, preview behavior, runtime fallback, and settings flows**

Each of those four is a different failure mode:

- **Template validation**: malformed Markdown V2 → reject at save time, not at send time
- **Preview behavior**: editor preview matches the actual Telegram render (escape rules, button placement)
- **Runtime fallback**: when the DB has no template for an event, fall back to the hardcoded default in code, never crash
- **Settings flows**: load, edit, save, reset, full round-trip in the editor UI

Writing tests for "what happens when the DB row is missing" forced me to commit to a contract: `render_template(event, context, db)` returns the default-rendered string when no row exists, not None and not raise. That decision lived in the test before any production code did.

## MR !255: State Machine With Six Green Commits

The Telegram interactive callback feature (SIRA-300) is the most state-heavy thing I've shipped on this project. When a Telegram alert message has buttons and a user clicks "Snooze 1h" or "Mark Reviewed", the bot's webhook receives a callback, the system has to look up the original notification, apply the action, edit the message footer to reflect the new state, and ensure duplicate sends are suppressed while snoozed.

Six green commits on the feature branch:

```
57539aff green(api): persist telegram interactive notification state
ba43f97e green(api): add telegram callback and message edit helpers
616f1779 green(api): add telegram callback button and footer helpers
5a1e4e2d green(api): add telegram callback webhook flow
ee9c4aef green(api): persist telegram state and honor snoozes
7bab4eee green(api): apply telegram actions and wire high-risk alerts
```

Each one followed a red commit defining the contract for that layer:
- The state table schema (what columns we need, especially the snooze snapshot for footer reconstruction)
- The callback service signature (input: telegram update, output: action result + reply text)
- The button + footer helpers (separate from the message body so footer edits don't have to re-render the whole message)
- The webhook router (dedupe via update_id, RBAC check on user, idempotent action application)
- The duplicate-send suppression while snoozed
- The high-risk wiring in `notify_high_risk_flagged(...)`

If I had written this implementation-first, I'm fairly sure I'd have produced a single 800-line file mixing webhook parsing, state mutation, and template rendering. The red commits forced the layer separation because each test wanted to mock a different concern.

## Stabilizing Flaky Property Tests Along the Way

The MR !255 description has a small but telling note:

> stabilize flaky payment property tests uncovered by repo pre-push so the branch can pass hooks reliably

The pre-push hook from MR !223 (S3W2) ran the test suite. While developing !255 on a worktree, the pre-push surfaced two property tests in the payment service that occasionally failed when Hypothesis generated edge-case inputs. Stabilizing those is a TDD-adjacent activity: the tests are revealing real edge cases, not flakes. I tightened the assertions so they survive Hypothesis's input space exploration without false positives. That's the kind of regression discipline you don't get from coverage-only thinking; you only see it when something actively probes the space.

## What I Learned

Three patterns reinforced this week:

**Validation contracts are best authored as failing tests.** The "reject unknown keys with HTTP 400" rule for !248 is one line in the spec but ten lines of test (positive case, four negative cases, the boundary cases like empty string vs `null`). Writing it as a test makes the spec executable.

**State-machine features need test-first or they grow accidental complexity.** !255 has six green commits because the red commits forced six separate concerns. A single 800-line PR would have shipped with three or four hidden coupling points.

**Pre-push test running surfaces real fragility, not just regressions.** The Hypothesis flake on payment property tests was a real edge case. Catching it pre-push and tightening the test is exactly what the hook is for.

## Evidence

- [MR !248 SIRA-298 configurable Telegram suggestion rules](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/248)
- [MR !253 SIRA-304 Telegram template editor + runtime fallback](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/253)
- [MR !255 SIRA-300 Telegram interactive button groundwork](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/255)
- Pre-squash red/green commits: `63df2d9a` red / green for suggestion rules; `2fa07e9a` red / green for validation; six green commits on !255 (`57539aff`, `ba43f97e`, `616f1779`, `5a1e4e2d`, `ee9c4aef`, `7bab4eee`)
- Test counts at merge: !248 → 117 backend + 38 frontend, !253 → regression coverage across 4 dimensions, !255 → expanded `tests/test_telegram_callback_*` suite
