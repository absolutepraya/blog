---
title: "PPL: Team Dev Management [Sprint 3, Week 1]"
date: 2026-04-15
description: "Two MRs reviewed this week: AR Staff read-only client access (SIRA-128) and communication history UI (SIRA-182). Four review threads spanning a P0 double-prefix URL bug, a P0 missing React key, a P1 breadcrumb that broke the role-based flow, and an out-of-scope rename caught before it spread."
tags: ["ppl", "code-review", "team-management"]
slug: s3w1-code-review
toc: true
---

## What I Worked On

Two substantial MRs reviewed this week: fadhliraihan's AR Staff read-only client access (MR !171) and fernanda.nadhiftya's communication history UI (MR !177). Both are frontend-heavy and both shipped with strict TDD discipline visible in the commits. Four review threads total: 2 on !171, 3 on !177, covering two P0 bugs I caught on !177 and a P1 on !171 that would have broken the exact feature the MR was trying to ship.

---

## MR !171: AR Staff Read-Only Client Access (fadhliraihan)

SIRA-128 added a read-only clients view for AR Staff. Admins keep their existing `/admin/clients` flow; AR Staff get `/clients` which uses the same page components with a `readOnly` prop. Route wrappers keep `ClientDetailPage` composable without duplicating the page.

**What was great**

- Strict TDD flow with visible RED/GREEN commit pairs
- Route wrappers kept `ClientDetailPage` composable without duplicating the page
- Breadcrumb tests covered both admin and read-only paths
- Sidebar href test checked both presence AND link target, not just text

**P1: Breadcrumb parent link hardcoded to `/admin/clients`**

The in-page breadcrumb had a hardcoded parent link:

```tsx
// client-detail.tsx:248 — breaks the feature the MR is shipping
<Link to="/admin/clients">Klien</Link>
```

An AR Staff user clicking "Klien" in the breadcrumb would hit the admin guard, get the "Akses ditolak" toast, and bounce to the dashboard. The MR was specifically adding an AR Staff flow, and the breadcrumb was silently sending them back into the admin flow they do not have access to. Fix:

```tsx
<Link to={readOnly ? '/clients' : '/admin/clients'}>Klien</Link>
```

The `readOnly` prop was already threaded through the page. One conditional in the breadcrumb keeps it consistent with the routing split.

**P1: Out-of-scope label rename**

A constant rename snuck into this MR:

```tsx
// Renamed from 'Pengaturan' to 'Konfigurasi & Pengaturan'
const CONFIGURATION_AND_SETTINGS_LABEL = 'Konfigurasi & Pengaturan'
```

But the settings page heading, the dashboard tile, and the update toast still said `'Pengaturan'`. So the sidebar would say "Konfigurasi & Pengaturan" and the page you land on would say "Pengaturan". Also completely out of scope for SIRA-128 (read-only client access). Either revert here, or do the full rename in a dedicated MR. Partial renames across a single MR are how inconsistent labels get into production.

**P1: Read-only gating tests asserting English names, source renders Indonesian**

`clients-page.test.tsx:152` had:

```tsx
expect(screen.queryByRole('button', { name: 'Add Client' })).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
```

But the actual buttons render in Indonesian ("Tambah Klien", "Ubah", "Hapus"). The test queries would never find a match regardless of the gating logic — they pass trivially because the button names simply do not exist, not because the read-only guard works. Tests that always pass are not testing anything.

**P1: No test for the "Ubah Klien" button being hidden in read-only mode**

`ClientDetailPage` shows an "Ubah Klien" button for admins. The `readOnly` prop is supposed to hide it for AR Staff. There was no test verifying this. Without it, someone could remove the `!readOnly` guard on `client-detail.tsx:272` and all tests would still pass:

```tsx
it('hides Ubah Klien button in read-only mode', () => {
    render(<ClientDetailPage readOnly />)
    expect(screen.queryByRole('button', { name: 'Ubah Klien' })).not.toBeInTheDocument()
})
```

---

## MR !177: Communication History UI (fernanda.nadhiftya)

SIRA-182 added a "Riwayat Komunikasi" section to the client detail page, showing all email/WhatsApp/SMS reminders sent to that client. Integration tests on the backend were strong. The frontend component had two P0 bugs that would have shipped broken.

**What was great**

- Integration tests in `test_communications_integration.py` were excellent. Real DB, meaningful assertions, proper pagination verification, role-based access checks.
- Component design with proper loading skeletons, empty state, and expandable rows. Badge components with exhaustive `Record` mappings are a strong pattern.
- Type safety was consistent throughout, no `any`, proper Pydantic Literal types, and the `as const` derivation pattern on the frontend.

