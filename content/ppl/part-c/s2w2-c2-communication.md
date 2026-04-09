---
title: "PPL: Communication and Knowledge Sharing [Sprint 2, Week 2]"
date: 2026-04-09
description: "Three in-depth MR reviews with 44 total review points catching critical bugs (broken SQL joins, auth bypasses), plus merge coordination for 13 teammate MRs."
tags: ["ppl", "communication", "code-review", "knowledge-sharing", "teamwork"]
slug: s2w2-communication
toc: true
---

## Overview

Sprint 2 Week 2 (April 3 to 9) communication work centered on three substantial code reviews posted as GitLab discussion threads, merge coordination for 13+ teammate MRs, and Linear ticket management. The reviews caught several critical bugs that would have reached production, including a broken SQL join and an auth bypass.

---

## 1. Threaded MR Reviews with Severity Grading

Three MRs were reviewed this week, all following the same structured approach: positive callouts first, then issues grouped by severity (P0 blockers through P3 nitpicks), with code fix suggestions for every issue.

| MR | Author | Feature | Issues | P0 | P1 | P2/P3 |
|----|--------|---------|--------|----|----|-------|
| !155 | hl | CSV Import Modal | 14 | 3 | 2 | 9 |
| !128 | hl | Settings Page Management | 12 | 2 | 3 | 7 |
| !166 | qenthm | Risk Scoring Engine | 18 | 2 | 6 | 10 |
| **Total** | | | **44** | **7** | **11** | **26** |

---

### MR !155: CSV Import Modal (hl)

The CSV import wizard allows bulk-importing clients, invoices, and payments. The implementation was well-structured with a multi-step UI, progress indication, and server-side validation. Three P0 issues were caught:

**P0: Raw `fetch()` bypassing the auth client.** The upload request used the browser's native `fetch()` instead of the project's auth-aware API client. This means no `Authorization` header is sent, so the API rejects every request with 401. The feature would have appeared to work locally but failed for every user in production.

**P0: FileReader errors silently ignored.** The `reader.onerror` callback was empty. A corrupted file would cause `reader.result` to be null, which gets passed to the CSV parser and throws an uncaught exception with no user feedback.

**P0: CSV parse errors uncaught.** The papaparse call had no error callback. Malformed rows (wrong delimiter, unbalanced quotes) would silently produce undefined data that passed validation.

Each issue included a code snippet showing the fix, making it easy for the developer to understand exactly what to change.

---

### MR !128: Settings Page Management (hl)

Full-stack settings management: backend stores key-value pairs, frontend provides a form with validation. Two P0 issues:

**P0: No key whitelist.** The backend accepted any key without validation. A bug or crafted request could inject unknown keys (`{"admin_override": true}`) into the settings table, silently persisting garbage data. The fix requires a `frozenset` of allowed keys with validation before upsert.

**P0: Missing frontend error state.** The settings form called the API mutation but had no `onError` handler. A failed save showed no feedback. The form appeared to submit successfully while nothing changed on the server.

---

### MR !166: Risk Scoring Engine (qenthm)

The risk scoring engine assigns LOW/MEDIUM/HIGH risk to clients using a Strategy Pattern. Strong architecture overall, but a critical data correctness bug:

**P0: Broken cross-table join.** The payment history query fetched ALL payments across ALL clients, then filtered in Python. For a system with 10,000 payments across 500 clients, this loads the entire payments table into memory. Worse, if the `invoices` join returned null for any payment, the Python filter would throw a `TypeError`, crashing the entire scoring run.

The fix filters at the PostgREST query level using `!inner` join syntax:

```python
# Before (broken): loads all payments, filters in Python
result = db.table("payments").select("*, invoices(client_id)").execute()
payments = [p for p in result.data if p["invoices"]["client_id"] == client_id]

# After (correct): filters at the query level
result = (
    db.table("payments")
    .select("*, invoices!inner(client_id)")
    .eq("invoices.client_id", client_id)
    .execute()
)
```

This review prevented a production bug that would have made risk scoring produce completely wrong results for every client.

**P1: CLAUDE.md architecture violation.** The service called Supabase directly instead of going through the `db/queries/` layer, violating the project's architectural pattern.

---

## 2. Merge Coordination (13+ Teammate MRs)

As maintainer, I merged 13+ MRs from teammates during April 7-8. This required more than clicking the merge button: ensuring pipelines passed, resolving merge conflicts, and coordinating merge order when MRs had dependencies.

| MR | Author | Feature |
|----|--------|---------|
| !172 | teammate | Sidebar/favicon improvement |
| !155 | hl | CSV import modal |
| !173 | teammate | Dashboard analytics redesign |
| !170 | teammate | Translate UI strings to Indonesian |
| !128 | hl | Settings page management |
| !166 | qenthm | Risk scoring engine |
| !176 | teammate | Localize settings page |
| !175 | teammate | Fix duplicate toast on logout |
| !143 | teammate | Communication history logging |
| !136 | teammate | Risk scoring schema migration |
| !178 | teammate | Daily risk scoring Celery beat task |
| !179 | teammate | RiskScoreBadge component |
| !135 | teammate | Client CSV export |

The risk scoring stack required careful ordering: schema migration (!136) had to merge before the scoring engine (!166), which had to merge before the Celery beat task (!178) and the frontend badge (!179).

---

## 3. Linear Ticket Management

Maintained the sprint board throughout the week: moving tickets to "In Progress" and "Done" as work progressed, linking MRs to Linear tickets via branch names, and ensuring subtask completion tracked accurately against sprint goals.

---

## Evidence

- MR !155 review — [SIRA-147](https://linear.app/ppl-sira/issue/SIRA-147): CSV import modal (14 review points)
- MR !128 review — [SIRA-179](https://linear.app/ppl-sira/issue/SIRA-179) [SIRA-180](https://linear.app/ppl-sira/issue/SIRA-180): settings page (12 review points)
- MR !166 review — [SIRA-218](https://linear.app/ppl-sira/issue/SIRA-218): risk scoring engine (18 review points)
- MRs merged as maintainer: !172, !155, !173, !170, !128, !166, !176, !175, !143, !136, !178, !179, !135
