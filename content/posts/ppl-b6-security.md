---
title: "PPL: Security Scanning in CI - Bandit + pnpm audit"
date: 2026-03-05
description: "Adding a security:sast CI job with Bandit for Python SAST and pnpm audit for dependency CVE scanning. Two real vulnerabilities found and remediated."
tags: ["ppl", "security", "ci", "sast", "devops"]
toc: true
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
