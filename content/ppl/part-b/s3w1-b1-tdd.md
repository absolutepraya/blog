---
title: "[S3, W1] PPL: TDD on Two Surfaces and a Full Feature"
date: 2026-04-22
description: "Red-green-refactor cycles on a Tiptap rich-editor test suite that unblocked SonarQube, plus the full Telegram notification feature developed entirely under paired red/green commits on a dedicated worktree."
tags: ["ppl", "tdd"]
slug: "s3w1-tdd"
toc: true
---

## What I Worked On

Two TDD surfaces this week. The first was a frontend test suite for our Tiptap-based email template editor that needed to unblock a failing SonarQube quality gate. The second was the entire Telegram notification feature, developed on a dedicated worktree with every functional commit preceded by a paired `red(api):` failing-test commit. That second one is where the discipline really showed.

## Loop 1: Rich-Editor Tests Unblock SonarQube (Frontend)

MR !200 introduced a Tiptap-based rich editor for email templates. The initial CI run failed the SonarQube quality gate because new-code coverage was 28.5%, well below the 80% threshold.

I treated this as TDD in reverse: the failing "test" was the SonarQube gate, and I needed to write enough unit tests to make it pass.

**Red phase.** SonarQube reported missing coverage on `rich-editor.tsx`, `variable-menu.tsx`, and `variable-node.ts`.

**Green phase.** I added `apps/web/tests/components/rich-editor/rich-editor.test.tsx` with assertions that exercise the full component surface:

```tsx
it('renders the formatting toolbar', () => {
  render(<RichEditor value="" onChange={() => {}} variables={VARIABLES} />)
  expect(screen.getByTitle(/Bold/)).toBeInTheDocument()
  expect(screen.getByTitle(/Italic/)).toBeInTheDocument()
})

it('renders initial value as chip markup', () => {
  const { container } = render(
    <RichEditor value="<p>Hi {{ client_name }}</p>" onChange={() => {}} variables={VARIABLES} />
  )
  const chip = container.querySelector('[data-variable="client_name"]')
  expect(chip).not.toBeNull()
})
```

I added tests for link insertion, toolbar command invocation, and the `aria-pressed` accessibility attribute. Web tests went from 703 to 719 passed, and SonarQube new-code coverage jumped to 97.7%.

The lesson here was about test target selection. A React component that wraps a complex third-party editor (Tiptap) is tempting to test by reaching into Tiptap's internal `editor.getJSON()` shape. Doing that couples your tests to a library version. I tested the component's contract instead: what the user sees (toolbar buttons, chip markup, link state) and what the component emits (HTML strings via `onChange`). Those assertions survive Tiptap upgrades.

## Loop 2: The Telegram Feature, Built Entirely Red/Green

The Telegram notification feature is being built on a dedicated Superset worktree (`abhip/telegram` branch). I committed to a strict naming convention: every implementation commit is preceded by a `red(api):` commit that adds failing tests, and the implementation commit itself is named `green(api):`. The git log on the worktree reads like a TDD textbook:

```
green(api,web): add Telegram connection test and chat ID setup        7c60d86f
red(api):      add failing tests for Telegram connection test         b47c3c6e
green(api):    add daily AR digest Celery task                        61b13bc8
red(api):      add failing tests for daily AR digest                  085b1d90
green(api):    add deep-link inline keyboard buttons                  ed3bb0a1
red(api):      update Telegram template tests for tuple return        85df5640
green(api):    add tenacity retry logic to TelegramService            3cafb268
red(api):      add tenacity retry tests for TelegramService           df7d1fdf
green(api):    add Telegram notification dispatcher with toggle       2ac28520
red(api):      add failing tests for Telegram notification dispatcher 37c19055
green(api):    add Telegram message templates with Markdown V2        3b2d4cdb
red(api):      add failing tests for Telegram message templates       298c1f06
green(api):    extend TelegramService with parse_mode and reply_markup 1aa87190
red(api):      add failing tests for parse_mode and reply_markup       326a6eab
```

Six full red-green pairs in a row. Each pair represents a discrete capability shipped under TDD discipline.

The discipline is not just for show. The Telegram dispatcher (`telegram_notification_service.py`) has 552 lines of tests because each notification path (overdue detected, payment recorded, reminder sent, high-risk flagged) has explicit positive cases, toggle-disabled cases, and error cases. Most of those test cases were impossible to think of without the red-first discipline forcing me to write the contract before the implementation.

A concrete example is the toggle check. The first red commit (`37c19055`) included this failing test:

```python
async def test_dispatcher_skips_when_toggle_disabled(monkeypatch) -> None:
    db = _fake_db_with_toggle("notify_payment_recorded", enabled=False)
    service = TelegramNotificationService(db)
    sent = await service.notify_payment_recorded(invoice, payment)
    assert sent is False
    # And critically: the underlying TelegramService send was NOT called
    assert send_message_mock.call_count == 0
```

Writing that test first made me realize the dispatcher needed to short-circuit *before* constructing the message, not after, because constructing the message touches client lookups that can themselves fail. The red phase exposed this design constraint in 30 seconds; if I had written the implementation first, I would probably have discovered it through a flaky integration test much later.

## What I Learned

TDD is more disruptive on greenfield code than on patching existing code. The Telegram feature was greenfield (no prior implementation to lean on), and writing the tests first repeatedly forced me to make design decisions earlier than I wanted to. That is the point. Every red commit is a moment where the contract is named explicitly before any code locks it in. By the time the MR opens, the design has been argued with the test suite a dozen times and the surviving shape is much more deliberate.

On the frontend, TDD was less natural because the boundary is messier. A React component has DOM, side effects, and library state. The trick was testing the component's externally observable contract (chip markup via `[data-variable]` selectors, toolbar via accessible roles) rather than its internal Tiptap state. Same TDD spirit, different surface.

## Evidence

- [MR !200 - Tiptap WYSIWYG editor with slash-command variables](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200)
- Telegram worktree: `abhip/telegram` branch (14+ red/green paired commits, listed above)
- Commit `2f3ab4e1` — test(web): cover rich-editor package + unblock SonarQube gate
- Source: `apps/api/tests/test_telegram_notification_service.py` (552 lines)
- Source: `apps/api/tests/test_daily_digest.py` (268 lines)
- Source: `apps/web/tests/components/rich-editor/rich-editor.test.tsx`
