---
title: "PPL: Static Analysis in SIRA - Biome, Ruff, mypy, and SonarQube"
date: 2026-03-04
description: "The complete static analysis stack for Smart Invoice Reminder AI: Biome, Ruff, mypy, Knip, Husky pre-commit hooks, and SonarQube integrated into GitLab CI."
tags: ["ppl", "code-quality", "sonarqube", "ci", "devops"]
toc: true
---

## The Tool Stack

| Layer | Tool | Scope |
|-------|------|-------|
| Frontend lint + format | [Biome](https://biomejs.dev) | TypeScript/TSX, 40+ enforced rules |
| Frontend dead code | [Knip](https://knip.dev) | Unused exports, imports, dependencies |
| Frontend types | `tsc --noEmit` | TypeScript type checking |
| Backend lint + format | [Ruff](https://docs.astral.sh/ruff/) | Python, F401/F841 + style rules |
| Backend types | [mypy](https://mypy.readthedocs.io) | Python static types, strict mode |
| CI quality gate | [SonarQube](https://sonarqube.cs.ui.ac.id) | Coverage, code smells, security hotspots |

## Pre-commit Hooks (Husky)

Five checks run sequentially on every `git commit`. A failure at any step blocks the commit:

```mermaid
flowchart LR
    C([git commit]) --> B[Biome\nlint + format]
    B --> R[Ruff\nlint + format]
    R --> T[tsc\ntypecheck]
    T --> M[mypy\ntypecheck]
    M --> K[Knip\ndead code]
    K --> OK([commit accepted])

    B -->|fail| X([blocked])
    R -->|fail| X
    T -->|fail| X
    M -->|fail| X
    K -->|fail| X
```

`git push` additionally runs the full test suite (vitest + pytest).

Source: `.husky/pre-commit`, `.husky/pre-push`

## Key Rules Enforced

**Biome** (`apps/web/biome.json`) - selected rules:

```json
{
  "suspicious":   { "noExplicitAny": "error" },
  "correctness":  { "noUnusedVariables": "error", "noUnusedImports": "error", "useHookAtTopLevel": "error" },
  "style":        { "useImportType": "error", "noParameterAssign": "error" },
  "complexity":   { "useOptionalChain": "error" }
}
```

**mypy** (`apps/api/pyproject.toml`):

```toml
[tool.mypy]
python_version = "3.12"
strict = true
```

Strict mode enables `--disallow-any-generics`, `--disallow-untyped-defs`, `--warn-return-any`, and 15 other checks.

**Knip** (`apps/web/knip.config.ts`) - all categories set to `"error"`:

```typescript
rules: {
  files: 'error', dependencies: 'error', exports: 'error',
  types: 'error', duplicates: 'error', unlisted: 'error',
}
```

## SonarQube in CI (SIRA-60)

SonarQube runs as a dedicated `quality` stage in the GitLab CI pipeline, after all CI jobs complete. Coverage artifacts from CI are consumed directly:

```mermaid
flowchart TB
    subgraph ci [ci stage - parallel]
        WL[web:lint]
        WT[web:test\ngenerates lcov.info]
        AL[api:lint]
        AT[api:test\ngenerates coverage.xml]
    end

    subgraph quality [quality stage]
        LN[linear:notify]
        SQ[sonar-scanner-cli]
    end

    ci --> quality
    WT --> SQ
    AT --> SQ
```

`sonar-project.properties` at repo root:

```properties
sonar.projectKey=SIRA
sonar.sources=apps/web/src,apps/api/src
sonar.tests=apps/api/tests
sonar.javascript.lcov.reportPaths=apps/web/coverage/lcov.info
sonar.python.coverage.reportPaths=apps/api/coverage.xml
```

Both coverage reports (Python XML + JS LCOV) flow into a single SonarQube project at `sonarqube.cs.ui.ac.id`. The SonarQube MCP server is also configured in `.mcp.json` for AI-assisted quality inspection directly from the editor.

## Beyond Style — Runtime Failure Prevention

Static analysis in SIRA is not limited to formatting and import order. The configuration catches issues that would manifest as runtime failures in production.

### mypy Strict Mode: Untyped Code as a Runtime Risk

`strict = true` enables a class of checks that catch real runtime failures:

| mypy flag | What it prevents |
|-----------|-----------------|
| `--disallow-untyped-defs` | Functions with no type annotations — callers can't reason about null safety |
| `--disallow-any-generics` | `list` without `list[str]` — type-erased collections that collapse to `Any` |
| `--warn-return-any` | Functions returning `Any` — propagates type unsafety to every caller |
| `--strict-optional` | Unenforced `Optional` checks — missed `None` dereferences become `AttributeError` at runtime |

The last is the most critical: any `T | None` return must be narrowed before use. mypy surfaces these as type errors before CI, not as production crashes.

### Biome `noExplicitAny`: Blocking the Type Escape Hatch

TypeScript's `any` type disables all type inference — any method call or property access on `any` is unchecked:

```typescript
// ❌ blocked — data.amount is unchecked; typos and wrong shapes pass silently
function process(data: any) { return data.amount }

// ✅ required — TypeScript verifies .amount_paid exists on PaymentCreate
function process(data: PaymentCreate) { return data.amount_paid }
```

With `any`, `data.typo` compiles and crashes at runtime. With typed parameters, it's a compile error caught before the branch executes.

### Knip: Dead Code as a Behavioral Risk

Unused exports are not just style noise — they represent a behavioral risk:

- Unused functions accumulate bugs that tests never exercise
- Dead branches can drift out of sync with the active codebase's assumptions
- Unreachable code paths hide logic errors until accidentally reactivated

`exports: "error"` ensures every exported symbol is consumed. Unused utilities are removed rather than accumulating drift.

### SonarQube: Complexity as a Bug Predictor

SonarQube's cognitive complexity metric flags functions with high branching depth — a reliable predictor of off-by-one and conditional logic errors. This catches behavioral issues that type checkers miss: not "what type is this value" but "is this branching logic reachable and correct."

---

## Evidence

- [MR !26 - SIRA-60 SonarQube CI integration](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/26)
- [Linear SIRA-60](https://linear.app/ppl-sira/issue/SIRA-60)
- Source: `sonar-project.properties`, `apps/web/biome.json`, `apps/web/knip.config.ts`, `apps/api/pyproject.toml`, `.husky/pre-commit`, `.gitlab-ci.yml`
