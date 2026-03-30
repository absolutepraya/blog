---
title: "PPL: Work Ethic and Commitment [Sprint 2, Week 1]"
date: 2026-03-30
description: "Quantitative and qualitative breakdown of Sprint 2 Week 1 contributions: 8 MRs authored, 2 MRs reviewed in depth, 70+ commits across 7 domains."
tags: ["ppl", "commitment", "work-ethic", "productivity"]
slug: s2w1-commitment
toc: true
---

## Overview

Sprint 2 Week 1 (Mar 24 to 30) output summary:

| Metric | Count |
|--------|-------|
| MRs authored and merged | 8 |
| MRs reviewed (in-depth, threaded) | 2 |
| MRs merged as maintainer | 6+ (from teammates) |
| Commits (across all branches) | 70+ |
| Domains covered | 7 (CI/CD, infra, backend, frontend, database, DevOps tooling, email) |

---

## Quantitative Output

### MRs Authored and Merged

8 MRs created and merged to `main` this week:

| MR | Type | Description |
|----|------|-------------|
| [!107](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/107) | fix(ci) | Fix schema-test timeout and linear merged crash |
| [!108](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/108) | feat | Email integration and templates (Resend + Jinja2) |
| [!110](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/110) | fix(web) | Fix CodeMirror editor not showing template content |
| [!111](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/111) | feat(web) | Enhance email template editor with toolbar and line numbers |
| [!112](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/112) | feat(web) | Audit and complete toast notifications for all CRUD actions |
| [!116](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/116) | fix | Per-workspace isolated infra for Superset workspaces |
| [!119](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/119) | fix | Docker Compose grouping and workspace naming for Superset |
| [!120](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/120) | feat | Multi-device session management (full-stack, TDD) |

### MRs Reviewed

2 MRs reviewed with detailed threaded discussions (not just approvals):

| MR | Author | Issues Found |
|----|--------|:---:|
| [!109](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/109) | dafandikri | 16 (5 P0, 4 P1, 3 P2, 4 P3) |
| [!118](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/118) | froklax | 8 (3 P0, 3 P1, 2 P3) |

Both reviews posted as GitLab discussion threads with severity grading and code snippet fixes for every issue. Details in the [c2 communication blog]({{< ref "/ppl/part-c/s2w1-c2-communication" >}}).

---

## Cross-Domain Coverage

This week's work spanned seven areas:

### Features (3 MRs)
- **Multi-device session management** ([!120](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/120)): Full-stack feature with TDD, 24 files across API and web. Session tracking, device listing, remote revocation, activity throttling.
- **Email integration** ([!108](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/108)): Resend API, Jinja2 templates, settings page with template CRUD, manual email sending endpoint.
- **Toast notification audit** ([!112](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/112)): Standardized error extraction and toast feedback across all CRUD mutations in the app.

### Frontend (2 MRs)
- CodeMirror editor integration with React lifecycle fix ([!110](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/110))
- Formatting toolbar, line numbers, active line highlight ([!111](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/111))

### CI/CD (1 MR + many commits)
- Schema-test timeout fix and linear notifier crash fix ([!107](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/107))
- 7 iterations of schema-test hardening (auth, UUID validation, rate limiting bypass, blocking enforcement)
- SonarQube quality gate fixes (email template coverage, Bandit false positives)

### DevOps Tooling (2 MRs)
- Per-workspace isolated infra for Superset: separate Redis, Supabase, Celery per workspace ([!116](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/116))
- Docker Compose profile grouping and auto-detect workspace containers in db commands ([!119](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/119))

---

## Quality Indicators

### TDD Discipline

The multi-device session management feature (!120) was built with strict red-green-refactor:
1. `red(api): add tests for user_sessions DB queries`
2. `green(api): implement user_sessions DB queries`
3. `red(api): add tests for session service`
4. `green(api): implement session service`
5. `red(api): add tests for session-aware get_current_user`
6. `green(api): add session validation and activity tracking`
7. `red(api): add tests for session router`
8. `green(api): implement session REST endpoints`

Each layer was tested before implementation. The commit history makes this traceable.

### Iterative Problem-Solving

The schema-test CI job is an example of iterative refinement over brute-force solutions. Rather than disabling the job when it kept failing, each failure was diagnosed and fixed:
- Timeout → explicit process cleanup
- 401s everywhere → JWT generation in CI
- Data corruption → GET-only scoping
- 500s on bad UUIDs → type validation at the router level
- Rate limiting → environment-aware bypass

Seven iterations, zero shortcuts.

### Code Reviews as Knowledge Transfer

The MR !109 review (blue/green deployment) wasn't just bug-catching. It taught the MR author about deployment safety patterns: health-check-before-destructive-ops, lock files for concurrent access, validation of state files. The MR author applied every P0 fix before merge.

### Scope of the Multi-Device Session Feature

The biggest feature this week (!120) was a full-stack implementation spanning 24 files:
- **Database**: migration for `user_sessions` table with indexes
- **Backend**: DB queries, service layer (with session limit enforcement and UA parsing), router, auth dependency modification
- **Frontend**: Devices page, session API client, TanStack Query hooks, login flow modification, sidebar menu addition
- **Tests**: 33 backend tests + frontend component tests

This was built end-to-end by one person in one sprint week, including the schema-test compatibility fix that the new table required.

---

## Discipline

- Hadir tepat waktu di kelas dan meetings
- Responsive to team issues in Discord throughout the week
- Conventional commits consistently followed across all 8 MRs
- All MRs include proper Linear ticket codes in titles

---

## Evidence

### All MRs Authored
- [!107](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/107), [!108](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/108), [!110](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/110), [!111](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/111), [!112](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/112), [!116](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/116), [!119](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/119), [!120](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/120)

### MR Reviews (threaded discussions)
- [!109](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/109): 16 issues on blue/green deployment
- [!118](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/118): 8 issues on cancel invoice

### Linear Tickets
- [SIRA-131](https://linear.app/ppl-sira/issue/SIRA-131), [SIRA-160](https://linear.app/ppl-sira/issue/SIRA-160), [SIRA-210](https://linear.app/ppl-sira/issue/SIRA-210), [SIRA-211](https://linear.app/ppl-sira/issue/SIRA-211), [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214), [SIRA-226](https://linear.app/ppl-sira/issue/SIRA-226)
