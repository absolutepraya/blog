---
title: "PPL: Code Review [Sprint 1, Week 3]"
date: 2026-03-13
description: "Detailed code reviews across 10 teammates' MRs: finding stale data bugs in TanStack Query, identifying duplicated form logic, catching auth/DB desync risks, and pushing fix commits directly."
tags: ["ppl", "code-review", "collaboration"]
slug: s1w3-code-review
toc: true
---

## What I Worked On

This week I reviewed **10 teammates' merge requests**, leaving substantive comments with code samples, performance suggestions, and architectural fixes. Three reviews included fix commits that I pushed directly to the teammate's branch to unblock merging.

## Review Summary

| MR | Author | Feature | Review Type |
|----|--------|---------|-------------|
| !75 | soydoradesu | Client management pages | Duplicate code + missing field |
| !72 | hl | Dashboard stale data fix | TanStack Query invalidation gap |
| !64 | soydoradesu | Frontend foundation | Comprehensive review + fix commits |
| !49 | qenthm | Overdue detection worker | Consistency + naming review |
| !45 | froklax | Staff management | Auth/DB desync risk |
| !46 | adipppp | Auth deadlock fix | Correctness verification |
| !50 | dafandikri | Dev environment fix | Review + 4 fix commits pushed |
| !40 | soydoradesu | Frontend foundation | Cleanup commits pushed |
| !52 | adipppp | Payment seeder | FK resolution review |
| !63 | adipppp | JWT alg:none hardening | Security review |

---

## Most Significant Reviews

### MR !72 (hl): Stale Data Bug in TanStack Query

This MR aimed to fix stale dashboard data after invoice/payment changes. I reviewed the changes against TanStack Query v5 docs and found an incomplete invalidation:

> **Missing `['invoices']` list invalidation in `useCreatePayment`**
>
> When a payment is recorded, the invoice's status/outstanding amount changes (e.g. OVERDUE → PAID). Currently `useCreatePayment` invalidates `['invoices', invoiceId]` (detail view) but **not** `['invoices']` (the list). This means the invoices list page shows stale status/amounts until the user manually refreshes.

This is a class of bug where the fix solves the symptom in one view but leaves the same stale-data problem in another. In TanStack Query, invalidating a specific key (`['invoices', id]`) does not automatically invalidate the parent key (`['invoices']`). This is by design since list and detail queries can have different shapes and staleness requirements.

### MR !75 (soydoradesu): Duplicated Form Logic

The client management pages had form validation, types, and payload builders duplicated between two files. I identified the duplication and provided a concrete extraction:

> `ClientFormValues`, `ClientFormErrors`, `validateClientForm`, `hasErrors`, and `toUpdatePayload` are duplicated between `clients.tsx` and `client-detail.tsx`. Might be worth extracting into a shared module.

I also caught a silent data loss bug:

> The form in both files has an **Address** field that the user can fill in, but `toCreatePayload()` and `toUpdatePayload()` never include it in the request body. The user types an address and it gets silently thrown away.

Then provided the fix code:

```ts
// If the backend supports address:
function toCreatePayload(values: ClientFormValues): ClientCreate {
  return {
    company_name: values.company_name,
    pic_email: values.pic_email,
    pic_phone: values.pic_phone || null,
    address: values.address || null,  // Was missing
  }
}
```

### MR !45 (froklax): Auth/DB Desync Risk

The staff management feature had a critical issue in the `update` method:

> `update_user_by_id` is called with no try/except. If Auth email update succeeds but DB update fails (or vice versa), Auth and DB go out of sync with no rollback. The `create` method correctly has error handling, but `update` doesn't.

This is a real production risk: an admin changes a staff member's email, the Supabase Auth update succeeds, but the DB update fails. Now the user's email in Auth doesn't match their email in `app_users`. They can log in via Auth but the app looks up the wrong (old) email.

### MR !64 (soydoradesu): Comprehensive Foundation Review

This was the largest review. The Frontend Foundation MR rewrote the API client, auth context, and shared constants. I wrote two separate comment threads:

**Thread 1:** Sample code fixes for 6+ issues, including:
- Removing committed `tsconfig.tsbuildinfo` and gitignoring it
- Removing unnecessary `'use client'` directives (SIRA uses Vite, not Next.js)
- Cleaning up git merge artifacts left in the code

**Thread 2:** Architectural feedback praising the API client rewrite while identifying remaining issues. The new `createApiClient()` with injectable `getToken`, `clearSession`, and `onUnauthorized` was a genuine improvement over the previous Supabase-coupled version.

### MR !49 (qenthm): Overdue Detection Consistency

After two teammates had already reviewed this MR, I added a follow-up focusing on consistency with existing patterns on `main`:

> Thanks @dafandikri and @hl for the thorough reviews, you both caught some solid stuff. I want to add a few more things that I think we should address before merging this, mostly around consistency with what's already on `main`.

The review acknowledged the TDD quality (red-green approach, comprehensive coverage including timezone handling and idempotency tests) while flagging naming conventions and import patterns that diverged from the established codebase.

### MR !46 (adipppp): Auth Deadlock Verification

This MR fixed a deadlock where `getSession()` in the Axios interceptor triggered another `getSession()` call, creating an infinite loop. My review confirmed the fix was correct:

> The deadlock fix is correct: passing the token directly to `fetchRole` and adding the early return in the Axios interceptor cleanly avoids the re-entrant `getSession()` lock. The `.catch()` on `getSession()` properly ensures `isLoading` resolves to `false` on unexpected errors.

I also noted a minor redundancy: `session?.access_token` used optional chaining where `session` was already confirmed truthy by the ternary above it.

## Reviews with Direct Fix Commits

For three MRs, I pushed fix commits directly to the teammate's branch rather than just commenting:

- **!50 (dafandikri):** Pushed 4 commits, including removing an infra process that should stay persistent, adding pre-flight checks to `make dev`, and fixing stale process cleanup.
- **!40 (soydoradesu):** Pushed cleanup commits simplifying `api.ts`, removing duplicated constants, and adding TDD red/green test commits.
- **!12 (my own MR, with teammate's review feedback):** Applied code review suggestions by fixing the `response` null-check bug and using parent query data instead of redundant global fetch.

## Result

10 MRs reviewed. 6 had substantive feedback with specific code suggestions. 3 received direct fix commits. Issues ranged from silent data loss (!75 address field), stale UI bugs (!72 TanStack Query), auth/DB desync risks (!45), to performance inefficiencies.

## Evidence

- [MR !75 - Note on duplicate code and missing address field](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/75)
- [MR !72 - TanStack Query invalidation review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/72)
- [MR !64 - Comprehensive frontend foundation review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/64)
- [MR !49 - Overdue detection consistency review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/49)
- [MR !45 - Staff management auth/DB desync](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/45)
- [MR !46 - Auth deadlock fix verification](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/46)
- [MR !50 - Dev environment review + 4 fix commits](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/50)
- [MR !52 - Payment seeder FK resolution review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/52)
- [MR !63 - JWT alg:none security review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/63)
- [MR !40 - Frontend foundation cleanup commits](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/40)
