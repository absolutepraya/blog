---
title: "PPL: Security Reviews and a Test-Mode Guard [Sprint 3, Week 2]"
date: 2026-04-29
description: "Caught three security issues in teammates' MRs (PII leak via public PDFs, RLS-bypassing service-role uploads, PII leak via Sentry default capture), and added an environment-aware guard preventing the Telegram bot from sending live messages from CI."
tags: ["ppl", "security"]
slug: "s3w2-security"
toc: true
---

## What I Worked On

Two threads to security work this week. The first is review-driven: three teammate MRs each had a security issue that would have shipped if I had just rubber-stamped the diff. Each one was a different class of bug worth thinking about. The second is a small fix of my own, MR !234, which prevents the Telegram bot from sending real messages when the API runs in test mode (CI included).

## Three Classes of Security Bug, One Per MR

The reviews are covered in detail in the code-review blog. Here I want to look at them through a security lens because each represents a different class of vulnerability that future reviewers should know to watch for.

### Class 1: Confidentiality leak via public storage URLs (!218)

MR !218 (Invoice PDF Generator) used `bucket.get_public_url()` and never marked the bucket private. Each PDF embeds NPWP (Indonesian tax ID, regulated PII) and amounts. Invoice UUIDs are guessable in the sense that there is no rate-limit-aware authorization between the URL and the file: anyone holding a valid invoice ID can pull the PDF without authenticating.

The fix is dual: mark the bucket private (in the migration), and switch to `create_signed_url(...)` with a TTL. The signed URL gets minted on read, never persisted. This pattern is repeated in !220 (auto-generate PDF) for the same reason, with the additional twist that the signed URL was being persisted to the row, breaking after 1 hour.

The watch-out for future reviewers: any MR that introduces a new Storage bucket should explicitly answer the question "what is the access control model?" in the migration. If the answer is "public", the migration should say so on a comment line. If it is "private with signed URLs", the service that mints the URLs should be visible in the same MR. A bucket without an answered access-control question is a P0.

![Review thread on MR !218 showing the public-PDF NPWP/PII finding and the swallowed upload-error P0](/images/ppl/s3w2-b6-mr218-pii-review.png)

### Class 2: Authorization theater via RLS that does not apply (!203)

MR !203 (Payment Proof Storage Setup) defined RLS policies on the storage bucket and table:

```sql
CREATE POLICY "users can insert proofs they own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment_proofs' AND
  EXISTS (
    SELECT 1 FROM payment_versions pv
    WHERE pv.created_by = auth.uid()
      AND ...
  )
);
```

The policies look strict. But the API uploads via the service-role Supabase client (`self.db.storage`). service-role bypasses RLS entirely. So the policy is decorative for the current upload path; the real authorization happens in `PaymentService.upload_proof`'s ownership check, which is implemented in Python.

This is dangerous not because the current path is insecure (the service-layer check works) but because it is *deceptively secure*. A future contributor reading the migration will assume the database is enforcing access. If they later refactor the upload path to use the user's JWT (a perfectly reasonable change to support direct browser uploads), they will skip adding an equivalent service-layer check, assuming RLS already covers it. The result would be a real authorization bug introduced by an "innocuous refactor".

The fix is documentation, not code: a 4-line comment in the migration noting that the policy is advisory under the current architecture, and what to verify when changing the upload path. A separate ownership query also got fixed (matching `payment_versions.created_by` was matching anyone who ever edited, not the owner; the fix scoped to `version_number = 1`).

The watch-out for future reviewers: any MR that adds RLS policies should be checked against the actual upload path. If uploads go through service-role, the RLS is theater and needs a comment saying so.

### Class 3: PII leakage via default monitoring capture (!217)

MR !217 (advanced platform monitoring) added Sentry user identity tagging across the API. Sentry's `send_default_pii=False` flag was already set in the existing init, so HTTP request headers and bodies are not auto-captured. But the new user-identity code adds explicit `sentry_sdk.set_user({...})` calls.

The MR sets `id` (UUID) and `email_domain` (the part after `@`), not the full email. That's the right call because email domain is enough for analytics aggregation but not enough to identify a specific user in the error feed. I confirmed this on the review by tracing each `set_user(...)` call against the schema for what gets sent to GlitchTip.

