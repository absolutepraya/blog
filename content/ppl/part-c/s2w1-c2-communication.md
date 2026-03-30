---
title: "PPL: Communication and Knowledge Sharing [Sprint 2, Week 1]"
date: 2026-03-30
description: "Two in-depth threaded MR reviews with severity-graded issues and ready-to-apply code fixes, plus merge coordination and direct code contributions to teammates' branches."
tags: ["ppl", "communication", "code-review", "knowledge-sharing", "teamwork"]
slug: s2w1-communication
toc: true
---

## Overview

Sprint 2 Week 1 (Mar 24 to 30) communication focused on two detailed code reviews posted as GitLab discussion threads, merge coordination for the team, and direct code contributions to address review findings.

---

## 1. Threaded MR Reviews with Severity Grading

This sprint I shifted to posting reviews as **GitLab discussion threads** rather than plain comments. Discussion threads can be individually resolved by the MR owner after addressing each issue, making it clear which feedback has been handled and which is still open.

Each review follows a consistent structure: start with positives (acknowledge good work and specific things done well), then list issues grouped by severity (P0 = blocker, P1 = important, P2 = improvement, P3 = nitpick), with a code snippet showing a suggested fix for every issue. This makes reviews actionable: the developer can understand the priority, see exactly what to change, and resolve each thread independently.

### MR !109: Blue/Green Deployment (16 issues found)

Reviewed dafandikri's blue/green deployment implementation, covering Docker Compose profiles, nginx upstream switching, manual promote/rollback gates, and Sentry release integration.

**Positive callouts:**
- Clean separation between shared infra (no profile) and slot services (profiled)
- Conditional copy for `upstream-active.conf` correctly preserves routing state on redeploy
- Celery Sentry test rewrite using `importlib.reload` was a real fix, not cosmetic

**P0 issues (5 blockers):**

1. **Dual Celery Beat during deploy-to-promote window.** Between the deploy job starting the standby slot (including beat) and the manual promote (which stops old beat), two beat schedulers run against the same Redis broker. Every scheduled task gets dispatched twice. Suggested fix: stop standby beat immediately after health check, before the promote step.

2. **Nginx reload failure not checked.** If `nginx -s reload` fails (container down, config syntax error), the script continues to stop old workers and update `.active-slot`. Nginx still routes to old slot but old workers are stopped: silent outage. Suggested adding `nginx -t` validation before reload.

3. **Destructive ops before post-promote health check.** The promote job stops old workers and updates `.active-slot` before running the health check. If the check fails, old workers are already dead and state is corrupted. Suggested reordering: switch nginx, health check, only then stop old workers.

4. **`.active-slot` content never validated.** If it contains garbage or whitespace, the script silently defaults, potentially deploying over the live slot. Suggested explicit validation with `tr -d '[:space:]'` and value check.

5. **`docker inspect` failure produces empty IP.** Health check then loops for 2 minutes with no useful feedback. Suggested immediate validation after inspect.

**P1 issues (4):** Rollback doesn't health-check old containers, rollback only checks API not web, worker stop failures silently swallowed, web frontend never health-checked.

**P2 issues (3):** No locking between concurrent deploy/promote/rollback, `down` vs `stop` loses logs, GlitchTip release curl lacks `-f` flag.

**P3 issues (4):** Comment accuracy, "auto-rollback" vs "abort deploy" naming, `.env.example` comment mismatch, stale docstring.

All 16 issues included code snippets showing the suggested fix. The MR owner addressed every P0 and P1 before merge. Several of these fixes (dual beat prevention, health-check-before-destructive-ops, deploy locking) were implemented in the follow-up MR !117 that automated the promote step.

{{< figure src="/images/ppl/part-c/mr-109-review-thread.png" alt="MR !109 review thread" caption="Threaded review on MR !109: severity-graded issues (P0 through P3) with code snippet fixes for each." >}}

- [MR !109 review thread](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/109)

### MR !118: Cancel Invoice (8 issues found)

Reviewed froklax's cancel invoice feature (SIRA-125), covering backend service/router/query layers, frontend confirmation dialog, and TanStack Query cache invalidation.

