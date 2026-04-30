---
title: "[S1, W3] PPL: Security"
date: 2026-03-13
description: "Hardening JWT algorithm validation against alg:none attacks, fixing ENCRYPTION_KEY leaks in CI, client PII encryption, and automated SAST scanning with Bandit and pnpm audit."
tags: ["ppl", "security", "owasp", "jwt", "encryption"]
slug: s1w3-security
toc: true
---

## What I Worked On

This week addressed four security areas: JWT algorithm validation hardening (reviewed MR !63), encryption key management in CI (MR !68), client PII encryption in the database seeder (reviewed MR !80), and ongoing SAST scanning via the CI pipeline.

## JWT Algorithm Validation: Preventing alg:none Attacks

MR !63 (by adipppp, which I reviewed) hardened the JWT decoding logic against the **alg:none attack**, one of the most well-known JWT vulnerabilities (OWASP A07:2021, Identification and Authentication Failures).

### How the attack works

JWT tokens have a header that specifies the signing algorithm:

```json
{"alg": "HS256", "typ": "JWT"}
```

If the server blindly trusts the `alg` field, an attacker can craft a token with `"alg": "none"` and send it without a signature. A vulnerable server decodes the payload without verification, granting access to any user.

### Before the fix

```python
# Vulnerable: trusts whatever algorithm the token claims
payload = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"])
```

This looks safe because `algorithms=["HS256"]` is specified, but older PyJWT versions had edge cases. The fix made the validation explicit and added support for asymmetric algorithms (ES256) while blocking everything else:

### After the fix

```python
def _decode_jwt(token: str) -> dict[str, object]:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg == "HS256":
        return jwt.decode(
            token, settings.supabase_jwt_secret,
            algorithms=["HS256"], audience="authenticated"
        )

    # Asymmetric: fetch public key from JWKS endpoint
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token, signing_key.key,
        algorithms=["ES256", "ES384", "ES512"],
        audience="authenticated",
    )
```

Key security decisions:
1. **Explicit algorithm whitelist**: only `HS256` and `ES256/384/512` are accepted. Any other `alg` value (including `"none"`) is rejected.
2. **JWKS for asymmetric keys**: instead of hardcoding public keys, the system fetches them from Supabase's JWKS endpoint. This supports key rotation without code changes.
3. **Audience claim validation**: `audience="authenticated"` ensures tokens minted for other purposes can't be used for API access.

## ENCRYPTION_KEY in CI Deploy

MR !68 fixed a security gap in the CI/CD pipeline: the deploy script generated `.env.local` on the production server but omitted `ENCRYPTION_KEY`. This meant:

1. The API started with an empty encryption key
2. Client PII encryption/decryption used `AESGCM(b"")`, which raises `ValueError`
3. Any request touching client data returned a 500

The fix was a one-line addition to the deploy env generation script:

```bash
echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >> .env.local
```

But the root cause was deeper: the `config.py` validator allowed empty strings through:

```python
@validator("encryption_key")
def validate_encryption_key(cls, v: str) -> str:
    if not v:
        return v  # Empty string passes validation!
    ...
```

This was flagged during code review of MR !17 (Sprint 1 Week 2), and the fix ensures the API crashes immediately on startup with a clear error message rather than accepting requests that will fail at runtime.

## Client PII Encryption

MR !80 (by fadhliraihan, which I reviewed and approved) added encryption for client Personally Identifiable Information in the database seeder. Client fields like `pic_email`, `pic_phone`, and `company_name` are encrypted at rest using AES-256-GCM.

The encryption flow:

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt(plaintext: str, key: str) -> str:
    key_bytes = base64.urlsafe_b64decode(key)
    aesgcm = AESGCM(key_bytes)
    nonce = os.urandom(12)  # 96-bit nonce, unique per encryption
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode()
```

This addresses **OWASP A02:2021 (Cryptographic Failures)**: sensitive data must be encrypted at rest, not stored as plaintext. The nonce is prepended to the ciphertext so decryption can extract it without a separate storage mechanism.

## Automated SAST in CI

The `security:sast` CI job (set up in S1W2, MR !38) runs on every pipeline:

```yaml
security:sast:
  stage: quality
  script:
    - cd apps/api
    - uv sync
    - uv run bandit -r src/ --exit-zero
    - cd $CI_PROJECT_DIR
    - pnpm --dir apps/web install --frozen-lockfile
    - pnpm --dir apps/web audit || true
```

Two tools run:

1. **Bandit** (Python): scans for common security issues like `subprocess` calls with `shell=True`, hardcoded passwords, insecure hash algorithms, and SQL injection patterns.
2. **pnpm audit** (Node.js): checks all frontend dependencies against the npm advisory database for known vulnerabilities.

![GitLab CI log showing pnpm audit with "No known vulnerabilities found" and job succeeded](/images/ppl/sast-ci.png)

### OWASP Top 10 coverage this week

| OWASP Category | How Addressed |
|----------------|---------------|
| A02: Cryptographic Failures | AES-256-GCM encryption for client PII, ENCRYPTION_KEY validation |
| A07: Identification & Authentication | JWT alg:none hardening, explicit algorithm whitelist |
| A05: Security Misconfiguration | ENCRYPTION_KEY missing from CI deploy fixed |
| A06: Vulnerable Components | pnpm audit in CI catches known vulnerabilities |
| A08: Software and Data Integrity | Bandit SAST scanning in CI |

## Result

- JWT authentication hardened against alg:none attacks with explicit algorithm whitelist
- ENCRYPTION_KEY leak in CI deploy pipeline fixed
- Client PII encrypted at rest with AES-256-GCM
- Automated SAST (Bandit + pnpm audit) runs on every pipeline
- 5 OWASP Top 10 categories addressed across this week's work

## Evidence

- [MR !63 - SIRA-95 JWT alg:none hardening (reviewed)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/63)
- [MR !68 - ENCRYPTION_KEY CI deploy fix](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/68)
- [MR !80 - SIRA-107 client PII encryption (reviewed)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/80)
- [MR !38 - SIRA-71 SAST CI job (from S1W2, active this week)](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/38)
- Source: `apps/api/src/app/dependencies.py`, `apps/api/src/app/lib/encryption.py`, `.gitlab-ci.yml` (security:sast)
