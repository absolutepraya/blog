---
title: "PPL: Code Review at Two Altitudes [Sprint 2, Week 3]"
date: 2026-04-15
description: "Five teammate MRs reviewed across two weeks, 50 total review points including 9 P0s. Architectural bugs (broken SQL join leaking payments, silent auth bypass, no key whitelist) caught through code reading; UI regressions (double /api prefix 404, React key in fragment) caught through manual testing. Both altitudes matter."
tags: ["ppl", "code-review", "team-management"]
slug: s2w3-code-review
toc: true
---

## What I Worked On

Two weeks of code review on teammate MRs. Week 1 (2-8 Apr) covered three substantial MRs: hl's CSV import modal (!155), hl's settings management system (!128), and qenthm's ML risk scoring engine (!166) — 44 review points including 7 P0s. Week 2 (9-15 Apr) covered fadhliraihan's AR Staff read-only client access (!171) and fernanda.nadhiftya's communication history UI (!177) — 6 review points including 2 P0s caught through manual testing that static reading missed. Fifty review points total, nine P0s, reviews posted as threaded discussions on every MR.

---

## Week 1 Review 1: MR !155 — CSV Import Modal (hl)

The CSV import wizard lets admins bulk-import clients, invoices, and payments from CSV files. Multi-step UI with progress indication, error display, server-side validation. The implementation was structurally well-designed, but the review caught three P0 issues that would have shipped a broken feature.

**P0: Raw `fetch()` bypassing the auth client**

```typescript
// P0: fetch() sends no Authorization header — API rejects with 401
const response = await fetch(`${API_URL}/clients/import`, {
    method: "POST",
    body: formData,
})
```

The project's `api` client (from `src/lib/api.ts`) uses an Axios interceptor that automatically injects the Supabase JWT token. Native `fetch()` has no such interceptor. The feature would appear to work in local dev (auth often permissive) and fail in production for every user. Fix:

```typescript
const response = await api.post("/clients/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
})
```

**P0: FileReader errors silently ignored**

```typescript
reader.onerror = () => {
    // empty — parse proceeds with undefined content
}
```

A corrupted or unreadable file would leave `reader.result` as `null`, then get passed to the CSV parser, which throws an uncaught exception that surfaces as a generic "something went wrong." Fix adds an explicit error state with a user-visible message.

**P0: CSV parse errors uncaught**

The `papaparse` call had no `error` callback. Malformed rows (wrong delimiter, unbalanced quotes) would silently produce `undefined` data that passed validation and reached the server, corrupting whatever imported.

**P1 items:** missing header validation (wrong template accepted silently), empty string used as fallback ID for unmatched entities (would create orphan records).

![MR !155 review thread 1](/images/ppl/s2w3-b4-review-mr155-0.png)

![MR !155 review thread 2](/images/ppl/s2w3-b4-review-mr155-1.png)

![MR !155 review thread 3](/images/ppl/s2w3-b4-review-mr155-2.png)

![MR !155 review thread 4](/images/ppl/s2w3-b4-review-mr155-3.png)

---

## Week 1 Review 2: MR !128 — Settings Page Management (hl)

The settings page lets admins configure system-wide parameters: reminder timing, risk thresholds, email subjects. Backend stores settings as key-value pairs in a `settings` table. Frontend provides a form with validation.

**P0: No key whitelist, any key accepted silently**

```python
# P0: any key could be injected
async def update_settings(db: Client, updates: dict[str, Any]) -> None:
    for key, value in updates.items():
        await db.table("settings").upsert({"key": key, "value": value}).execute()
```

A bug or crafted request could inject `{"admin_override": True}` or any other key into the settings table, silently persisting garbage. Fix requires a whitelist:

```python
_ALLOWED_KEYS = frozenset({"reminder_days_before", "risk_threshold_high", ...})

async def update_settings(db: Client, updates: dict[str, Any]) -> None:
    invalid = set(updates) - _ALLOWED_KEYS
    if invalid:
        raise ValueError(f"Unknown settings keys: {invalid}")
```

**P0: Frontend shows no error state**

The settings form called the API mutation but had no `onError` handler. A failed save (validation error, network error) showed no feedback. The form appeared to submit successfully while nothing changed on the server.

**P1 items:** settings category typed as bare `str` instead of a `Literal` type (losing compile-time exhaustiveness), missing integration tests for admin-only access verification.

![MR !128 review: P0 no key whitelist and missing error state on frontend](/images/ppl/s2w3-b4-review-mr128.png)

---

## Week 1 Review 3: MR !166 — Rule-Based Risk Scoring Engine (qenthm)

