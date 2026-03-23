---
title: "PPL: Sprint Planning at Scale [Sprint 2, Week 1]"
date: 2026-03-23
description: "How I planned Sprint 2 by creating 20 PBIs and 64 subtasks with detailed acceptance criteria, cross-PBI blocking relations, and sprint rebalancing."
tags: ["ppl", "discipline", "sprint-planning", "linear", "project-management"]
slug: s2w1-discipline
toc: true
---

## What I Worked On

As Team Lead, this week's primary work was Sprint 2 planning. I conducted a full feature gap analysis of the app, brainstormed new features with stakeholder input, created detailed tickets in Linear, set up cross-PBI dependency chains, and rebalanced the sprint when it became overloaded.

The result: **20 new PBIs with 64 subtasks**, all with acceptance criteria, technical notes, and proper sprint/cycle assignments.

## The Planning Process

### Step 1: Feature Gap Analysis

I started by cataloging everything that's implemented vs missing. The app had solid CRUD, auth, and overdue detection, but major gaps in:
- Email/notification channels (stub only)
- Analytics and reporting (dashboard has only 4 summary cards)
- Client communication history (reminder_logs table exists but is never written to)
- Settings/configuration (placeholder page)
- Import/export and bulk operations

### Step 2: Brainstorming Features in Rounds

I organized ticket creation in 3 rounds:

**Round 1**: CSV Import/Export (PBI 13, 8 subtasks). Import with 3-step modal (upload → manage conflicts → confirm), export with column selection and filters.

**Round 2**: Supporting features. Email integration with Resend (PBI 14), Telegram bot (PBI 15), AR analytics dashboard (PBI 16), client analytics + PDF export (PBI 17), settings page (PBI 18), design system for new features (PBI 19), communication history (added to existing PBI 8).

**Round 3**: Additional features. Invoice PDF generation (PBI 20), payment proof upload (PBI 21), bulk actions (PBI 22), in-app notifications (PBI 23), duplicate client detection (PBI 24), client self-service portal (PBI 25, Sprint 3), staff permission requests (PBI 26, Sprint 3).

### Step 3: Cross-PBI Blocking Relations

I set up dependency chains so devs working on different PBIs don't step on each other:

- PBI 19 (Design System) blocks all new feature PBIs
- PBI 14 (Email) blocks PBI 9 (automated reminders) and PBI 8 (audit log)
- PBI 22 (Bulk Actions) blocked by PBI 14 (email service for "Send Reminder" action)
- PBI 23 (Notifications) blocks PBI 26 (Permission Requests, Sprint 3)

### Step 4: Sprint Rebalancing

Sprint 2 initially had 12 new PBIs on top of 46 existing tickets. Way too much. I moved 7 PBIs to Sprint 3, keeping only the essential 5 in Sprint 2:

| Kept in Sprint 2 | Moved to Sprint 3 |
|---|---|
| Design System (foundation) | Telegram Bot |
| Email Integration (blocks reminders) | Payment Proof Upload |
| Settings Page (needed for email config) | In-App Notifications |
| CSV Import/Export | Dashboard Analytics |
| Invoice PDF Generation | Client Analytics + PDF |
| | Bulk Actions |
| | Duplicate Detection |

### Step 5: Ticket Sync Audit

After creating all tickets, I audited the entire board for contradictions:
- Fixed SIRA-135 (incorrect channel reference: WHATSAPP/SMS changed to TELEGRAM)
- Added descriptions to SIRA-2 (PBI 9) and SIRA-3 (PBI 8), which were empty
- Clarified export scope overlap between PBI 13 (filter export) and PBI 22 (selected rows export)
- Moved SIRA-72 from stale Sprint 1 to Sprint 2
- Verified all 64 tickets had correct cycle assignments

## Result

- **20 PBIs** created across Sprint 2 and Sprint 3
- **64 subtasks** with detailed acceptance criteria and technical notes
- **8 cross-PBI blocking relations** set
- Sprint 2 rebalanced from 12 to 5 new PBIs (manageable scope)
- All tickets synced with no contradictions

Every subtask includes scope tags ([FE], [BE], [FE+BE]), priority, and references to related tickets so different devs can work independently.

## Evidence

- [Linear Sprint 2 Board](https://linear.app/ppl-sira) (SIRA-146 to SIRA-209)
- [MR !106 - includes CLAUDE.md update for multi-ticket MR naming](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/106)
- [Linear SIRA-146](https://linear.app/ppl-sira/issue/SIRA-146) (PBI 13: Import/Export CSV, example of detailed ticket)
