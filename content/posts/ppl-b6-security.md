---
title: "PPL: Secure Programming - OWASP Coverage and CI Security Scanning"
date: 2026-03-05
description: "Five OWASP Top 10 categories addressed through JWT auth, RBAC, RLS, Pydantic validation, and CORS hardening — plus a security:sast CI job with Bandit and pnpm audit."
tags: ["ppl", "security", "owasp", "ci", "sast", "fastapi"]
toc: true
---

## Security Implementation — OWASP Coverage

Five of the OWASP Top 10 are addressed by design across the stack.

### A01 — Broken Access Control

**Backend:** `require_admin` FastAPI dependency chains on `get_current_user` without modifying it. Adding a new role = new function, zero changes to existing code (OCP):

```python
async def require_admin(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

**Frontend:** TanStack Router `beforeLoad` checks `isAuthenticated` and `role` before rendering any protected route. Unauthenticated users are redirected to `/login` at the router level, not just hidden in the UI.

**Database:** Row-Level Security on `app_users`:

```sql
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
-- Users can only read their own profile
-- Admins can read and modify all
```

Source: `supabase/migrations/20260302100000_app_users_rls_and_fk.sql`

### A02 — Cryptographic Failures

JWT verification supports both HS256 (legacy) and asymmetric algorithms (ES256 via JWKS) in `apps/api/src/app/dependencies.py`. The algorithm is read from the token header — no hardcoded assumption:

```python
def _decode_jwt(token: str) -> dict[str, object]:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")
    if alg == "HS256":
        return jwt.decode(token, settings.supabase_jwt_secret,
                          algorithms=["HS256"], audience="authenticated")
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(token, signing_key.key, algorithms=[alg], audience="authenticated")
```

HTTPS enforced in production. `send_default_pii=False` in Sentry init prevents tokens from leaking into error reports.

### A03 — Injection

All API input validated through Pydantic models before reaching the database:

```python
class PaymentCreate(BaseModel):
    amount_paid: float = Field(gt=0)   # rejects zero and negative
    payment_date: date
```

No raw SQL anywhere — all queries use the Supabase Python client's parameterized builder. No string concatenation in query construction.

### A05 — Security Misconfiguration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # explicit list, never "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

All secrets in `.env.local`, never committed. CI/CD injects from GitLab CI Variables at deploy time. `.env.example` uses placeholder values only.

### A07 — Authentication Failures

JWT is decoded and verified locally on every request (no network round-trip to Supabase Auth). Invalid tokens raise `PyJWTError` → 401. Token expiry is enforced by the JWT `exp` claim.

Frontend Axios interceptor handles 401 responses by calling `supabase.auth.signOut()` + redirecting to `/login` — prevents infinite-loop token refresh cycles.

Email fallback (SIRA-69): if `auth_user_id` is missing from `app_users`, match by email and auto-link on first login. This handles users who signed up before the linkage field existed.

**5 OWASP categories covered: A01, A02, A03, A05, A07.**

---

## Why Security Scanning

The CI pipeline had full coverage for code quality (lint, typecheck, tests, SonarQube) but no security layer. [SIRA-71](https://linear.app/ppl-sira/issue/SIRA-71) added a `security:sast` job to close this gap.

Two tools, covering two distinct threat surfaces:

| Tool | Target | What it finds |
|------|--------|---------------|
| [Bandit](https://bandit.readthedocs.io) | Python source (`apps/api/src/`) | CWE-mapped security issues: SQL injection, subprocess injection, hardcoded secrets, weak crypto |
| [pnpm audit](https://docs.npmjs.com/cli/commands/npm-audit) | Frontend dependencies (`apps/web/`) | Known CVEs in installed packages (npm advisory database) |

## CI Job

Added to the `quality` stage in `.gitlab-ci.yml`, parallel to `sonar-scan`:

```yaml
security:sast:
  stage: quality
  script:
    - cd apps/api && uv sync
    - cd apps/api && uv run bandit -r src/ --exit-zero
    - pnpm --dir apps/web install --frozen-lockfile
    - pnpm --dir apps/web audit || true
  allow_failure: true
```

`--exit-zero` and `|| true` make findings non-blocking. The job always runs and its output is visible in the pipeline log — findings are reviewed, not silently ignored.

## Scan Results

### Bandit — Python SAST

```
Run started: 2026-03-04

Test results:
    No issues identified.

Code scanned:
    Total lines of code: 656
    Total lines skipped (#nosec): 0

Run metrics:
    Total issues (by severity):
        Low: 0 / Medium: 0 / High: 0
```

Zero findings across 656 lines. The clean result reflects the architecture:
- No subprocess calls in production code
- No hardcoded credentials — all secrets via Pydantic Settings from env vars
- JWT decoded with `PyJWT` + `PyJWKClient` (secure key handling)
- No raw SQL — all DB access via Supabase Python client

### pnpm audit — Frontend Dependencies

Before the scan, two CVEs were present:

| Severity | Package | CVE | Path |
|----------|---------|-----|------|
| High | `rollup` 4.57.1 | [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) | `vite > rollup` |
| Moderate | `esbuild` ≤0.24.2 | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | `vitest > vite > esbuild` |

**Rollup**: Arbitrary file write via path traversal — an attacker controlling build input could escape the output directory. Patched in ≥4.59.0.

**esbuild**: Dev server CORS bypass — any website could make requests to the local esbuild dev server and read responses. Dev-only, not a production risk, but patched in ≥0.25.0.

Both are transitive dependencies of `vite`/`vitest`, not directly declared in `package.json`. The fix: `pnpm.overrides` in `apps/web/package.json` to force patched versions without upgrading vite:

```json
"pnpm": {
  "overrides": {
    "rollup": ">=4.59.0",
    "esbuild": ">=0.25.0"
  }
}
```

After `pnpm install`:

```
No known vulnerabilities found
```

## Evidence

- [MR !38 - SIRA-71 security SAST CI job](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/38)
- [Linear SIRA-71](https://linear.app/ppl-sira/issue/SIRA-71)
- Source: `.gitlab-ci.yml`, `apps/api/pyproject.toml`, `apps/web/package.json`