**Positive callouts:**
- TDD discipline visible in commit history (red/green/refactor pattern)
- Confirmation dialog tested for both accept and reject paths
- TanStack Query cache invalidation correctly invalidates both invoices and dashboard queries

**P0 issues (3 blockers):**

1. **CANCELED invoices can still be edited via PUT.** The `update` method only blocks PAID, so a direct API call can modify a canceled invoice's amount and due date. Frontend hides the button, but that's not sufficient:
```python
if current.get("status") in ("PAID", "CANCELED"):
    raise PermissionError(f"{current.get('status')} invoice cannot be edited")
```

2. **Payments can be recorded against CANCELED invoices.** Same gap in `PaymentService.create()`. Only PAID is blocked, not CANCELED.

3. **CANCELED added via union type hack.** `| 'CANCELED'` instead of adding to `INVOICE_STATUSES` array breaks the single source of truth and forces `as unknown as InvoiceStatus` casts in tests.

**P1 issues (3):** `list_invoices` status filter doesn't include CANCELED (returns 422), Send Email button visible on canceled invoices, missing test coverage for new guards.

**P3 issues (2):** Redundant error message wording, no test for Cancel button disabled state during pending mutation.

- [MR !118 review thread](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/118)

---

## 2. Merge Coordination

Managed the merge flow for the team this week. Key MRs merged and coordinated:

| MR | Author | Topic |
|----|--------|-------|
| [!109](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/109) | dafandikri | Blue/green deployment (after review fixes) |
| [!117](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/117) | dafandikri | Automated deploy promote pipeline |
| [!118](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/118) | froklax | Cancel invoice (after review fixes) |
| [!104](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/104) | froklax | Block inactive account auth |
| [!102](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/102) | froklax | Remove duplicate error toast |
| [!100](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/100) | dafandikri | Payment page UI polish |

---

## 3. Direct Code Contributions to Review Findings

Beyond posting review comments, I contributed code directly when the fix was complex enough that describing it in text would be less clear than showing it.

### MR !118: Cancel Invoice Review Fixes

After posting the review, froklax addressed the issues. I then pushed additional commits for defensive checks, index optimization for the new `user_sessions` table, and error logging improvements that were easier to demonstrate in code than describe in a comment.

- Commit `4e600c0`: address MR review feedback with defensive checks, index optimization, error logging

### MR !104: Block Inactive Account Auth

Reviewed and merged the feature that blocks inactive (deactivated) accounts from authenticating. The implementation correctly checks `is_active` status at the auth dependency level, preventing any API access for deactivated users.

### Review Impact

The reviews this week focused on **deployment safety** and **API consistency**, two areas where surface-level code review wouldn't catch the issues. The blue/green deployment review in particular required understanding the full lifecycle of a deploy (start standby → health check → switch traffic → stop old), and identifying the windows where concurrent state could corrupt the system. These aren't "code style" issues; they're operational safety issues that only show up in production.

---

## 4. Linear Ticket Management

Continued managing the Linear board this sprint:
- Created and groomed tickets for Sprint 2 features (SIRA-210, SIRA-211, SIRA-214, SIRA-215, SIRA-226)
- Updated ticket statuses as MRs moved through review and merge
- Linked MRs to tickets via the automated Linear notifier CI job

---

## Evidence

### MR Reviews (as discussion threads)
- [MR !109 review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/109): 16 issues on blue/green deployment
- [MR !118 review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/118): 8 issues on cancel invoice

### MRs Merged as Maintainer
- [!100](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/100), [!102](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/102), [!104](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/104), [!109](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/109), [!117](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/117), [!118](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/118)

### Linear Tickets
- [SIRA-210](https://linear.app/ppl-sira/issue/SIRA-210), [SIRA-211](https://linear.app/ppl-sira/issue/SIRA-211), [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214), [SIRA-215](https://linear.app/ppl-sira/issue/SIRA-215), [SIRA-226](https://linear.app/ppl-sira/issue/SIRA-226)
