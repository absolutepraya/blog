---
title: "PPL: Fixing a JWT Vulnerability [Sprint 2, Week 1]"
date: 2026-03-23
description: "SonarQube flagged a CRITICAL JWT vulnerability, we refactored the auth flow to eliminate unverified header reading, and enforced security scanning as a blocking CI gate."
tags: ["ppl", "security", "jwt", "sonarqube", "bandit"]
slug: s2w1-security
toc: true
---

## What I Worked On

This week I addressed a critical security vulnerability flagged by SonarQube and hardened the CI pipeline so security issues block merges instead of being silently reported.

## The JWT Vulnerability (SonarQube S5659)

SonarQube flagged `dependencies.py:34` as a **CRITICAL vulnerability**: `jwt.get_unverified_header()` reads the JWT header without verifying the signature. This enables the **alg:none attack**, where an attacker crafts a token with `"alg": "none"` in the header, causing the library to skip signature verification entirely.

### Before (Vulnerable)

The original code called `jwt.get_unverified_header()` to determine the algorithm before decoding. This is a known anti-pattern because the header is attacker-controlled.

### After (Fixed)

I refactored to try HS256 decode first and fall back to asymmetric algorithms on `DecodeError`. This eliminates the unverified header call entirely:

```python
# Try HS256 (symmetric) first
try:
    payload = jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
except jwt.DecodeError:
    # Fall back to asymmetric (RS256, ES256)
    payload = jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["RS256", "ES256"],
        options={"verify_aud": False},
    )
```

The explicit `algorithms=` parameter prevents the alg:none attack. PyJWT only accepts the listed algorithms.

## Security Scanning Enforcement

Previously, both `security:sast` (GitLab SAST) and `sonar-scan` had `allow_failure: true`. Security findings were logged but never blocked merges.

Changes:
- Removed `allow_failure` from both jobs
- Changed `npm audit || true` to `npm audit --audit-level=critical` (only block on critical)
- Removed `--exit-zero` from Bandit, excluded test and seed files from scan
- All security hotspots now require explicit review in SonarQube before merge

## Security Hotspot Review

SonarQube flagged 1 security hotspot: `Math.random()` usage in `sidebar.tsx`. After review, this is a false positive: `Math.random()` is used for React UI key generation (non-cryptographic). Marked as REVIEWED/SAFE via the SonarQube API.

Final status: **100% security hotspots reviewed**, quality gate enforced.

## Result

- CRITICAL JWT vulnerability fixed (alg:none attack eliminated)
- Security scanning now blocks merges (no more `allow_failure`)
- 1/1 security hotspots reviewed
- Bandit runs without `--exit-zero` on all API code
- `npm audit` enforced at critical level

## Evidence

- [MR !93 - Enforce quality gates, JWT fix](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/93)
- [MR !94 - Security hotspot review](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/94)
- [Linear SIRA-95](https://linear.app/ppl-sira/issue/SIRA-95) (JWT algorithm vulnerability)
- Source: `apps/api/src/app/dependencies.py`
