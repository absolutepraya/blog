---
title: "[S4, W1] PPL: Supply-Chain Response and RBAC Hardening"
date: 2026-05-13
description: "Within 24 hours of the TanStack npm supply-chain attack hitting Snyk's blog, pinned every dep in both apps and added a 1440-minute install cooldown via .npmrc. Plus a 437-line RBAC integration test suite enforcing capability boundaries between AR_STAFF and admin."
tags: ["ppl", "security"]
slug: "s4w1-security"
toc: true
---

## What I Worked On

Two security MRs this week. MR !299 (SIRA-365) was a fast response to the TanStack npm supply-chain attack: pin every dependency to an exact version and add `minimum-release-age=1440` to both `.npmrc` files. MR !300 (SIRA-364) is the bigger structural one: RBAC expansion that grants AR_STAFF a narrow set of new capabilities while hardening the admin-only boundary with a 437-line integration test suite and a 134-line role matrix doc that becomes the single source of truth.

## The "Mini Shai-Hulud" Incident and Why We Responded Fast

On May 11-12, 2026, [Snyk's blog](https://snyk.io/blog/tanstack-npm-packages-compromised/) reported what Socket Security publicly named the **Mini Shai-Hulud** worm: 84 malicious npm package versions across 42 packages in the `@tanstack` namespace (plus `@equawk/*`, `@instralai/*`, and others), with suspected CI credential-stealing payload. The original Shai-Hulud worm from late 2025 set the template; this was a smaller but technically similar variant. Socket flagged every malicious version within six minutes of publication.

![Socket Security tweet "BREAKING: 84 TanStack npm packages were compromised in an ongoing Mini Shai-Hulud supply chain attack, adding suspected CI credential-stealing malware" with a screenshot of the @tanstack/react-router page on socket.dev showing a red "Known malware" banner above the package summary](/images/ppl/s4w1-b6-shai-hulud-socket.png)

The attack vector chained three vulnerabilities:

1. A misconfigured GitHub Actions workflow (`pull_request_target` with fork-controlled code) let a malicious PR run with elevated privileges.
2. The malicious code poisoned the pnpm package cache with a key matching the legitimate release workflow's later retrieval.
3. The attacker extracted OIDC tokens from GitHub Actions' memory and published packages with valid SLSA Build Level 3 provenance.

The key innovation: **SLSA verified the build process correctly because the attacker hijacked the legitimate build pipeline itself**. Provenance verification was necessary but not sufficient.

Our app uses `@tanstack/react-router` and `@tanstack/react-query` directly. If we had run `pnpm install` on the wrong day, the lockfile could have pulled a malicious version that subsequently leaked credentials from our dev machines and CI runners. We dodged the bullet because we hadn't installed any new packages in the relevant window, but the structural fix had to land regardless.

## Team Decision in Discord, Then the MR

I posted to the team's `#dev` channel the same morning the news broke, with the Snyk article and an "im pinning version lah, takut" message attached:

![Discord #dev channel screenshot: user "praya" message at 00:39 "alhamdulillah bro" followed by a link to snyk.io/blog/tanstack-npm-packages-compromised/, then a second message "and btw im pinning version lah, takut (edited)" with the linked article preview rendering inline showing the headline "TanStack npm Packages Hit by Mini Shai-Hulud | Snyk" and a brief description of the worm](/images/ppl/s4w1-b6-discord-snyk-announcement.png)

The full thread continued:

> punya kita ga ke pin, masih pake `^...`
>
> lemme handle
>
> jadi best practice nya sekarang tuh karena banyak supply chain attack, itu harus pin version packages, semuanya
>
> jangan pake `^`, or `latest`, or `>=`, or whatever

The team's reaction in the same channel was "alhamdulillah bro" plus a "untung bukan kita yang kena" from another teammate. The point of this paragraph is not the chat itself; it's that the policy decision (no more `^`, no more `latest`, pin everything) was made and communicated to the team within minutes of reading the Snyk article, then the MR landed about an hour later. Communication first, then code, then merge. That's the response cadence I want for future supply-chain incidents.

## Before and After: What Pinning Actually Means

The clearest way to show what changed in MR !299 is to look at the same dependency block before and after. Take a sample slice of `apps/api/pyproject.toml`:

```toml
# BEFORE: caret/tilde/inequality ranges — npm and pnpm are free to pick a newer
# minor or patch on any install. A maliciously published 0.116.5 would have
# matched ">=0.116.0" and gotten installed silently.
dependencies = [
    "fastapi>=0.116.0",
    "pydantic>=2.10",
    "supabase~=2.28",
    "httpx>=0.27",
    "cryptography>=44.0",
]
```

```toml
# AFTER: every dep pinned to the exact version the lockfile resolved. The only
# way a different version lands now is a deliberate human PR that updates
# pyproject.toml AND regenerates uv.lock together.
dependencies = [
    "fastapi==0.128.7",
    "pydantic==2.12.5",
    "supabase==2.28.0",
    "httpx==0.28.1",
    "cryptography==46.0.5",
]
```

And the corresponding slice of `apps/web/package.json`:

```json
// BEFORE: caret prefixes everywhere. pnpm install reaches out to the npm
// registry and picks the latest compatible minor on every fresh install.
{
  "dependencies": {
    "@tanstack/react-router": "^1.123.0",
    "@tanstack/react-query": "^5.91.0",
    "react": "^19.2.0",
    "vite": "^6.4.0",
    "@supabase/supabase-js": "^2.83.0"
  }
}
```

```json
// AFTER: exact versions. Plus pnpm.overrides for transitive deps that needed
// CVE patches the upstream packages hadn't yet bumped to.
{
  "dependencies": {
    "@tanstack/react-router": "1.123.5",
    "@tanstack/react-query": "5.91.7",
    "react": "19.2.0",
    "vite": "6.4.2",
    "@supabase/supabase-js": "2.83.0"
  },
  "pnpm": {
    "overrides": {
      "rollup": ">=4.59.0",
      "esbuild": ">=0.25.0",
      "undici": ">=7.24.0",
      "vite": ">=6.4.2",
      "fast-uri": ">=3.1.2"
    }
  }
}
```

The diff is mechanical but the effect is structural. In the BEFORE world, `pnpm install` is a function of (manifest + npm registry state at install time). Two developers running `pnpm install` on different days against the same manifest can end up with different node_modules. In the AFTER world, `pnpm install` is a function of the manifest alone. Same manifest, same install, same packages. Reproducibility is no longer "we hope the lockfile catches it"; it's a property of the manifest.

The `pnpm.overrides` block is the second layer. Some transitive deps had open CVEs but their parent packages hadn't published a patch bump yet. The override forces pnpm to resolve those transitives to a known-good version regardless of what the parent wants. `rollup>=4.59.0`, `esbuild>=0.25.0`, and `vite>=6.4.2` all carry recent CVE patches.

## SIRA-365: Pin All Deps + 24-Hour Cooldown

Two structural changes shipped in MR !299:

**1. Pin every dep to an exact version.** The diff stat tells the story:

```
apps/api/pyproject.toml |  74 ++++-----
apps/api/uv.lock        |  70 +++----
apps/web/package.json   | 102 ++++++-------
apps/web/pnpm-lock.yaml | 384 ++++++++--------------
```

The codeblock pair above ("Before and After: What Pinning Actually Means") shows the shape of the change. The lockfile is still authoritative, but the manifest now agrees with the lockfile, so a developer running `pnpm install` against a fresh checkout can't accidentally pull a newer minor that the lockfile resolver decided was compatible.

**2. Install cooldown via `minimum-release-age`.** This is the structural protection. Both `.npmrc` files now contain:

```ini
# Supply-chain hardening: refuse to install any package version younger
# than 24 hours (1440 minutes). Buys time for the npm registry / community
# to detect and unpublish malicious releases (TanStack-style incident,
# GHSA-g7cv-rxg3-hmpx). Requires pnpm >= 10.16 (we use 10.18.0 via the
# packageManager field). Mirrored in apps/web/.npmrc because apps/web
# has its own pnpm-lock.yaml and is not part of a pnpm workspace.
minimum-release-age=1440
```

pnpm 10.16+ honors this flag and refuses to install any package version published less than 1440 minutes (24 hours) ago. The mechanism is simple: when resolving a version, pnpm checks the npm registry's publish timestamp. If the version is too new, the install fails with a clear error.

Why 24 hours? The Snyk blog observes: "A seven-day cooldown would have fully protected against this specific attack." Seven days is the safer setting but it's also enough latency to slow down legitimate security patches. 24 hours is a reasonable compromise: long enough that an attack publishing a malicious version on Monday morning will be caught and unpublished by Tuesday morning (when the npm and security communities are actively triaging), but short enough that legitimate patches reach us within a working day.

Mirrored in two `.npmrc` files because `apps/web/` has its own `pnpm-lock.yaml` (not part of a pnpm workspace). Without mirroring, the web app would have ignored the root setting.

**3. Pinned third-party overrides.** `apps/web/package.json` also got an `overrides` section to pin specific transitive dependencies that had open CVEs:

```json
"pnpm": {
  "overrides": {
    "rollup": ">=4.59.0",
    "esbuild": ">=0.25.0",
    "undici": ">=7.24.0",
    "picomatch@<3": "^2.3.2",
    "picomatch@>=4": "^4.0.4",
    "smol-toml": ">=1.6.1",
    "brace-expansion@<3": "^2.0.3",
    "brace-expansion@>=5": "^5.0.5",
    "vite": ">=6.4.2",
    "fast-uri": ">=3.1.2"
  }
}
```

These overrides force the resolver to pick versions that have patches for known CVEs even when an upstream package hasn't yet bumped its dep. The `picomatch@<3` and `picomatch@>=4` notation is a pnpm-specific feature: it lets you target specific version ranges of the same package separately, which we need because two different parts of the dep tree pull different picomatch majors.

## Cost of the Cooldown

A 24-hour cooldown means we can't immediately install a freshly-published package. In practice this is fine for two reasons:

- For app deps, we don't usually need a brand-new version the day it lands. Most upgrades wait at least a sprint anyway.
- For emergency patches (rare), the cooldown can be bypassed per-install with `pnpm install --no-min-release-age`. It's an opt-in escape hatch when we know what we're doing.

The cost we accept: a couple of percent of installs will fail with "version too new" until 24 hours pass. We've not seen this in practice yet because we don't update deps that aggressively, but the team knows the flag exists.

## SIRA-364: RBAC Expansion + 437 Test Lines

The other security MR this week. The motivation: AR_STAFF (accounts receivable staff role) was over-restricted on some legitimate workflows (create a client, dismiss a duplicate pair) and under-restricted on others (edit financial fields on an invoice that has payments already, edit legal client fields). MR !300 tightens the boundary in both directions.

The structural pieces:

1. **A capability matrix doc**: `docs/rbac-role-matrix.md` (134 lines). Every domain action sits in one of three buckets: 🆓 Free (role acts directly), 🔐 Approval-required (staff submits a request, admin approves), 🛡️ Admin-only-forever. The doc lists every endpoint with its bucket and the reason for the bucket choice.
2. **An integration test suite**: `apps/api/tests/test_rbac_expansion_integration.py` (437 lines). Each capability boundary is pinned by a test that seeds a real database row, posts a request with each role, and asserts the right rejection status.
3. **Role constants**: `apps/api/src/app/dependencies.py` now exports `ROLE_ADMIN` and `ROLE_AR_STAFF` as constants. Every gate references them by name.

A sample test from `test_rbac_expansion_integration.py`:

```python
def test_ar_staff_cannot_edit_invoice_financial_fields_when_partial(
    test_client: TestClient,
    ar_staff_token: str,
    real_db: Client,
) -> None:
    """AR_STAFF must not change amount/due_date on PARTIAL invoices (SIRA-364)."""
    client_id = _seed_client(real_db, company_name="Test Corp")
    invoice_id = _seed_invoice(real_db, client_id, amount=1_000_000, status="UNPAID")
    _seed_payment(real_db, invoice_id, amount=500_000)  # Transitions to PARTIAL

    response = test_client.put(
        f"/api/invoices/{invoice_id}",
        headers={"Authorization": f"Bearer {ar_staff_token}"},
        json={"amount": 2_000_000},  # Attempt to change financial field on PARTIAL
    )

    assert response.status_code == 403
    assert "PARTIAL" in response.json()["detail"]
```

The test seeds a real client + invoice + payment to transition the invoice to PARTIAL status, then asserts that AR_STAFF gets 403 when trying to change `amount`. It also asserts that the error message mentions PARTIAL, which is the customer-facing signal that explains why the edit is rejected.

437 lines of tests like this cover: AR_STAFF's newly-granted capabilities, the field-allowlist on `PUT /clients/{id}` (contact fields allowed, legal fields rejected), the invoice service's PARTIAL hardening, and regression tests that admin-only routes still reject AR_STAFF.

## Defense in Depth: Both Layers Matter

The two MRs hit different layers of the threat model:

- **MR !299 (supply chain)**: defends against malicious dependencies. The attack vector is "an attacker compromises a package we depend on, transitively or directly." Mitigation: pin versions, cooldown installs, override known-CVE transitives.
- **MR !300 (authorization)**: defends against role-escalation within our own app. The attack vector is "a legitimate user (AR_STAFF) tries to do something only an admin should be allowed to." Mitigation: tight gates with named constants, integration tests pinning the boundary, a doc that becomes the single source of truth.

A real attacker would chain both layers. Compromise a TanStack dep → exfiltrate our admin's session token → impersonate admin to access AR data. Hardening one without the other leaves the chain intact. This week's work tightened both.

## What I Learned

Three patterns from this week:

**Supply-chain responses have to be structural, not vigilance-based.** Pinning every version and adding a cooldown took maybe two hours. It's the kind of fix that defends against the next attack we don't know about yet. Vigilance ("check the news every day") doesn't scale.

**Role expansion needs more test coverage than role restriction.** When SIRA-364 *granted* AR_STAFF new capabilities, the test count went up because every newly-granted capability needs a test that AR_STAFF can do it AND that AR_STAFF still can't do the adjacent admin thing. Tightening one boundary often loosens an adjacent one if you're not careful.

**A capability matrix doc beats reading gates from code.** When a teammate asks "can AR_STAFF dismiss a duplicate pair?" the answer used to require grepping for `require_admin` calls. Now it's a doc page. The doc is in git, gets reviewed when capabilities change, and is the canonical reference for cross-team conversations.

## Evidence

- [MR !299 SIRA-365 pin all deps + add 24h install cooldown](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/299): response to GHSA-g7cv-rxg3-hmpx (TanStack incident)
- [MR !300 SIRA-364 RBAC expansion & hardening](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/300): role matrix doc + integration tests + role constants
- Source: supply-chain hardening: `apps/web/.npmrc`, `.npmrc` (both contain `minimum-release-age=1440`)
- Source: pinned manifests: `apps/api/pyproject.toml` (every dep `==`), `apps/web/package.json` (every dep exact + 10 transitive overrides)
- Source: RBAC test suite: `apps/api/tests/test_rbac_expansion_integration.py` (437 lines)
- Source: RBAC role matrix doc: `docs/rbac-role-matrix.md` (134 lines)
- Source: role constants: `apps/api/src/app/dependencies.py`
- External reference: [Snyk: TanStack npm Packages Compromised (2026-05-11)](https://snyk.io/blog/tanstack-npm-packages-compromised/)
- Team announcements: Discord `#dev` 2026-05-12 05:19 (policy statement on pinning), `#codebase-update` 2026-05-12 05:10 (Snyk link + decision to pin)
- Incident severity reference: Socket Security tweet on the Mini Shai-Hulud worm (84 compromised package versions, CI credential-stealing payload)
