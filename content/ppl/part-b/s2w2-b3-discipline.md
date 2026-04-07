---
title: "PPL: Development Discipline [Sprint 2, Week 2]"
date: 2026-03-30
description: "19 MRs merged in one week across CI/CD, features, and infra — documenting the breadth of work and commit quality discipline in Sprint 2 Week 2."
tags: ["ppl", "discipline", "git-flow"]
slug: s2w2-discipline
toc: true
---

## What I Worked On

This was the most productive week of the project so far. 19 merge requests were opened and merged across five work streams: a major CI/CD overhaul, three new application features, web/UX improvements, email integration, and infrastructure fixes for dev workspaces.

---

## CI/CD Sprint — 8 MRs in the Pipeline

Most of the week's focus was a series of CI improvements aimed at making quality feedback automatic and visible on every MR.

| MR | Scope | Summary |
|----|-------|---------|
| !125 | CI | Pipeline status granularity: warnings vs. failures (`exit 77` for yellow) |
| !126 | CI | Per-job test result comments posted automatically on every MR |
| !129 | CI | BDD report extraction: Gherkin feature files shown in MR comment |
| !131 | CI | SIRA Bot handles all CI comment posting (replaces personal token) |
| !132 | CI | SonarQube quality gate result posted directly to MR |
| !138 | CI | Schema-test job runs against real staging Supabase instance |
| !140 | CI | Gherkin feature file content embedded in BDD report comment |
| !141 | CI | Fix: always fetch SonarQube quality gate; fix schema-test hang |

Each of these was a standalone, mergeable MR with a descriptive commit message. For example:

```
feat(ci): post test result comments on MR for each CI job
feat(ci): BDD report extraction and MR comment
feat(ci): add SonarQube quality gate report to MR comments
fix(ci): always fetch sonar quality gate + fix schema-test hang
```

The naming convention (`feat`, `fix`, `chore` with scope) was maintained consistently across all 8.

---

## Application Features and Bug Fixes — 8 MRs

Alongside CI work, four new features and several fixes landed:

| MR | Ticket | Summary |
|----|--------|---------|
| !108 | SIRA-160 | Email integration and templates (Resend) |
| !120 | SIRA-214 | Multi-device session management |
| !118 | SIRA-125 | Cancel invoice for UNPAID and OVERDUE invoices |
| !104 | SIRA-215 | Block inactive accounts from authenticating |
| !112 | SIRA-131 | Audit and complete toast notifications for all CRUD actions |
| !100 | SIRA-145 | Fix payment page UI (invoice number display, filtering) |
| !102 | SIRA-99 | Remove duplicate error toast on staff delete |
| !111 | — | Enhance email template editor with toolbar and line numbers |

Each MR followed the full process: branch from main, commits with descriptive messages, merge request with pipeline passing, squash merge to main with the ticket code in the MR title.

---

## Infrastructure Fixes — 3 MRs

| MR | Summary |
|----|---------|
| !116 | Per-workspace isolated Redis/Supabase/Celery for Superset workspaces |
| !119 | Docker Compose grouping and workspace naming for Superset |
| !110 | Fix CodeMirror editor not showing template content on load |

These were smaller but meaningful: !116 and !119 fixed a dev environment problem where multiple workspaces were sharing infrastructure, causing interference during parallel development.

---

## Commit Quality

All commits followed the conventional commit format throughout the week. The CI series commits in particular had scope-tagged messages that made the intent unambiguous:

```
feat(ci): use SIRA Bot for all CI comments
feat(ci): use staging Supabase for schema-test
fix(ci): always fetch sonar quality gate + fix schema-test hang
feat: multi-device session management
fix(api,web): block inactive accounts from authenticating
```

No vague messages like "fix stuff" or "update". Each commit either maps to a SIRA ticket or describes the specific CI/infra change.

---

## Results

| Category | MR Count |
|----------|----------|
| CI/CD pipeline improvements | 8 |
| Application features and fixes | 8 |
| Infrastructure/dev environment | 3 |
| **Total** | **19** |

---

## Evidence

- MR !125, !126, !129, !131, !132, !138, !140, !141 — CI pipeline series
- MR !108 — [SIRA-160](https://linear.app/ppl-sira/issue/SIRA-160) email integration
- MR !120 — [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214) session management
- MR !118 — [SIRA-125](https://linear.app/ppl-sira/issue/SIRA-125) cancel invoice
- MR !104 — [SIRA-215](https://linear.app/ppl-sira/issue/SIRA-215) block inactive accounts
- MR !116, !119 — Superset workspace infra fixes