**P0: Double `/api` prefix → 404 on every request**

The hook had this line:

```ts
// use-reminders.ts:16 — hits /api/api/clients/{id}/communications
api.get<Reminder[]>(`/api/clients/${clientId}/communications`).then((r) => r.data)
```

The `api` axios client already has `baseURL: '/api'` configured (set up via the Vite proxy). Every other hook in the codebase, including `useReminders` eight lines up in the same file, uses paths without the `/api` prefix. This one call accidentally re-added the prefix. Result: requests went to `/api/api/clients/{id}/communications`, which 404s.

```ts
// Fix: remove /api prefix, consistent with every other hook in the codebase
api.get<Reminder[]>(`/clients/${clientId}/communications`).then((r) => r.data)
```

I caught this via manual testing, not code reading alone. When I navigated to the client detail page, I got a "Not Found" toast in the bottom right corner while the communication section showed "Belum ada komunikasi" as if empty. That combination (toast + empty state) is the smoking gun for a silently failing request with no error handling.

**P0: Missing React key on fragment inside `.map()`**

```tsx
// communication-history-table.tsx:75 — no key on outermost element
{reminders.map((r) => (
    <>
        <TableRow>...</TableRow>
        {expanded === r.id && <TableRow>...</TableRow>}
    </>
))}
```

React needs the key on the outermost element returned from the `.map()` callback. A bare `<>` fragment does not accept a `key` prop. This causes React warnings and can produce incorrect DOM reconciliation when rows are added or removed (expanded row content showing for the wrong reminder). Fix:

```tsx
{reminders.map((r) => (
    <Fragment key={r.id}>
        <TableRow>...</TableRow>
        {expanded === r.id && <TableRow>...</TableRow>}
    </Fragment>
))}
```

`React.Fragment` accepts a `key` where `<>` does not. Standard React gotcha, easy to miss when the bare fragment is what the IDE autocompletes.

**P0: No error state handling on the query**

Tied to the double-prefix bug above: the `useQuery` hook had no `onError` handler and the component did not render anything when the query failed. The 404 from the double prefix silently showed as the empty state. Even without the prefix bug, any future network failure would present as "no communications" which is misleading. The fix adds a visible error banner when the query errors.

---

## Beyond the Review: Ticket Follow-Up

While reviewing !177, I noticed the reminders page shown in the screenshot had filtering needs that were not part of this MR's scope. Rather than scope-creep into the review, I created [SIRA-263](https://linear.app/ppl-sira/issue/SIRA-263) for a dedicated reminders page with filtering, and mentioned it in the review thread so fernanda could pick it up next.

This is the discipline half of code review: each MR should close its own scope cleanly, and adjacent work that surfaces during review should go into new tickets, not ballooning existing ones.

---

## Review Writing Style

Every review opens with a positive acknowledgment. Every P0/P1 item leads with the file:line reference in brackets, states the bug, and gives a fix snippet in a code block. This is the team convention (see the [review format reference](https://blog.abhipraya.dev/ppl/part-c/s1w3-communication/) for the full style rules), and it pays off: the author can fix each item without asking for clarification.

The "a few things i liked" section at the top is not boilerplate. It names specific strengths that should continue in future MRs. "The route wrappers keep `ClientDetailPage` composable" is different from "good work"; the former tells the author what pattern to repeat.

---

## Results

| MR | Author | P0 | P1 | Impact |
|----|--------|----|----|--------|
| !171 AR Staff read-only | fadhliraihan | 0 | 4 | Broken breadcrumb, out-of-scope rename, trivially-passing gating tests, missing read-only UI test |
| !177 Communication history | fernanda.nadhiftya | 2 | 0 | Double-prefix 404, missing React key caught before merge |
| **Total** | | **2** | **4** | |

![My review thread on MR !171 (SIRA-128) showing 4 items](/images/ppl/s3w1-b4-review-mr171.png)

![Manual testing note on MR !177 showing the "Not Found" toast and SIRA-263 ticket created](/images/ppl/s3w1-b4-review-mr177-manual-testing.png)

Both MRs merged after the fixes were applied. The double-prefix bug in particular would have been a user-visible regression (empty UI with no data) that was invisible to the backend tests passing.

---

## Evidence

- MR !171 — [SIRA-128](https://linear.app/ppl-sira/issue/SIRA-128): AR Staff read-only client list and detail (fadhliraihan)
- MR !177 — [SIRA-182](https://linear.app/ppl-sira/issue/SIRA-182): communication history UI (fernanda.nadhiftya)
- Created [SIRA-263](https://linear.app/ppl-sira/issue/SIRA-263) during review for follow-up reminders page work
