---
title: "PPL: Team Dev Management [Sprint 2, Week 3]"
date: 2026-04-08
description: "Code reviews on three major MRs this week covering CSV import, settings management, and ML risk scoring, with 44 total review points including an auth bypass, silent key injection, and a broken SQL join returning all clients' payments."
tags: ["ppl", "code-review", "team-management"]
slug: s2w3-code-review
toc: true
---

## What I Worked On

Three substantial MRs reviewed this week: a CSV import modal (MR !155, hl), a settings management system (MR !128, hl), and an ML risk scoring engine (MR !166, qenthm). Total review points: 44 across P0/P1/P2/P3 severity levels.

---

## MR !155: Shared Import CSV Modal (hl)

The CSV import wizard allows bulk-importing clients, invoices, and payments from CSV files. Multi-step UI with progress indication, error display, and server-side validation. The implementation was well-structured overall, but the review caught several P0 issues that would have shipped a broken feature.

**P0: Raw `fetch()` bypassing the auth client**

The CSV upload request used the browser's native `fetch()` directly instead of the project's auth-aware API client:

```typescript
// P0: fetch() sends no Authorization header — API rejects with 401
const response = await fetch(`${API_URL}/clients/import`, {
    method: "POST",
    body: formData,
})
```

The correct approach is to use the project's `api` client which automatically injects the Supabase JWT token:

```typescript
const response = await api.post("/clients/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
})
```

This is a P0 because the feature would have appeared to work in local dev (auth often permissive) but failed in production for every user.

**P0: FileReader errors silently ignored**

```typescript
reader.onerror = () => {
    // empty — parse proceeds with undefined content
}
```

A corrupted or unreadable file would cause `reader.result` to be `null`, which then gets passed to the CSV parser, which throws an uncaught exception. The fix adds explicit error handling that sets a user-visible error state.

**P0: CSV parse errors uncaught**

The `papaparse` call had no `error` callback. Malformed rows (wrong delimiter, unbalanced quotes) would silently produce `undefined` data that passed validation and reached the server.

**P1 items:** missing header validation (wrong template accepted silently), empty string used as fallback ID for unmatched entities.

---

![MR !155 review thread 1](/images/ppl/s2w3-b4-review-mr155-0.png)

![MR !155 review thread 2](/images/ppl/s2w3-b4-review-mr155-1.png)

![MR !155 review thread 3](/images/ppl/s2w3-b4-review-mr155-2.png)

![MR !155 review thread 4](/images/ppl/s2w3-b4-review-mr155-3.png)

## MR !128: Settings Page Management (hl)

The settings page allows admins to configure system-wide parameters: reminder timing, risk thresholds, email subjects. Backend stores settings as key-value pairs in a `settings` table. Frontend provides a form with validation.

**P0: No key whitelist, any key accepted silently**

The backend `update_settings()` function accepted any key without validation:

```python
# P0: an attacker or a bug could inject unknown keys
async def update_settings(db: Client, updates: dict[str, Any]) -> None:
    for key, value in updates.items():
        await db.table("settings").upsert({"key": key, "value": value}).execute()
```

A bug or crafted request could inject `{"admin_override": True}` or any other key into the settings table, silently persisting garbage data. The fix requires a whitelist:

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

## MR !166: Rule-Based Risk Scoring Engine (qenthm)

The risk scoring engine assigns LOW/MEDIUM/HIGH risk to clients based on payment history. Strategy pattern with pluggable scoring rules. Strong architecture overall, but a database query bug would have produced completely wrong scores for every client.

**P0: Broken cross-table join, all payments returned instead of filtered by client**

The payment history query was structured as:

```python
# P0: missing client_id filter — this returns every payment in the entire system
result = db.table("payments").select("*, invoices(client_id)").execute()
payments = [p for p in result.data if p["invoices"]["client_id"] == client_id]
```

PostgREST does not filter the main table when you filter via a joined table's column. The `select("*, invoices(client_id)")` fetches all payments with their related invoice, but the `client_id` filter in the list comprehension runs in Python on the full dataset. For a system with 10,000 payments across 500 clients, this means loading all 10,000 records into memory to filter to ~20 per client.

The correct approach filters at the query level:

```python
# Fix: filter invoices by client_id at the PostgREST query level
result = (
    db.table("payments")
    .select("*, invoices!inner(client_id)")
    .eq("invoices.client_id", client_id)
    .execute()
)
```

This is a correctness issue too: if the `invoices` join returned `None` for any payment, the Python-side filter would throw a `TypeError`, not a data issue, causing the entire scoring run to fail.

**P0: Bare `except Exception` hiding real errors**

```python
try:
    score = self._calculate_score(features)
except Exception:
    return RiskLevel.LOW  # silent fallback
```

Every uncaught exception, including bugs in the scoring logic itself, silently returns LOW risk. A client who should be HIGH risk (and get a firm reminder) would appear LOW risk and get a polite reminder. The fix re-raises unexpected exceptions and only catches specific, expected failure modes.

**P1: CLAUDE.md architecture violation**

The service called Supabase directly instead of going through the `db/queries/` layer:

```python
# P1: services should not call db directly
result = db.table("payments").select("*").execute()
```

The project's `CLAUDE.md` mandates: "Never call Supabase directly from services — use `db/queries/` layer." Moving the query to a dedicated `db/queries/risk_scoring.py` file keeps the service testable and the data access layer consistent.

![MR !166 review: P0 broken cross-table join returning all payments across all clients](/images/ppl/s2w3-b4-review-mr166.png)

---

## Results

| MR | Author | Issues | P0 | P1 | P2/P3 |
|----|--------|--------|----|----|-------|
| !155 CSV import | hl | 14 | 3 | 2 | 9 |
| !128 settings page | hl | 12 | 2 | 3 | 7 |
| !166 risk scoring | qenthm | 18 | 2 | 6 | 10 |
| **Total** | | **44** | **7** | **11** | **26** |

---

## Evidence

- MR !155 — [SIRA-147](https://linear.app/ppl-sira/issue/SIRA-147): reviewed hl's CSV import implementation
- MR !128 — [SIRA-179](https://linear.app/ppl-sira/issue/SIRA-179) [SIRA-180](https://linear.app/ppl-sira/issue/SIRA-180): reviewed hl's settings page management
- MR !166 — [SIRA-218](https://linear.app/ppl-sira/issue/SIRA-218): reviewed qenthm's risk scoring engine
