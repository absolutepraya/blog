---
title: "PPL: New Learnings Applied to SIRA [Sprint 2, Week 2]"
date: 2026-04-09
description: "Five new technologies and concepts learned outside coursework and applied to SIRA: mutation testing (mutmut + Stryker), integration test isolation with psycopg, Celery observability via Sentry, and AI context engineering through CLAUDE.md."
tags: ["ppl", "aptitude", "learning", "mutation-testing", "integration-testing", "sentry"]
slug: s2w2-aptitude
toc: true
---

## Overview

Sprint 2 Week 2 (April 3 to 9) was dominated by a mutation testing sprint: setting up mutmut and Stryker in CI, building integration test infrastructure from scratch, and writing mutation-killing tests. The week also delivered three application features and a meta-level improvement to AI workflow. Each area required learning at least one technology or concept not covered in standard Fasilkom coursework.

---

## 1. Mutation Testing with mutmut (Python)

Mutation testing is a technique where a tool injects small faults ("mutants") into your source code (flipping operators, changing constants, removing lines) and checks whether your test suite catches each fault. If a test fails, the mutant is "killed." If no test fails, the mutant "survives," meaning your tests have a blind spot.

### What I Learned

- mutmut's configuration model: `paths_to_mutate` controls which source files get mutated, while `pytest_add_cli_args` controls which tests run against each mutant
- The strategic decision of what NOT to mutate matters as much as what to mutate. Router tests were excluded because they hit rate limits under mutation load. Seed tests were excluded because they depend on data isolation that mutations disrupt.
- `-p no:randomly` is required because mutmut needs deterministic test ordering to correctly attribute failures to specific mutants

```toml
[tool.mutmut]
paths_to_mutate = ["src/app/services/"]
tests_dir = ["tests/"]
pytest_add_cli_args = [
    "-m", "",
    "--ignore=tests/test_settings_router.py",
    "--ignore=tests/test_session_router.py",
    "-p", "no:randomly",
]
```

This is not taught in any Fasilkom testing course. The standard curriculum covers unit testing and maybe integration testing, but mutation testing as a quality metric is an industry practice that goes beyond coverage percentages.

---

## 2. Mutation Testing with Stryker (TypeScript)

Stryker is the TypeScript equivalent of mutmut, but with a different configuration model: JSON-based config, plugin system, and built-in threshold enforcement.

### What I Learned

- Stryker's threshold system: `break` (fail CI below this score), `low` (yellow warning), `high` (green). This gives three levels of feedback instead of just pass/fail.
- Plugin discovery in pnpm workspaces works differently from npm. Stryker looks for plugins in `node_modules/`, but pnpm uses `.pnpm/` with symlinks. The fix was using `pnpm exec stryker run` instead of calling the binary directly.
- Excluding integration-point files (`api.ts`, `supabase.ts`, `auth-context.tsx`) from mutation is important because mutating external client wrappers produces mutations that depend on network state, making results non-deterministic.

```json
{
  "mutate": [
    "src/lib/**/*.ts",
    "!src/lib/api.ts",
    "!src/lib/supabase.ts",
    "!src/lib/auth-context.tsx"
  ],
  "thresholds": { "high": 80, "low": 60, "break": 50 }
}
```

---

## 3. Integration Test Isolation with psycopg

Building the integration test infrastructure required learning how Supabase exposes its internal Postgres instance and how to connect directly for operations that PostgREST does not support.

### What I Learned

- PostgREST (Supabase's HTTP layer) does not support `TRUNCATE`. You cannot clean up test data through the Supabase client alone.
- Supabase exposes a direct Postgres port at URL port + 1. If the Supabase API runs on 54321, Postgres is on 54322.
- The `autouse` fixture pattern in pytest: a fixture that runs automatically for every test matching a marker, without explicit injection. Combined with truncating both before AND after each test, this provides isolation even when a test aborts mid-execution.

```python
@pytest.fixture(autouse=True)
def _truncate_tables(request: pytest.FixtureRequest) -> Generator[None]:
    marker = request.node.get_closest_marker("integration")
    if marker is None:
        yield
        return
    _do_truncate()
    yield
    _do_truncate()
```

The FK-safe truncation order (children before parents) was another learning: truncating `clients` before `invoices` fails because of foreign key constraints. The order must be `reminder_logs` > `payments` > `invoices` > `clients`.

---

## 4. CeleryIntegration for Sentry

Celery tasks run in background workers, separate from the FastAPI process. Without explicit instrumentation, task failures are invisible to error monitoring.

### What I Learned

- Sentry's auto-discovery of Celery is version-dependent. In some SDK versions, Celery exceptions are captured automatically; in others, they are not. Explicitly listing `CeleryIntegration()` in the `integrations` parameter removes this ambiguity.
- `CeleryIntegration` captures task exceptions including retry exhaustion, with full task context (name, arguments, retry count). Without it, a task that fails after 3 retries just disappears.
- Writing a test that verifies the integration is present (checking `isinstance(i, CeleryIntegration)` in the integrations list) kills the mutant that would remove the integration.

```python
sentry_sdk.init(
    dsn=settings.sentry_dsn,
    release=settings.commit_sha,
    integrations=[CeleryIntegration()],
)
```

---

## 5. CLAUDE.md as AI Context Engineering

This is a meta-level learning: structuring project documentation specifically to improve AI assistant output quality.

### What I Learned

- CLAUDE.md is loaded at the start of every Claude Code session. Anything written there becomes persistent context that the AI uses for all future interactions.
- After the mutation testing sprint, I updated CLAUDE.md (MR !142) with: staging Supabase connection gotchas (IPv4 vs IPv6, pooler URL, post-pause restart), the mutmut ignore list rationale, SonarQube coverage merging approach, and integration test conventions.
- The ROI is compounding: every future session that touches CI, testing, or staging Supabase starts with the correct context instead of re-discovering patterns. This is not "using AI" in the typical sense; it is engineering the AI's context to be more effective.

---

## Evidence

- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): integration test infrastructure + domain tests
- MR !153 — test(api): strengthen integration tests for mutation testing
- MR !156 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): mutation-killing unit tests for services
- MR !105 — [SIRA-135](https://linear.app/ppl-sira/issue/SIRA-135): Sentry instrumentation for Celery
- MR !142 — docs: update CLAUDE.md
- MR !145, !146, !147, !148, !149, !152, !158, !159 — mutation testing CI series
- Source: `apps/api/pyproject.toml`, `apps/web/stryker.config.json`, `apps/api/tests/conftest.py`, `apps/api/src/app/workers/celery_app.py`
