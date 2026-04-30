---
title: "[S1, W3] PPL: Work Ethic and Commitment"
date: 2026-03-10
description: "Quantitative and qualitative breakdown of Sprint 1 Week 3 contributions: 13 MRs authored, 15 MRs reviewed, ~25 MRs merged as maintainer, spanning CI/CD, infrastructure, backend, frontend, and database."
tags: ["ppl", "commitment", "work-ethic", "productivity"]
slug: s1w3-commitment
toc: true
---

## Overview

Sprint 1 Week 3 (Mar 4 to 10) output summary:

| Metric | Count |
|--------|-------|
| MRs authored & merged | 13 |
| MRs reviewed | 15 |
| MRs merged as maintainer | ~25 |
| Linear tickets created (cumulative) | 69/98 |
| Domains covered | 5 (CI/CD, infra, backend, frontend, database) |

---

## Quantitative Output

### MRs Authored and Merged

13 MRs created and merged to `main` this week:

| MR | Type | Description |
|----|------|-------------|
| [!31](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/31) | feat(ci) | Linear auto-tagger for GitLab MR linking |
| [!34](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/34) | fix | Code quality issues from post-payment-merge review |
| [!35](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/35) | fix(auth) | Infinite loading after login via auto-link app_users |
| [!37](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37) | feat(api) | Structured JSON HTTP access logging middleware |
| [!38](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/38) | feat(ci) | Security SAST job with bandit and pnpm audit |
| [!39](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/39) | feat(infra) | GlitchTip email alerting via Resend SMTP |
| [!41](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/41) | feat(ci) | Manual trigger & rollback for production migrations |
| [!42](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/42) | fix(ci) | Restore automatic migration, keep rollback as manual |
| [!44](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/44) | feat(infra) | Nginx reverse proxy for subdomain routing |
| [!47](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/47) | feat(db) | Seed production admin and staff users |
| [!54](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/54) | feat(web) | Add Payments link to sidebar navigation |
| [!66](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/66) | fix(db) | Rename out-of-order migration timestamps |
| [!67](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/67) | feat(ci) | Migration dry-run validation for MR pipelines |

Plus [!68](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/68) (hotfix: missing ENCRYPTION_KEY in deploy env).

### MRs Reviewed

15 MRs reviewed with detailed feedback (not just approvals):

[!12](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12), [!17](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/17), [!20](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20), [!40](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/40), [!45](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/45), [!46](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/46), [!48](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/48), [!49](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/49), [!50](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/50), [!51](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/51), [!52](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/52), [!55](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/55), [!61](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/61), [!63](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/63), [!64](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/64)

---

## Cross-Domain Coverage

Not limited to a single domain, this week's work spanned five areas:

### CI/CD (4 MRs)
- Security SAST job with Bandit + pnpm audit ([!38](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/38))
- Migration dry-run validation on MR pipelines ([!67](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/67))
- Migration rollback support ([!41](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/41), [!42](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/42))
- Linear auto-tagger for the whole team ([!31](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/31))

### Infrastructure (2 MRs)
- Nginx reverse proxy for 3 subdomains ([!44](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/44))
- GlitchTip email alerting via Resend SMTP ([!39](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/39))

### Backend (3 MRs)
- Structured JSON HTTP access logging middleware ([!37](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37))
- Auth fix: infinite loading after login ([!35](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/35))
- Code quality fixes from post-merge review ([!34](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/34))

### Database (3 MRs)
- Production user seeding with Nashta emails ([!47](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/47))
- Migration timestamp fix to unblock CI deploy ([!66](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/66))
- ENCRYPTION_KEY deploy fix ([!68](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/68))

### Frontend (1 MR)
- Payments sidebar navigation ([!54](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/54))

---

## Quality Indicators

### Descriptive Commit Messages and MR Descriptions

Every MR follows conventional commits (`feat`, `fix`, `chore`, `refactor`) with scope tags. MR descriptions include summary, changes, and test plans. Examples:

- `SIRA-98 feat(ci): add migration dry-run validation to MR pipelines`
- `SIRA-75 feat(infra): configure GlitchTip email alerting via Resend SMTP`
- `SIRA-69 fix(auth): fix infinite loading after login via auto-link app_users`

### Iterative Problem-Solving

SIRA-76 (migration management) demonstrates iterative refinement:
1. First attempt: all migrations as manual trigger ([!41](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/41))
2. After evaluating tradeoffs: switched to auto-migrate on deploy with manual rollback only ([!42](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/42))

Not just shipping the first thing that works, but evaluating and refining the approach.

### Code Reviews Beyond Surface Level

Reviews are not boilerplate. MR !17 found 9 issues including runtime crashes, schema mismatches, and encryption failures, each with a concrete fix. MR !64 provided sample code patches the teammate could directly apply.

---

## Discipline

- Hadir tepat waktu di kelas dan meetings
- Responsive to team issues in Discord throughout the week (VPN troubleshooting, env setup, merge coordination)
- Conventional commits consistently followed across all 13 MRs

---

## Evidence

### All MRs Authored
- [!31](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/31), [!34](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/34), [!35](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/35), [!37](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/37), [!38](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/38), [!39](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/39), [!41](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/41), [!42](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/42), [!44](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/44), [!47](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/47), [!54](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/54), [!66](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/66), [!67](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/67), [!68](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/68)

### Linear Tickets
- 69/98 total project tickets created: [full board](https://linear.app/ppl-sira)
- Key tickets this week: [SIRA-57](https://linear.app/ppl-sira/issue/SIRA-57), [SIRA-67](https://linear.app/ppl-sira/issue/SIRA-67), [SIRA-70](https://linear.app/ppl-sira/issue/SIRA-70), [SIRA-71](https://linear.app/ppl-sira/issue/SIRA-71), [SIRA-75](https://linear.app/ppl-sira/issue/SIRA-75), [SIRA-76](https://linear.app/ppl-sira/issue/SIRA-76), [SIRA-87](https://linear.app/ppl-sira/issue/SIRA-87), [SIRA-89](https://linear.app/ppl-sira/issue/SIRA-89), [SIRA-97](https://linear.app/ppl-sira/issue/SIRA-97), [SIRA-98](https://linear.app/ppl-sira/issue/SIRA-98)

### Merged MR List
- [All merged MRs](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests?state=merged)
