---
title: "PPL: Supply Chain Security [Sprint 3, Week 1]"
date: 2026-04-15
description: "An axios SSRF vulnerability (GHSA-3p68-rc4w-qgx5) surfaced in our dependency tree this week. The upgrade was a one-line package.json change, but the interesting part is how the bug works and why our axios usage pattern happens to be the dangerous case."
tags: ["ppl", "security", "supply-chain", "ssrf"]
slug: s3w1-security
toc: true
---

## What I Worked On

This week's security work was a single commit: `2e5bc2fd fix(web): upgrade axios 1.13.5 → 1.15.0 (GHSA-3p68-rc4w-qgx5 SSRF)`. The upgrade itself is trivial, one line in `apps/web/package.json`. The value of this blog is in explaining what the vulnerability is, why it matters for SIRA specifically, and how dependency scanning surfaced it.

---

## The Vulnerability

GHSA-3p68-rc4w-qgx5 is a Server-Side Request Forgery (SSRF) vulnerability in axios versions prior to 1.15.0. The bug sits in how axios handles relative URLs with absolute path components.

The intended behavior when you configure a `baseURL`:

```ts
const api = axios.create({ baseURL: 'https://api.example.com' })
await api.get('/users')          // → GET https://api.example.com/users
await api.get('users')           // → GET https://api.example.com/users
```

The vulnerable behavior was that an absolute URL passed to `api.get()` overrode the `baseURL` silently:

```ts
// Before 1.15.0: if the URL string parses as absolute, baseURL is ignored
await api.get('http://169.254.169.254/latest/meta-data/')
// → actually hit http://169.254.169.254/... on the server running this code
```

If any user-controlled string ever reached `api.get()` as a URL parameter, an attacker could point the request at an internal address (localhost, the AWS metadata endpoint at 169.254.169.254, the Kubernetes metadata service, etc.). The server would happily make the request because from axios's point of view, it is just an absolute URL request. SSRF, achieved through a library that the caller believed was scoped to `baseURL`.

---

## Why Our Codebase Happens to Match the Risk Profile

SIRA uses axios in exactly the pattern the vulnerability targets. The `api` client in `apps/web/src/lib/api.ts` is configured with a `baseURL`:

```ts
const api = axios.create({ baseURL: getApiBaseUrl() })
```

Every hook in the project calls `api.get(url)` or `api.post(url, body)` with `url` as a relative path. The assumption everywhere in the codebase is: "whatever I pass here goes to our own API." That assumption is exactly what SSRF-via-absolute-URL breaks.

To be clear, we do not currently pass user-controlled URL fragments to axios — no user input flows into `api.get(userInput)` anywhere. So this vulnerability does not have an exploitable path in our code today. But the whole point of keeping up with supply chain advisories is not to wait until there IS an exploitable path. A future feature that builds a URL fragment from user input (e.g., proxying a resource by name) would pick up an SSRF vector for free, silently, because the dev writing it would reasonably assume axios respects `baseURL`.

Upgrading now closes the door before anyone walks through it.

---

## How It Surfaced

The pipeline already runs `pnpm audit` as part of the `security:sast` quality stage. Every MR pipeline produces a vulnerability report:

```
axios  <1.15.0
Severity: high
Server-Side Request Forgery in axios - https://github.com/advisories/GHSA-3p68-rc4w-qgx5
Patched in >=1.15.0
fix available via `pnpm update axios --latest`
```

This is the quiet value of having dependency audits wired into CI from the start. The advisory was published, the next MR pipeline flagged it, and the fix was a bump to a minor version. No dedicated effort, no scheduled review, no "security sprint." Just a CI signal during the normal flow.

The alternative — scanning dependencies quarterly or only before release — would have left this sitting in our tree for weeks. The fact that the fix landed on April 10, days after the advisory was published, is a direct function of the per-MR audit loop being in place.

---

## Why a Minor Version Bump Was Safe

Jumping from `1.13.5` to `1.15.0` spans two minor versions. Breaking changes are possible on minor bumps in theory, but axios follows semver strictly, so the upgrade path is one line plus `pnpm install`. No API surface change.

The change in behavior that actually affects callers is:

```ts
// Before 1.15.0
await api.get('http://evil.example.com/leak')
// → request went to http://evil.example.com/leak (baseURL ignored)

// After 1.15.0
await api.get('http://evil.example.com/leak')
// → throws: absolute URL rejected when baseURL is set
```

This means any code that legitimately calls `api.get(someAbsoluteUrl)` will break after the upgrade. I searched the codebase for absolute URLs passed to `api.get` or `api.post` and found none; every call site uses a relative path. So the upgrade was safe to apply directly, no call site changes needed.

The test suite passed after the upgrade. Vitest covers the axios interceptor logic (error handling, 401 → login redirect, toast on non-2xx). All of that is unrelated to the URL parsing change, so the pass confirmed nothing regressed.

---

## What Could Have Gone Wrong

Three failure modes to name:

**Mode 1: Skip the upgrade, assume SSRF is not exploitable in our code today.**
That is true today and will likely not be true forever. A single future feature that builds a URL from user input would suddenly carry this vector. Security fixes on dependencies should not be conditional on "are we vulnerable right now" — they should be applied as they ship, because the code that would become vulnerable has not been written yet.

**Mode 2: Jump to the latest major (2.x if it exists).**
Axios does not currently have a 2.x, but the general principle matters: a security advisory is a reason to upgrade to the minimum patched version, not to rush a major jump. Major version upgrades come with their own risk profile (breaking changes, API rewrites, new bugs). Separate concerns: patch the CVE, then evaluate major upgrades on a separate schedule.

**Mode 3: Pin axios to 1.15.0 exactly.**
I kept the caret range (`^1.15.0`). Patching future security issues within the 1.x line should continue to flow in via `pnpm update`. Pinning exact versions makes every CVE fix require a manual PR instead of an auto-bump, which creates latency between advisory and deploy.

---

## Results

| Change | Before | After |
|--------|--------|-------|
| Axios version | `^1.7.9` (resolves to 1.13.5) | `^1.15.0` |
| pnpm audit high-severity findings | 1 (GHSA-3p68-rc4w-qgx5) | 0 |
| Exploitability in current code | None (no user-controlled URLs reach `api.get`) | None |
| Exploitability for future code | Open by default | Closed by default |

The absence of an exploitable path today is not the point. The point is that when a future feature introduces a URL fragment from user input, it will pick up a hardened axios rather than an SSRF-prone one.

---

## Evidence

- Commit `2e5bc2fd` — fix(web): upgrade axios 1.13.5 → 1.15.0 (GHSA-3p68-rc4w-qgx5 SSRF)
- Advisory: [GHSA-3p68-rc4w-qgx5](https://github.com/advisories/GHSA-3p68-rc4w-qgx5) (axios SSRF)
- Source: `apps/web/package.json`, `apps/web/pnpm-lock.yaml`, `apps/web/src/lib/api.ts`
- CI: `security:sast` job in `.gitlab-ci.yml` running `pnpm audit`
