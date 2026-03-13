---
title: "PPL: Development Discipline [Sprint 1, Week 3]"
date: 2026-03-13
description: "14 merge requests in one week: full-stack features, CI/CD hardening, production hotfixes, and data integrity fixes, each with descriptive commits and conventional naming."
tags: ["ppl", "discipline", "git", "ci-cd"]
slug: s1w3-discipline
toc: true
---

## What I Worked On

Sprint 1 Week 3 was the highest-output week of the project so far. I authored and merged **14 merge requests** covering full-stack features, CI/CD pipeline improvements, production infrastructure fixes, and data integrity patches.

## MR Summary

| MR | Type | Title | Date |
|----|------|-------|------|
| !20 | feat | Layout, navigation & dashboard (full stack) | Mar 7 |
| !47 | feat | Seed production admin and staff users with Nashta emails | Mar 7 |
| !12 | feat | Invoice management (full stack) | Mar 8 |
| !54 | feat | Add Payments link to sidebar navigation | Mar 8 |
| !66 | fix | Rename out-of-order migration timestamps to unblock CI deploy | Mar 9 |
| !67 | feat | Add migration dry-run validation to MR pipelines | Mar 9 |
| !68 | fix | Add missing ENCRYPTION_KEY to deploy env generation | Mar 9 |
| !71 | fix | Add proxy-headers to uvicorn for HTTPS redirect support | Mar 10 |
| !74 | chore | Add Conductor workspace support | Mar 11 |
| !76 | fix | Resolve invoice seeder subquery returning multiple rows | Mar 11 |
| !77 | fix | Deduplicate invoice numbers in seed CSV | Mar 11 |
| !78 | fix | Polish sidebar, header, profile edit, and invoices page consistency | Mar 11 |
| !79 | fix | Remove sidebar header bottom border | Mar 11 |
| !17 | feat | Client management (full stack, merged by me) | Mar 9 |

### Breakdown by category

- **Full-stack features:** 4 MRs (!20, !12, !54, !17)
- **CI/CD pipeline:** 3 MRs (!66, !67, !68)
- **Infrastructure:** 2 MRs (!71, !74)
- **Data integrity:** 3 MRs (!47, !76, !77)
- **UI polish:** 2 MRs (!78, !79)

## Commit Message Quality

Every commit follows the conventional commits format: `type(scope): description`. The scope tells you exactly which app/layer is affected, and the description is specific enough to understand the change without reading the diff.

Examples from this week:

```
feat(ci): add migrate:check job to validate migrations on MR pipelines
fix(api): resolve invoice seeder subquery returning multiple rows
fix(data): deduplicate invoice numbers in seed CSV
fix(infra): add proxy-headers to uvicorn for correct HTTPS redirects
chore(infra): make app ports configurable via env vars
docs(web): add fullName to auth context values in CLAUDE.md
```

Contrast with vague alternatives that would be less helpful:

```
# Bad: what did you fix? which migration? why?
fix: migration issue

# Good: tells you exactly what broke and what was done
fix(db): rename out-of-order migration timestamps to unblock CI deploy
```

The `(scope)` part is especially important in a monorepo. When a teammate sees `fix(api)` vs `fix(web)` vs `fix(infra)` in the git log, they immediately know which part of the system was affected without opening the diff.

## Branch Naming Convention

All branches follow the team's agreed format: `name/type/SIRA-XX-short-description`.

```
abhip/feat/SIRA-30-invoice-management
abhip/fix/SIRA-97-migration-timestamp-order
abhip/feat/SIRA-98-migration-dry-run
abhip/fix/SIRA-101-uvicorn-proxy-headers
abhip/fix/SIRA-106-sidebar-polish
abhip/fix/db-seed-error
```

Each branch links directly to a Linear ticket (except `db-seed-error`, which was a quick hotfix that didn't warrant a ticket). The `name/type/` prefix makes it trivially easy to filter branches by author or intent in `git branch --list 'abhip/*'`.

## MR Descriptions

Each MR includes a structured description with:
1. **What changed** in plain language
2. **Why** it was needed (linked to Linear ticket)
3. **Testing** performed or TDD evidence

For the migration dry-run MR (!67), the description explained the failure mode it prevents:

> Before: a migration that works locally but has SQL syntax incompatible with remote Supabase would only fail during deploy on main, breaking the pipeline after merge.
>
> After: `migrate:check` runs `supabase db push --dry-run` on every MR pipeline. If the migration is invalid, the MR pipeline fails before merge.

This prevents reviewers from needing to ask "why was this added?" since the context is self-contained.

## Rapid Response to Production Issues

Three MRs this week were direct responses to production issues encountered during deployment:

1. **!66** (migration timestamps): Out-of-order migration files blocked CI deploy. Fixed by renaming timestamps within the same day.
2. **!68** (ENCRYPTION_KEY): CI deploy generated `.env.local` without the encryption key, causing the API to crash on client operations. One-line fix to the deploy script.
3. **!71** (proxy headers): FastAPI behind Nginx + Cloudflare was sending HTTP redirects instead of HTTPS because uvicorn didn't know it was behind a reverse proxy. Added `--proxy-headers` flag.

Each fix was a separate MR (not bundled together) so the git history clearly shows the progression of issues found and resolved.

## Result

14 MRs merged in 7 days. No stale branches left behind. All commits follow conventional format. All branches follow naming convention. The CI pipeline caught 2 issues (!66, !67) that would have broken production deploys without the migration dry-run validation added this week.

## Evidence

- [MR !12 - SIRA-30 invoice management](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12)
- [MR !20 - SIRA-27 layout & dashboard](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20)
- [MR !66 - SIRA-97 migration timestamp fix](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/66)
- [MR !67 - SIRA-98 migration dry-run CI](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/67)
- [MR !68 - ENCRYPTION_KEY deploy fix](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/68)
- [MR !71 - SIRA-101 uvicorn proxy headers](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/71)
- [MR !74 - SIRA-104 Conductor workspace](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/74)
- [MR !76 - seeder subquery fix](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/76)
- [MR !77 - seed CSV deduplication](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/77)
- [MR !78 - SIRA-106 UI polish](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/78)
- [MR !79 - SIRA-106 sidebar border fix](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/79)
- [MR !54 - SIRA-89 payments sidebar](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/54)
- [MR !47 - SIRA-87 production seed users](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/47)
- [MR !17 - SIRA-29 client management](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/17)
