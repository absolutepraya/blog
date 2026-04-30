---
title: "[S2, W1] PPL: Ticket Quality as Code Review"
date: 2026-03-23
description: "Auditing 150+ Linear tickets for contradictions, stale references, and missing descriptions, plus SonarQube quality gate enforcement as automated code review."
tags: ["ppl", "code-review", "quality-gate", "sonarqube", "linear"]
slug: s2w1-code-review
toc: true
---

## What I Worked On

This week's review work had two dimensions: reviewing the **ticket board** for sync issues (a form of "code review" for project management), and letting **SonarQube quality gates** act as automated code review for the monitoring MR.

## Ticket Board Audit

After creating 64 new tickets, I audited all 150+ active tickets (Backlog, Todo, In Progress, In Review) for contradictions and stale data. This is essentially code review applied to project planning.

### Issues Found and Fixed

**Outdated channel reference (SIRA-135)**: The Celery task instrumentation ticket mentioned tracking `send_reminder` for `EMAIL/WHATSAPP/SMS`. We'd decided on EMAIL + TELEGRAM. Updated the description to prevent a dev from implementing the wrong channels.

**Empty parent PBIs (SIRA-2, SIRA-3)**: PBI 9 (Automated Reminders) and PBI 8 (Audit Log) had no descriptions despite having subtasks. A dev picking up these tickets would have no context. Added full descriptions with flow diagrams, acceptance criteria, and cross-PBI blocking relations.

**Scope overlap (PBI 13 vs PBI 22)**: The CSV Export feature (PBI 13) and Bulk Actions "Export Selected" (PBI 22) overlapped. Added clarifying notes to both: PBI 13 is the full filter modal export, PBI 22 is quick export of checkbox-selected rows only.

**Stale Sprint 1 ticket (SIRA-72)**: A Sprint 1 requirement tracker was still "In Progress" after Sprint 1 ended. Moved to Sprint 2.

## SonarQube as Automated Code Review

When I pushed the monitoring MR (!106), SonarQube flagged a quality gate failure: rule `python:S1192` ("Define a constant instead of duplicating this literal 4 times") on `dashboard_service.py`.

The `"db.query"` string appeared 4 times across 4 `sentry_sdk.start_span()` calls. The fix was a one-line constant extraction:

```python
_SPAN_DB_QUERY = "db.query"

# Before: op="db.query" repeated 4 times
# After: op=_SPAN_DB_QUERY everywhere
```

This is exactly what automated review is for: catching mechanical issues (string duplication) that humans skip during manual review but accumulate into maintenance burden.

## Result

- 6 ticket updates fixing contradictions and gaps
- SonarQube S1192 violation fixed, quality gate passing
- All 150+ tickets verified for cycle assignment, blocking relations, and description completeness
- MR !106 merged after addressing the quality gate feedback

The ticket audit prevented at least 2 potential dev confusion points (wrong channels, overlapping export scope) that would have surfaced as wasted work later.

## Evidence

- [MR !106 - includes SonarQube S1192 fix](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/106)
- [Linear SIRA-135](https://linear.app/ppl-sira/issue/SIRA-135) (channel reference fix)
- [Linear SIRA-2](https://linear.app/ppl-sira/issue/SIRA-2) (PBI 9 description added)
- [Linear SIRA-3](https://linear.app/ppl-sira/issue/SIRA-3) (PBI 8 description added)
