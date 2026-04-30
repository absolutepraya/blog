---
title: "PPL: Beyond Unit Tests with Load, BDD, SAST, and Schema Fuzzing"
date: 2026-04-24
description: "Why every production codebase needs at least four kinds of test that the unit-vs-integration debate ignores: load tests with k6 to catch performance regressions, BDD with pytest-bdd for executable specs, SAST with Bandit and pnpm audit for supply-chain risk, and API schema fuzzing with Schemathesis for spec-driven robustness."
tags: ["ppl", "testing", "load-testing", "bdd", "security", "api-fuzzing"]
slug: "more-testing"
toc: true
---

The unit-vs-integration debate dominates testing conversations to the point that engineers forget there are entire categories of test that have nothing to do with either. A unit test that mocks the database does not tell you whether your endpoint survives 50 concurrent users. An integration test that asserts on database state does not catch a vulnerable transitive npm dependency. Both miss the question "does the API match its own published spec under arbitrary inputs?" In this blog I walk through four "other" testing dimensions we wired into a FastAPI + React monorepo, each filling a gap unit/integration testing structurally cannot.

> **Note:** Our project is hosted on an internal GitLab instance, so we use the term **MR (Merge Request)** throughout this blog. If you're coming from GitHub, MRs are the equivalent of **Pull Requests (PRs)**.

## Why "Other" Tests Matter

The Cohn testing pyramid (unit → integration → E2E) describes structure, not coverage. It says nothing about *what* a test catches. A team can have a perfect pyramid and still ship:

- A regression that doubles p95 latency, undetected because no test measures latency.
- A user-facing acceptance bug, because the unit/integration tests verify the engineer's mental model rather than the stakeholder's intent.
- A security vulnerability in a transitive dependency, because no test reads the dependency tree.
- A 500 response on a request shape the OpenAPI spec says is valid, because the example-based tests only cover request shapes the engineer thought to write.

Each of the four techniques below targets one of those gaps. None of them replace unit or integration tests; they sit alongside.