The risk scoring engine assigns LOW/MEDIUM/HIGH risk to clients based on payment history. Strategy pattern with pluggable scoring rules. Strong architecture overall — until you read the data access layer.

**P0: Broken cross-table join, all payments returned instead of filtered by client**

```python
# P0: missing client_id filter — this returns every payment in the entire system
result = db.table("payments").select("*, invoices(client_id)").execute()
payments = [p for p in result.data if p["invoices"]["client_id"] == client_id]
```

PostgREST does not filter the main table when you filter via a joined table's column. `select("*, invoices(client_id)")` fetches ALL payments with their related invoice, and the `client_id` filter runs in Python on the full dataset. For a system with 10,000 payments across 500 clients, this means loading all 10,000 records into memory to filter to ~20 per client.

It's also a correctness issue: if the `invoices` join returned `None` for any payment, the Python-side filter would throw `TypeError`, failing the entire scoring run for unrelated reasons. Fix filters at the query level:

```python
result = (
    db.table("payments")
    .select("*, invoices!inner(client_id)")
    .eq("invoices.client_id", client_id)
    .execute()
)
```

**P0: Bare `except Exception` hiding real errors**

```python
try:
    score = self._calculate_score(features)
except Exception:
    return RiskLevel.LOW  # silent fallback
```

Every uncaught exception, including bugs in the scoring logic itself, silently returned LOW risk. A client who should be HIGH risk (and get a firm reminder) would appear LOW risk and get a polite reminder, undermining the entire point of risk-based reminders.

**P1: CLAUDE.md architecture violation.** Service called Supabase directly instead of going through the `db/queries/` layer.

![MR !166 review: P0 broken cross-table join returning all payments across all clients](/images/ppl/s2w3-b4-review-mr166.png)

---

## Week 2 Review 1: MR !171 — AR Staff Read-Only Client Access (fadhliraihan)

SIRA-128 added a read-only clients view for AR Staff. Admins keep `/admin/clients`; AR Staff get `/clients` using the same page components with a `readOnly` prop. Route wrappers kept `ClientDetailPage` composable without duplicating the page.

**What was great:** strict TDD flow with visible RED/GREEN commit pairs, route wrappers composable, breadcrumb tests covering both admin and read-only paths, sidebar href test checked both presence AND link target.

**P1: Breadcrumb parent link hardcoded**

```tsx
// client-detail.tsx:248 — breaks the feature the MR is shipping
<Link to="/admin/clients">Klien</Link>
```

An AR Staff user clicking "Klien" would hit the admin guard, get the "Akses ditolak" toast, and bounce to dashboard. The MR was adding an AR Staff flow, and the breadcrumb was silently sending them into admin-only territory. Fix:

```tsx
<Link to={readOnly ? '/clients' : '/admin/clients'}>Klien</Link>
```

**P1: Out-of-scope label rename.** A `CONFIGURATION_AND_SETTINGS_LABEL` rename snuck in, but the settings page heading, dashboard tile, and update toast still said the old label. Sidebar would say one thing, the page you land on says another. Partial renames across an MR are how inconsistent labels reach production.

**P1: Read-only gating tests asserting English names, source renders Indonesian**

```tsx
expect(screen.queryByRole('button', { name: 'Add Client' })).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
```

Actual buttons render as "Tambah Klien", "Ubah". Tests pass trivially because the English names simply do not exist, not because the read-only guard works. Tests that always pass are not testing anything.

**P1: No test for the hidden "Ubah Klien" button in read-only mode.** Someone could remove the `!readOnly` guard and all tests still pass.

![My review thread on MR !171 showing 4 items](/images/ppl/s2w3-b4-review-mr171.png)

---

## Week 2 Review 2: MR !177 — Communication History UI (fernanda.nadhiftya)

SIRA-182 added a "Riwayat Komunikasi" section to client detail, showing email/WhatsApp/SMS reminders sent. Backend integration tests were excellent. The frontend had two P0 bugs that only surfaced through **manual testing**, not code reading.

**What was great:** integration tests in `test_communications_integration.py` with real DB, meaningful assertions, proper pagination verification, role-based access checks. Component design with loading skeletons, empty state, expandable rows. Type safety consistent throughout (no `any`, proper Pydantic Literal types).

**P0: Double `/api` prefix → 404 on every request**

```ts
// use-reminders.ts:16 — hits /api/api/clients/{id}/communications
api.get<Reminder[]>(`/api/clients/${clientId}/communications`).then((r) => r.data)
```

The `api` axios client already has `baseURL: '/api'`. Every other hook in the codebase (including `useReminders` 8 lines up in the same file) uses paths without the `/api` prefix. This one call accidentally re-added it.

