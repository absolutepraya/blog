---
title: "[S4, W1] PPL: Built the Team's Discord MR Pipeline and the Doc That Replaces Code Spelunking"
date: 2026-05-13
description: "Replaced the team's plain-text CI-pipeline Discord notifications with rich per-MR cards that ping the author by Discord handle, include an AI summary, and edit in place across state transitions. Plus a 134-line RBAC role matrix doc that turns 'can AR_STAFF do X' from a 10-minute grep into a 10-second lookup."
tags: ["ppl", "communication"]
slug: "s4w1-communication"
toc: true
---

## What I Did This Week for the Team

Three communication-improving artifacts this week, all of them in service of "make the team work with less friction":

1. **The mr-bot service** that replaced the legacy CI-pipeline-status Discord card with a per-MR card.
2. **The RBAC role matrix doc** that turns "what can AR_STAFF do" into a one-page lookup.
3. **A diagnostic review comment** on a teammate's broken CI that unblocked them with a one-command fix.

Each is in some sense communication infrastructure: tooling, docs, or words that make the team coordinate better.

## The mr-bot Card vs the Old Pipeline-Status Card

Before MR !275, every push to a branch triggered a Discord card from a script (`scripts/sirabot/discord-pipeline.sh`, 234 lines, now deleted). The card showed pipeline status: green/yellow/red, a few stats, a link. It was useful but it had three structural problems:

1. **Wrong granularity.** The card was per-pipeline, not per-MR. Multiple pipelines per MR (push, force-push, retry) meant multiple cards. The team's Discord channel filled up.
2. **No context about the MR itself.** The card showed "pipeline #X passed" but not what the MR was about. A reviewer would have to click through to GitLab to find out.
3. **No transitions.** The card was static. When the MR merged, the green card stayed; the team had no signal that the MR was now merged unless they scrolled GitLab.

The mr-bot fixes all three:

- **Per-MR, not per-pipeline.** One card per MR. The card is edited in place as the MR transitions (OPENED → DRAFTED → MERGED → CLOSED), so reviewers see state changes without new noise.
- **MR title + Gemini-generated summary + author handle + branch arrow + Linear ticket link.** Everything a reviewer needs to decide whether to open the MR is on the card.
- **State transitions edit the card.** The color changes (green opened, gray drafted, blue merged, red closed), the footer updates with the merger's handle, the title gets a "merged" prefix. The team can scroll back through Discord and see the project's MR history in one channel.

The architectural details are in the b1 (TDD) and b2 (programming) blogs. The communication impact is that the team's Discord now serves as a low-friction MR notification surface, the kind of thing other teams use Slack apps to get.