| Gap | Tool we use | What it catches |
|-----|-------------|-----------------|
| Performance under load | [k6](https://k6.io/) | p95 latency regressions, throughput collapse, server saturation |
| Stakeholder/engineer intent drift | [pytest-bdd](https://pytest-bdd.readthedocs.io/) + [Gherkin](https://cucumber.io/docs/gherkin/) | Tests that double as executable spec, readable by non-engineers |
| Supply-chain and SAST risk | Bandit (Python), pnpm audit (npm) | Code-level security issues + known-vulnerable dependencies |
| API spec drift / unexpected input shapes | [Schemathesis](https://schemathesis.readthedocs.io/) | Endpoints that return 5xx for spec-valid inputs, undocumented response codes |

The CI pipeline runs all four on every MR. The combination is what produces actual confidence at merge time, not the sum of any individual category.

## 1. Load Testing with k6

The argument for load testing in a pre-launch project usually goes: "we don't have users yet, why bother?" The honest answer is that you bother because **load tests catch regressions, not just incidents**. A correctness change that makes an endpoint 3x slower will not break any unit test, but it will eventually break the production user experience. Load tests fail loudly the moment the regression lands.

### Tool Choice: k6 over JMeter

We chose [k6](https://k6.io/) over JMeter for one reason: scripts are JavaScript files that live in the repo, get reviewed in MRs, and diff cleanly. JMeter ships XML scenario files that are nearly unreviewable. The downstream effect is that a k6 test gets updated when the API changes; a JMeter test silently rots until someone notices it has been failing for three months.

### Our Load Profile

The full script lives at `infra/k6/load-test.js`. The interesting part is the load shape and the threshold:

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 10 },  // ramp up to 10 users
    { duration: '20s', target: 50 },  // ramp up to 50 users
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // p95 latency < 500ms
  },
}

export default function () {
  // 1. Health check (baseline, no auth required)
  const healthRes = http.get(`${BASE_URL}/api/health`)
  check(healthRes, { 'health: status 200': (r) => r.status === 200 })

  // 2. GET /api/invoices/overdue
  const overdueRes = http.get(`${BASE_URL}/api/invoices/overdue`, authParams)
  check(overdueRes, { 'overdue: no 5xx': (r) => r.status < 500 })

  // 3. GET /api/dashboard/summary
  const dashboardRes = http.get(`${BASE_URL}/api/dashboard/summary`, authParams)

  // 4. GET /api/invoices/
  const invoicesRes = http.get(`${BASE_URL}/api/invoices/`, authParams)

  sleep(0.5)
}
```

**Why a ramp profile, not a flat 50 users?** The ramp catches saturation behaviour that a flat load misses. If the system handles 10 users at 100ms p95 but jumps to 800ms at 50 users, the ramp shows that as a curve. A flat 50-user test would just show "p95 is 800ms" with no information about *where* it broke down.

**Why the four endpoints?** They are the highest-value paths in the application: dashboard rendering, overdue invoice listing, invoice CRUD. The health check is a baseline — if `/api/health` is slow, the problem is upstream of the application (database, network, container resources). Including it lets us distinguish "the dashboard query is slow" from "everything is slow."

**Why p95 < 500ms?** This is the threshold that **fails the CI job**. Below it the build is green; above it the build fails and merge is blocked. The choice of 500ms is not arbitrary — it is the latency at which a UI feels "responsive but not snappy" in the human-perception literature. We picked it as the boundary between acceptable and worth-investigating.

### What the Load Test Catches That Unit Tests Don't

Most performance regressions are death-by-a-thousand-cuts. A new field added to a query response. A new `JOIN` in a service method. A new `await` that turns a parallel computation into a sequential one. Each one looks innocuous in code review and passes every unit test. The load test is the only place these accumulate into a measurable signal.

The CI job runs k6 on every MR via the `load-test:` job in `.gitlab-ci.yml`. A failure shows up as a red check on the MR with the exact threshold violation in the log: `http_req_duration..............: avg=412ms p(95)=623ms p(99)=1.2s`. The author can see at a glance which endpoint slowed down (the per-check breakdown above the summary tells you).

## 2. Behaviour-Driven Development with pytest-bdd

Test code is the second-most-read documentation a project has, after the README. Engineers read tests to understand what the code is supposed to do. But tests written in raw pytest assertions are unreadable by anyone outside the engineering team — and "anyone outside the engineering team" includes the lecturer marking your project, the product owner reviewing requirements, and you in three months when you have forgotten the context.

[pytest-bdd](https://pytest-bdd.readthedocs.io/) plus [Gherkin](https://cucumber.io/docs/gherkin/) closes this gap by separating the spec (Gherkin, plain English) from the execution (pytest, Python). The spec lives in `.feature` files; the executor lives in `.py` step definitions; pytest-bdd binds them together at test discovery.

This pattern was popularised by Dan North's BDD writings (2006) and the Cucumber project (Aslak Hellesøy and others), with the foundational reference being *The Cucumber Book* (Wynne, Hellesøy, Mugridge, 2017). The promise is "executable specifications": the test passing means the behaviour described in plain English is actually implemented.

### How a Gherkin Spec Looks in Our Codebase

A real feature file from `apps/api/tests/features/payment_recording.feature`:

```gherkin
Feature: Payment Recording
  When a payment is recorded against an invoice, the system calculates
  days_late (for ML risk scoring), validates the amount, and automatically
  recalculates the invoice status.

  Scenario: Partial payment updates invoice to PARTIAL status
    Given an UNPAID invoice "INV-001" with amount 1000000
    And the invoice due date is "2026-01-31"
    When a payment of 500000 is recorded on "2026-02-05"
    Then the payment days_late should be 5
    And the invoice status should become "PARTIAL"

  Scenario: Full payment updates invoice to PAID status
    Given an UNPAID invoice "INV-001" with amount 1000000
    And the invoice due date is "2026-01-31"
    When a payment of 1000000 is recorded on "2026-01-25"
    Then the payment days_late should be -6
    And the invoice status should become "PAID"

  Scenario: Overpayment is rejected
    Given an UNPAID invoice "INV-001" with amount 1000000
    And the invoice due date is "2026-01-31"
    And existing payments total 800000
    When a payment of 300000 is attempted
    Then the payment should be rejected with "exceeds remaining balance"
```

The non-engineer reader can answer "what happens when a customer overpays?" by reading the spec without touching the code. The engineer reader can run the same file as a test by invoking `pytest tests/bdd/test_payment_recording.py`.

### How the Glue Code Works

Each `Given` / `When` / `Then` line maps to a Python function via parameterised string matching:

```python
# apps/api/tests/bdd/test_payment_recording.py
from pytest_bdd import given, parsers, scenario, then, when

@scenario("../features/payment_recording.feature", "Partial payment updates invoice to PARTIAL status")
def test_partial_payment() -> None:
    pass

@given(
    parsers.parse('an {status} invoice "{inv_num}" with amount {amount:d}'),
    target_fixture="context",
)
def given_unpaid_invoice(context, status, inv_num, amount) -> dict:
    context["invoice"] = {
        "id": "inv-bdd-001",
        "invoice_number": inv_num,
        "amount": str(amount),
        "due_date": "2026-01-31",
        "status": status,
    }
    return context
```

The `@scenario(...)` decorator binds an empty pytest function to a specific scenario in the feature file. pytest-bdd resolves each line of the scenario by string-matching against decorated step functions. The named placeholders (`{status}`, `{inv_num}`) become typed Python arguments.

### Coverage and CI Integration

We currently have **13 scenarios across 3 feature files** (`invoice_creation.feature`, `overdue_detection.feature`, `payment_recording.feature`), with 39 more planned across 8 additional domains. The CI job `api:bdd` runs the suite on every MR and posts a per-feature pass/fail table back as an MR comment, so a non-engineer reviewer can see at a glance which scenarios changed or broke.

### The Honest Limit of BDD

BDD scenarios are most valuable when the behaviour they describe is **actually negotiated with stakeholders**. If the engineer writes both the Gherkin and the Python, BDD becomes a more verbose way to write tests with no extra value. We use it specifically for behaviours where the requirement comes from outside engineering (status transitions, overpayment policy, late-fee calculations) — places where the "executable spec" framing pays off because a non-engineer might read the feature file and say "actually, we want overpayments to credit the next invoice, not error." The bug gets caught in the spec, not in production.

## 3. SAST and Supply-Chain Scanning with Bandit + pnpm audit

A third dimension unit tests cannot reach: **the code you did not write**. Modern applications import hundreds of dependencies; each one carries the risk of a published CVE, an upstream maintainer mistake, or a malicious takeover. Static Application Security Testing (SAST) on your own code plus dependency auditing on your supply chain are the two minimum bars.

We run two scanners on every MR via the `security:sast` CI job:

- **[Bandit](https://bandit.readthedocs.io/)** for Python code-level issues (eval injection, weak crypto, hardcoded secrets, unsafe deserialisation).
- **`pnpm audit`** for npm dependency vulnerabilities (known-CVE matching against the npm advisory database).

### The Severity Gating Policy

The naïve approach is "fail the build on any finding." This produces alert fatigue and broken pipelines from noise. We use a tiered policy:

```bash
# .gitlab-ci.yml security:sast job
if [ "$BANDIT_HIGH" -gt 0 ] || [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  exit 1   # red — blocks merge
elif [ "$BANDIT_MEDIUM" -gt 0 ] || [ "$MODERATE" -gt 0 ]; then
  exit 77  # yellow — soft fail, allows merge with visible warning
fi
```

Three states:

| Bandit severity | npm severity | Exit code | Effect |
|----------------|--------------|-----------|--------|
| HIGH | critical or high | 1 (red) | Blocks merge |
| MEDIUM | moderate | 77 (yellow) | Soft fail, MR comment shows warning |
| LOW or none | LOW or none | 0 (green) | Pass |

The yellow state is the load-bearing innovation. A blanket "any finding fails" gates becomes a habit of suppressing findings rather than investigating them. The yellow state surfaces the finding without blocking the engineer, which gives a path to triage at the right moment (not panic-fix at merge time).

### A Real Catch

Earlier in the project, `pnpm audit` flagged a high-severity advisory against axios (`GHSA-3p68-rc4w-qgx5`, an SSRF vulnerability via absolute URLs in path arguments). The CI job went red on the MR that introduced an axios upgrade in a transitive dependency. We pinned axios to the patched version, the audit went green, the MR merged. Total triage time: ~10 minutes. Without the audit, we would have shipped the vulnerable version into production and had no automated signal that anything was wrong.

The point is not that this single advisory was particularly dangerous to *our* application — we don't construct axios URLs from user input — but that the CI job did the work of *checking*. The cost of the check is measured in CI minutes; the cost of *not* checking is measured in incident response.

### Bandit's False-Positive Discipline

Bandit will flag any use of `Markup()` from MarkupSafe as a B704 (markup safety) issue. This is correct in the abstract — `Markup()` bypasses Jinja2 autoescaping — but in our code, `Markup()` is used inside a `SandboxedEnvironment` that already has `autoescape=True`, with input that has been through a Bleach allowlist sanitiser. The flag is a false positive for our specific context.

The right response is not to disable B704 globally. It is to add an inline `# nosec B704` with a comment explaining *why* this specific call is safe:

```python
# Body has already been sanitized by EmailTemplateUpdate Bleach allowlist;
# Jinja2 SandboxedEnvironment + autoescape=True provides defence in depth.
template.render(body_html=Markup(body_html))  # nosec B109,B704
```

This keeps the gate strict, documents the exception inline for future auditors, and requires no architectural change. It also models the right relationship with SAST tools: not "tool says ignore" but "tool says check, here is the check, here is the conclusion."

## 4. API Schema Fuzzing with Schemathesis

Most API tests are example-based: the engineer writes a request payload, sends it, asserts on the response. This is fine for the request shapes the engineer thinks of, and useless for the request shapes the engineer doesn't.

[Schemathesis](https://schemathesis.readthedocs.io/) reads the OpenAPI schema your FastAPI app already publishes and uses it to generate hundreds of valid-per-spec request shapes. It then sends each one to the live server and reports any endpoint that returns a 5xx, a non-documented status code, or a response that violates the schema. This is the same idea as property-based testing, applied to the HTTP/spec boundary instead of pure-function I/O.

### Why It Matters

OpenAPI schemas have a way of drifting from implementation. An engineer adds a new optional field, forgets to update the response schema, and the spec now lies. A different engineer writes a client based on the spec and gets a 500 from a request the spec said was valid. Schemathesis catches this drift at CI time:

- **5xx for spec-valid request**: the implementation rejected an input the spec said was acceptable. Either the spec is wrong (tighten the schema) or the implementation is wrong (handle the input).
- **Status code not in spec**: the endpoint returned a status the spec doesn't document. The spec is incomplete.
- **Response shape violation**: the endpoint returned a body that doesn't match its declared response model. Documentation lies to clients.

### How We Wire It

The CI job `api:schema-test` runs Schemathesis against a dedicated **staging Supabase project** (separate from local dev) so the fuzzer hits a real PostgREST + Auth + Storage stack with realistic data, not mocks. The relevant snippet:

```yaml
api:schema-test:
  stage: quality
  resource_group: schema-staging   # serialise — only one schema-test runs at a time
  variables:
    SUPABASE_URL: $STAGING_SUPABASE_URL
    SUPABASE_KEY: $STAGING_SUPABASE_KEY
    ENVIRONMENT: test
  script:
    - psql -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; ..."
    - # apply migrations
    - # seed test data + auth user
    - uv run uvicorn app.main:app &
    - uv run schemathesis run http://localhost:8000/openapi.json
```

The `resource_group: schema-staging` is the operational subtlety. Schemathesis is destructive: it will issue DELETEs and POSTs that mutate state. Two concurrent schema-test runs against the same staging DB would corrupt each other's assertions. The resource group tells GitLab to serialise these jobs, even across MRs.

Locally, the same scanner runs as a schema-validity unit test in `apps/api/tests/test_schemathesis.py`:

```python
def test_openapi_schema_is_valid(openapi_schema: dict) -> None:
    """The OpenAPI schema must be well-formed and contain expected endpoints."""
    assert "openapi" in openapi_schema
    expected_paths = ["/api/invoices/", "/api/payments/", "/api/auth/me"]
    for path in expected_paths:
        assert path in openapi_schema["paths"], f"Expected endpoint {path} not found"

def test_all_endpoints_have_response_schemas(openapi_schema: dict) -> None:
    """Every endpoint must document at least one response status code."""
    for path, methods in openapi_schema["paths"].items():
        for method, spec in methods.items():
            if method in ("get", "post", "put", "patch", "delete"):
                assert "responses" in spec, f"{method.upper()} {path} has no response schema"
```

These are cheap pre-checks: they catch "the schema is malformed" before the expensive fuzzing job even starts. Schemathesis itself only runs in CI against staging.

### What Schemathesis Caught

The most useful catches were not novel exploits but **drift bugs**. A few representative examples:

- An endpoint added a new query parameter and forgot to declare it as optional in the schema. Requests without the parameter started failing with a 422 the spec said couldn't happen. Schemathesis flagged it on the next MR.
- An endpoint returned 200 when the schema said only 200/404 were possible, but the response body for some inputs was missing a required field. The fuzzer's response-schema check caught this without anyone needing to enumerate the inputs.
- A path parameter was typed as `int` in the spec but the implementation accepted any UUID-shaped string. Schemathesis sent integer IDs (per the spec), got 404s the schema didn't document, and reported the discrepancy.

None of these were security-critical. All of them were the kind of papercut that breaks API consumers and erodes trust in the documentation.

## How These Four Compose

Each technique covers a dimension the others structurally cannot:

| Dimension | Covered by | Failure mode it reveals |
|-----------|-----------|-------------------------|
| Performance under realistic concurrency | k6 | p95 latency above the human-tolerance threshold |
| Stakeholder/intent alignment | pytest-bdd + Gherkin | Code that does what the engineer thought, not what the spec says |
| Self-code security + supply chain | Bandit + pnpm audit | Vulnerable patterns in your code; vulnerable dependencies you imported |
| API spec ↔ implementation drift | Schemathesis | Endpoints that lie about their request/response contract |

A unit test suite, no matter how thorough, catches none of these directly. Integration tests catch some (BDD scenarios are integration-shaped, schema-test is integration-shaped) but the *category* of bug each one targets is distinct from "did the function return the right value."

The CI pipeline runs all four on every MR. The order matters: SAST and BDD run early (they fail fast on syntax-level or behaviour-level issues); load-test and schema-test run late (they need a live server). A red on any of them blocks merge with a specific, actionable error message rather than a generic "tests failed."

## What Each Technique Does NOT Catch

The same anti-overclaiming discipline as in the other testing blogs. None of these tools is a silver bullet:

**k6 load testing does not catch:**

- Cold-start latency. Our test ramps in 10 seconds; real-world traffic spikes can hit before any caches warm up.
- Database lock contention under writes. The test is read-heavy; write-heavy load profiles need different scenarios.
- Network-level issues (TLS handshake cost, CDN cache miss patterns) — these are upstream of what k6 measures.

**BDD does not catch:**

- Bugs the spec author didn't think of. Gherkin is the spec, not a generator. If the scenario doesn't mention overpayment, no test for it.
- Implementation-level correctness inside a step. A `Then payment is recorded` step might pass even if the recording happened in a buggy way as long as the visible end-state matches.

**SAST + dependency audit does not catch:**

- Logic-level vulnerabilities. Bandit can flag `eval(user_input)` but cannot tell you that your authorisation check is wrong.
- Vulnerabilities in dependencies before they are published as CVEs. Zero-days are zero-days regardless of audit policy.

**Schemathesis does not catch:**

- Bugs in inputs the spec considers invalid. The fuzzer only generates spec-conforming inputs; if your spec is permissive, the fuzzer is permissive.
- Stateful bugs across multi-request flows. Schemathesis exercises endpoints in isolation; multi-step business flows need integration tests.

The combination still leaves gaps: bugs that require *all four contexts simultaneously* (a slow endpoint with a vulnerable dependency that violates the spec under load) will not be cleanly attributed to any single tool. Manual exploratory testing and production observability fill those gaps. No CI suite is complete; the goal is to make the next bug as cheap as possible to find.

## Reflection: Where the Effort Was Worth It

**Worth it: SAST + dependency audit.** Highest signal-to-effort ratio of the four. The CI job is ~50 lines of YAML; the catches are real (the axios SSRF advisory was a single-MR save) and the false-positive rate is manageable with the inline `# nosec` discipline.

**Worth it: Schemathesis on staging.** The drift bugs it catches are the boring kind that nobody else would have found until a frontend developer hit a 500 in production. Three of those a quarter is enough to justify the CI job's cost.

**Worth it but underused: BDD.** We have 13 scenarios and the framework is ready for many more. The bottleneck is not technical — it is finding the time to negotiate scenarios with non-engineer stakeholders rather than just writing them as a tax. The 39 planned scenarios in our backlog are mostly "we know what these should be, we just have to do the work."

**Mixed: k6 load testing.** Useful as a regression detector, less useful for *capacity planning* in a pre-launch project. We don't know what real traffic shapes look like, so the choice of "ramp from 10 to 50 users over 40 seconds" is a guess. The threshold catches obvious slowdowns; tuning the test for realistic load will require traffic data we don't yet have. Our pragmatic approach: keep the regression-detection threshold strict, defer capacity-planning load profiles until we have user data.

The meta-lesson, again, is that test design is a portfolio problem. Each of the four techniques in this blog answers a question the unit-vs-integration debate ignores. Adopting all four is cheap (a few hundred lines of YAML and a handful of test files); adopting none of them produces a codebase that *passes its tests* without anyone having confidence in what that means. The industry shorthand "100% coverage" hides the question Pak Ade and the rubric force you to ask: *coverage of what, exactly?* Each dimension above answers a different "what."
