---
title: "[S1, W3] PPL: Communication and Knowledge Sharing"
date: 2026-03-10
description: "15 MR reviews with actionable fixes, 69/98 Linear tickets created, direct code contributions to teammates' branches, and proactive communication in Discord."
tags: ["ppl", "communication", "teamwork", "code-review", "knowledge-sharing"]
slug: s1w3-communication
toc: true
---

## Overview

This week's communication contributions fall into five categories: detailed code reviews, merge coordination, issue tracking, direct code contributions to teammates' MRs, and proactive Discord communication to unblock the team.

---

## 1. Detailed Code Reviews with Actionable Fixes

Reviewed 15 MRs this week. Each review goes beyond surface-level "LGTM": they include issue categorization (Critical/Important), before/after code snippets, and concrete suggested fixes that the MR owner can directly apply.

### MR !17: Client Management (9 issues found)

The most thorough review of the week. Found 9 issues including:

- **Critical: `id` used before declaration**, `const` is not hoisted, causing `ReferenceError` at runtime. Provided reordered declaration as fix.
- **Critical: Frontend/backend schema mismatch**, `language_preference` exists in frontend types but not in backend Pydantic models. Data silently dropped on create/update. Provided exact model additions for all three backend schemas.
- **Critical: Unhandled encryption failures**, a single corrupted row crashes the entire `list_clients` endpoint. Provided try/except with `InvalidTag` handling.

Each issue included the exact file path, current code, and a ready-to-apply fix.

- [MR !17 review (note 4837)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/17#note_4837)

### MR !64: Frontend Foundation (sample code fixes)

Reviewed the frontend foundation rewrite. Instead of just listing issues, provided complete sample code fixes for each one so the teammate could grab and apply them directly:

> "Here are sample code fixes for each issue so you can just grab and apply them (if applicable right away). Should make things faster."

- [MR !64 review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/64)

### MR !45: Staff Management

Found critical auth/DB desync issue: if Supabase Auth email update succeeds but the DB update fails, there's no rollback. Provided error handling pattern with rollback logic.

- [MR !45 review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/45)

### MR !61: Invoice Design System

Found client combobox using `company_name` as lookup key, which will associate wrong client on name duplicates. Suggested using `id` as the value key instead.

- [MR !61 review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/61)

### Other Reviews

| MR | Topic | Key Finding |
|----|-------|-------------|
| [!12](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12) | Invoice management follow-up | New issue from previous fix: router doesn't catch domain exceptions |
| [!46](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/46) | Auth deadlock fix | Verified correctness, no issues found, explained why the fix works |
| [!49](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/49) | Overdue detection | Acknowledged other reviewers' findings, added consistency issues with main |
| [!52](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/52) | DB schema & seed | Praised smart FK resolution via subqueries, approved |
| [!55](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/55) | SonarQube fixes | Follow-up: linked 4 remaining issues to Linear ticket SIRA-90 for tracking |

---

## 2. Merge Coordination as Maintainer

Managed the merge flow for the entire team this week: ~25 MRs merged, with active conflict resolution and duplicate MR consolidation.

### Consolidating Duplicate MRs

MR !48 (client DB schema) and MR !51 (invoice DB schema) were superseded by MR !52 which combined all schema changes. Instead of leaving stale MRs open, I closed them with clear explanations:

> "Closing, superseded by !52 which includes all client changes plus shared utils, payments, and review fixes."

This prevents confusion about which MR to review and reduces coupling risk from merging overlapping changes separately.

- [MR !48 closed](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/48)
- [MR !51 closed](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/51)
- [MR !52](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/52)

### Discord Merge Communication

Actively coordinated merges in the team Discord:

> "tag gua or qi aja ya guys kalo ada MR yg dah direview (dan di-address reviewnya) dan ready merge. or klo emang ga perlu review tp dah ready merge tag juga aja"

> "guys yg dah ada review di MR nya cb address yak biar cepet merge, yg belom pernah review MR coba review aja buat nilai IR"

---

## 3. Linear Ticket Management

Created **69 out of 98 total Linear tickets** for the project. This includes:

- Parent PBIs with full descriptions, acceptance criteria, and scope definitions
- Subtask breakdowns under each PBI with clear assignees and estimates
- Backlog items for deferred work (SIRA-73, SIRA-74, SIRA-82 to 84, SIRA-88, SIRA-90)

Additionally, built a **Linear auto-tagger CI job** (MR !31, SIRA-67) that automatically links GitLab MRs to Linear tickets and updates their status. Before this, linking was manual, now it happens automatically for the entire team on every MR.

- [MR !31: Linear auto-tagger](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/31)
- [Linear SIRA-67](https://linear.app/ppl-sira/issue/SIRA-67)

---

## 4. Direct Code Contributions to Teammates' MRs

Beyond just reviewing, I pushed commits directly to teammates' branches to fix maintainability issues, knowledge sharing through code, not just comments.

### MR !40: Frontend Foundation (soydoradesu)

Pushed commits to simplify the lib layer that other MRs would build on:

> "Hey, I pushed a few commits to clean up maintainability issues in the lib layer (since other MRs will build on top of this): simplified api.ts, cleaned up constant aliases, removed redundant code"

- [MR !40](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/40)

### MR !50: Dev Environment Fix (dafandikri)

Pushed 4 commits with fixes and improvements:

1. Removed unnecessary `sira-pull-images` process (infra should stay persistent across restarts)
2. Added pre-flight dependency checks to `check-deps.sh` / `check-deps.ps1`
3. Fixed stale process port binding issue

- [MR !50](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/50)

---

## 5. Proactive Discord Communication

### Teaching Code Review Practices

Introduced the team to GitLab's threaded review system:

> "info kecil, klo ngereview MR bole pake ini guys, jan comment biasa. biar jadinya thread, and kalo dev owner MR nya dah fix, dia bisa 'resolve' buat mark as done gt reviewnya"

### Onboarding and Environment Support

- Shared updated `.env.example` with explanations when new env vars were added
- Guided teammates through GlitchTip signup: "sign up aja ya guys", "cek spam guys" (email went to spam due to free SMTP tier)
- Explained GlitchTip's purpose: "glitchtip tu buat catch runtime error, klo lagi debugging di prod, ato mau pasang alert"

### Unblocking Teammates

- Notified team immediately when shared components merged: "component dari valen dah merged ya guys, yang lagi implement design system gas tgl pull dr main"
- Linked MR reviews in Discord so teammates don't miss them: "dli gua ada feedback, mesti difix ni biar ga crash pas runtime [link to MR !17]"
- Distributed tasks proactively: "kalo lu belom TDD, ambil aja yg invoice due itu, yg bagian gua, biar lu ada TDD nya"

### Sharing Resources

Shared personal blog as a reference for the team:

> "https://blog.abhipraya.dev/, blog gua guys, klo butuh referensi"

---

## Evidence

### MR Reviews
- [MR !12](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/12), [!17](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/17), [!20](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/20), [!40](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/40), [!45](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/45), [!46](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/46), [!48](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/48), [!49](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/49), [!50](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/50), [!51](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/51), [!52](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/52), [!55](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/55), [!61](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/61), [!63](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/63), [!64](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/64)

### Linear Tickets
- [SIRA-67](https://linear.app/ppl-sira/issue/SIRA-67): Linear auto-tagger
- 69/98 total tickets created, [full project board](https://linear.app/ppl-sira)

### Discord Chat Log
- Team Discord channel, Mar 4 to 10, 2026