![Three live mr-bot cards in the team's #glab-mr-notif Discord channel: MR !302 (Qen, activity_log hooks), MR !285 (froklax, Supabase query limit), MR !268 (Sira-318 duplicate cache fix). Each card shows the MR title as a colored bar (green for opened, blue for merged), a Gemini-generated summary, author handle, source branch with an arrow to main, and the Linear ticket reference](/images/ppl/s4w1-c2-mr-bot-live.png)

The screenshot above shows three real cards posted by the bot on the team's `#glab-mr-notif` channel: an in-progress MR by Qen (activity_log hooks), a recently merged MR by Bertrand (Supabase query limit raise), and Fadhli's duplicate-cache fix. Each card is one MR; the bot edits the same card across state transitions instead of posting new ones. The Gemini-generated summary is the body text under each title; the author, branch, and Linear ticket are pinned to the right.

And I told the team about the change directly. May 12 05:10 in `#codebase-update`:

> ges <#1501267039409406043> mute aja, gua dah bikin biar dia bakal ngetag orang yg bersangkutan di discord pas buka MR
>
> sama ada llm summary nya gua pake gemini gratisan, shud be enough

Two sentences. Tells the team to mute the old noisy channel, explains the new card pings the relevant person, mentions the AI summary uses free-tier Gemini so cost isn't an issue. That's the communication wrapping the technical change: the bot is more useful if the team knows what it does and what to mute.

## Proactive Security Announcement

The same morning the TanStack supply-chain attack hit Snyk (b6 covers the technical response), I posted to `#dev` at 05:19:

> punya kita ga ke pin, masih pake `^...`
>
> lemme handle
>
> jadi best practice nya sekarang tuh karena banyak supply chain attack, itu harus pin version packages, semuanya
>
> jangan pake `^`, or `latest`, or `>=`, or whatever

The information was a policy statement: this is what we do now, this is why. Bertrand's reaction was a question about webhook alert mechanism (unrelated thread, but useful adjacent discussion); Qen's was "untung bukan kita yang kena." Both reactions are signs the message landed; the team understood the new policy and processed the risk.

Then the MR followed within the hour. The pattern: communicate the policy first, then ship the code that implements it. Future incidents get the same cadence.

## The RBAC Role Matrix Doc

When SIRA-364 expanded AR_STAFF's capabilities, the question "what can AR_STAFF do now" became a real coordination problem. The team needed to know:

- Which buttons should be enabled in the AR_STAFF dashboard
- Which UI flows should show "request approval" vs proceed directly
- Which routes the backend allows for AR_STAFF tokens
- Which capabilities are forever-admin-only vs gated by approval

Before this MR, answering any of these required grepping for `require_admin` across the backend, cross-referencing with the frontend role gates, and reasoning about which gate applied to which workflow. That's a 10-minute task per question, and the answer is fragile (anyone who changes a gate and forgets to update the doc invalidates it).

MR !300 shipped `docs/rbac-role-matrix.md`, 134 lines, broken into capability tables by domain (Invoices, Clients, Payments, Reminders, Settings). A sample row:

```markdown
| Edit `amount` or `due_date` (PARTIAL) | ❌ | ✅ | 🔐 `edit_invoice_financial` |
| Hardened in SIRA-364. PARTIAL means at least one payment recorded.
| Mutating financial fields needs approval. |
```

Three buckets per row:

- **🆓 Free**: role acts directly, no approval needed.
- **🔐 Approval-required**: staff submits a permission request, admin reviews and approves. (Implemented by SIRA-207 permission request system; live when SIRA-207 ships.)
- **🛡️ Admin-only-forever**: admin acts directly. Never delegated.

The doc is in git, gets reviewed when capabilities change (the same MR that changes a gate has to update the row), and is the canonical reference for cross-team conversations.

The communication impact is asymmetric: the doc takes a few hours to write and a few minutes per update. The savings compound across every "what can AR_STAFF do" question for the rest of the project. After SIRA-364, two teammates asked questions that I could answer with "row 5 in `docs/rbac-role-matrix.md`" instead of a code dive.

## Diagnostic Review on !268: Communication Through Code Review

The b4 blog covers this in detail; the communication angle is worth restating here. When Fadhli's CI was failing for reasons unrelated to his code (the supabase CLI version drift bug), the easy review comment is "your CI is red, please fix." That comment doesn't help him; he can already see the red. The useful comment is:

- What's actually broken (supabase CLI resolving `latest` differently between jobs)
- Why it's not his fault (the drift was introduced upstream)
- What the fix is (commit `a4f0c61e` on main)
- What he should do (rebase + push, CI will pass)

That's communication in the literal sense: bringing what I know to a person who needs it. Reviews are a communication surface, not just a defect-finding surface.

## Minor Communication Wins: AGENTS.md Refresh

Direct commit `5a2bd625` (on main) refreshed `AGENTS.md` at the project root, in `apps/api/`, and in `apps/web/`. AGENTS.md is the file coding agents (Claude, Codex, Cursor) read when they enter the project; keeping it current means future agent sessions don't waste time re-discovering project conventions.

This is "communication" with a slightly different audience: future-me and other team members' agent sessions. The same principle applies: clear writing now saves clarification later.

## What This Says About Communication

The thread through these four: **the highest-leverage communication is structural, not verbal.** A weekly standup is communication; so is a bot that posts MR cards. A code review thread is communication; so is a doc that answers a question once instead of requiring it to be asked five times.

The mr-bot service is probably the highest-leverage communication artifact I've built this semester, because every MR for the rest of the project will route through it, and every team member will get the benefit. Compounding effect, not a one-shot.

## What I Learned

Two patterns from this week:

**Build the tool, not just write the doc.** The pipeline-status notification was a 234-line script. Replacing it with a real service was more work but it ships richer information and survives state transitions. When a tool can replace a behavior the team would otherwise have to remember to do, build the tool.

**Diagnose, don't just observe.** "Your CI is failing" is what the bot already says. "Your CI is failing because X, the fix is Y, the action is Z" is what a human reviewer can add. The fast bot says the easy part; the human is for the hard part.

## Evidence

- [MR !275 SIRA-354 mr-bot service](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/275): replaces 234-line discord-pipeline.sh with a real FastAPI service
- [MR !300 SIRA-364 RBAC expansion & hardening](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/300): includes `docs/rbac-role-matrix.md` (134 lines)
- [MR !268 review thread](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/268): diagnostic comment on Fadhli's broken CI
- Direct commit `5a2bd625`: `docs: refresh AGENTS.md across root, apps/api, apps/web`
- Source: doc: `docs/rbac-role-matrix.md`
- Source: old script (deleted in !275): `scripts/sirabot/discord-pipeline.sh` (234 lines)
- Source: new service: `services/sira-mr-bot/`
- Team announcements: Discord `#codebase-update` 2026-05-12 05:10 (mr-bot rollout), `#dev` 2026-05-12 05:19-05:20 (Snyk policy statement)