I caught this via manual testing, not code reading. Navigating to the client detail page showed a "Not Found" toast in the corner while the section showed "Belum ada komunikasi" as if empty. That combination — toast + empty state — is the smoking gun for a silently failing request with no error handling. Reading the code alone would have missed it because each line is syntactically fine.

**P0: Missing React key on fragment inside `.map()`**

```tsx
{reminders.map((r) => (
    <>
        <TableRow>...</TableRow>
        {expanded === r.id && <TableRow>...</TableRow>}
    </>
))}
```

A bare `<>` fragment does not accept a `key` prop. React reconciliation goes wrong when rows add/remove — expanded row content shows for the wrong reminder. Fix uses `<Fragment key={r.id}>` instead.

**P0: No error state handling on the query.** Tied to the double-prefix bug: the `useQuery` hook had no `onError` handler and the component rendered nothing when the query failed. The 404 silently showed as empty state. Even without the prefix bug, any future network failure would look like "no communications" — misleading UX.

![Manual testing note on MR !177 showing the "Not Found" toast and SIRA-263 ticket I created during review](/images/ppl/s2w3-b4-review-mr177-manual-testing.png)

---

## Beyond Reviews: Ticket Follow-Up

While reviewing !177, I noticed the reminders page had filtering needs outside this MR's scope. Rather than scope-creeping the review, I created [SIRA-263](https://linear.app/ppl-sira/issue/SIRA-263) for a dedicated reminders-with-filtering page and mentioned it in the thread so fernanda could pick it up next. Each MR should close its own scope cleanly; adjacent work goes into new tickets, not ballooning reviews.

---

## Review Writing Style

Every review opens with a positive acknowledgment. Every P0/P1 leads with file:line reference in brackets, states the bug, gives a fix snippet. The "a few things i liked" section names specific strengths that should continue — "The route wrappers keep `ClientDetailPage` composable" is different from "good work"; the former tells the author what pattern to repeat.

Review threads are posted as GitLab **discussions** (threaded), not plain comments. Threaded discussions can be resolved independently per issue, so the author can mark items done as they fix them.

---

## Two Altitudes, Two Review Techniques

| Altitude | Found By Reading Code | Found By Running Code |
|----------|----------------------|----------------------|
| Architectural | MR !166: broken SQL join (code reading revealed PostgREST filter semantics) | |
| Architectural | MR !155: raw `fetch()` bypassing auth (code reading spotted wrong import) | |
| Architectural | MR !128: no key whitelist (code reading spotted missing validation) | |
| UI-level | MR !171: hardcoded breadcrumb link (code reading spotted hardcoded path) | |
| UI-level | | MR !177: double `/api` prefix 404 (only visible when navigating the live page) |
| UI-level | | MR !177: empty state vs error state (only visible in the UI) |

Both altitudes matter. Pure static review misses the integration bugs where each piece of code is syntactically fine but their combined behavior is wrong. Pure manual testing misses the structural bugs where the code "looks wrong" to a trained eye but happens to render correctly by accident.

---

## Results

| MR | Author | Review Points | P0 | P1 | Caught Via |
|----|--------|:-------------:|:--:|:--:|-----------|
| !155 CSV import | hl | 14 | 3 | 2 | Code reading |
| !128 settings | hl | 12 | 2 | 3 | Code reading |
| !166 risk scoring | qenthm | 18 | 2 | 6 | Code reading |
| !171 AR Staff read-only | fadhliraihan | 4 | 0 | 4 | Code reading |
| !177 communication history | fernanda | 2 | 2 | 0 | **Manual testing** |
| **Total across 2 weeks** | | **50** | **9** | **15** | |

All five MRs merged after fixes were applied. The MR !177 P0s in particular would have been a user-visible regression (empty UI with no data) that was invisible to the backend tests passing.

---

## Evidence

- MR !155 — [SIRA-147](https://linear.app/ppl-sira/issue/SIRA-147): hl's CSV import
- MR !128 — [SIRA-179](https://linear.app/ppl-sira/issue/SIRA-179) [SIRA-180](https://linear.app/ppl-sira/issue/SIRA-180): hl's settings management
- MR !166 — [SIRA-218](https://linear.app/ppl-sira/issue/SIRA-218): qenthm's risk scoring engine
- MR !171 — [SIRA-128](https://linear.app/ppl-sira/issue/SIRA-128): fadhliraihan's AR Staff read-only
- MR !177 — [SIRA-182](https://linear.app/ppl-sira/issue/SIRA-182): fernanda's communication history
- [SIRA-263](https://linear.app/ppl-sira/issue/SIRA-263) — ticket created during review for follow-up work