A separate concern in the same MR was the `capture_message` for HIGH risk + score>80. That message includes a templated string with the client name. On normal operation, dozens of HIGH-risk clients per scoring run would each generate a Sentry message with their name attached. That is a slow PII leak into the monitoring system: client names accumulate in GlitchTip indexed by Sentry issue, queryable by anyone with monitoring access.

The fix was to drop the `capture_message` entirely and let the `risk.probability_score` measurement be aggregated by an alert rule instead. Aggregations don't include client names, just counts.

The watch-out for future reviewers: every `capture_message` and `capture_exception` should be checked against what data lands in the message body. Any string interpolation with user data (name, email, phone, address) is a leak; sanitize to IDs only.

## My Own Fix: Test-Mode Guard for Telegram (MR !234)

The Telegram bot runs against the live Telegram API (`api.telegram.org`). Without a guard, any test that touches `TelegramService` would call the real API on every CI run. There are three risks: rate-limit burn (Telegram caps at 30 messages/sec per bot), spam in the test bot's chat history (every CI run drops a message into the dev group), and accidental message delivery to clients if a test ever uses production chat IDs.

The fix is a small environment-aware guard:

```python
class TelegramService:
    def test_connection(self) -> dict:
        env = os.environ.get("ENVIRONMENT", "").lower()
        if env in {"test", "testing"}:
            return {"skipped": True, "reason": "test environment"}
        # ... real API call ...

    def _send_actual(self, chat_id: int, text: str, ...) -> dict:
        env = os.environ.get("ENVIRONMENT", "").lower()
        if env in {"test", "testing"}:
            # short-circuit, don't even build the request
            return {"skipped": True, "reason": "test environment"}
        # ... real API call ...
```

Two design notes worth mentioning. First, the guard is at the **service** layer, not the **dispatcher** layer. The dispatcher already has toggle checks (configured by admins through the UI), but those toggles can be flipped on in test environments. The service-layer guard is the last line: even if a toggle is on, the service refuses to make a real API call when `ENVIRONMENT=test`.

Second, there is an **explicit opt-in** for cases where you want to actually verify against the live Telegram API (a developer running a smoke test before deploying):

```python
if env in {"test", "testing"}:
    if os.environ.get("CONFIRM_LIVE_TELEGRAM_TEST") != "1":
        return {"skipped": True, "reason": "test environment"}
    # Explicit opt-in. The developer has confirmed they want to send a real message.
```

This was driven by red-first TDD: the test that covered the opt-in (`test_live_e2e_runs_when_explicitly_confirmed`) was written before the implementation, which forced me to commit to the exact env var name and the value (`"1"`, not `"true"`, to be unambiguous). The TDD blog this week has the full pair walkthrough.

CI runs with `ENVIRONMENT=test`, so all integration tests now skip Telegram entirely. The dev group's chat history stopped getting CI noise. Local developers wanting to E2E-test set both env vars deliberately.

## Linking the Two Threads

Reviewing teammates' security issues and writing a guard for my own feature feel like different activities, but they share a common shape: **you cannot rely on the obvious code path to enforce security**. The PDF service was correct (`create_signed_url(...)` does what it says), but the row outlived the URL. The RLS policy was correct, but service-role bypassed it. The Sentry init was correct, but `capture_message` re-introduced the leak. The Telegram dispatcher checks toggles, but a toggle could be on in test mode.

In every case, the fix is a defensive layer below the obvious one: signed URLs minted on read, service-layer ownership checks, no per-event capture, environment guard at the service layer. Layered defenses, each one cheap, none of them sufficient on their own.

## Evidence

- [MR !234 SIRA-306 fix(api): prevent Telegram test notifications](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/234) — squash `a90e0aa8`
- Reviews with security findings: [!218](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/218), [!220](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/220), [!203](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/203), [!217](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/217)
- Source: `apps/api/src/app/services/telegram_service.py` (235 lines, env guards at lines 47 and 89)
- Pre-squash red/green pairs for the guard: `b2b06fdb` / `47941303`, `6bd1d046` / `86359687`
- Direct commit `88697bdd` — `chore(security): remove SonarQube MCP and load token from .env.local` (removed a hardcoded auth token from shared config)
