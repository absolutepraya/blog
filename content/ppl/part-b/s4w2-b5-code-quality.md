---
title: "[S4, W2] PPL: From Soft Gate to Hard Floor"
date: 2026-05-20
description: "Promoted the React Doctor CI job from soft-fail-only to hard-fail-on-score-below-95, turning an advisory linter into a structural quality gate. Plus defensive test commits filling branch coverage holes on the new Permission Request system, and one refactor commit that exists purely to keep two routers DRY."
tags: ["ppl", "code-quality"]
slug: "s4w2-code-quality"
toc: true
---

## What I Worked On

Three quality moves this week, each smaller than last week's react-doctor rollout but each more pointed:

- **Direct main commit `475222ed`**: promoted the `web:react-doctor` CI job from soft-fail-on-warnings to hard-fail-when-score-below-95. The same job that posted yellow notes last week now blocks merges.
- **Multiple `test(api):` and `test(web):` commits across MRs !307 / !308**: filled defensive-branch coverage on the new Permission Request system, including modal error paths, exception classes, and helper functions that don't have happy-path tests.
- **Refactor commit `34523a2d` inside MR !310**: extracted `_map_permission_error` helper after both green commits landed. Pure cleanup, zero behavior change.

## Promoting the React Doctor Gate to a Hard Floor

The S4W1 react-doctor integration shipped as soft-fail-only. Findings posted as yellow MR comments but never blocked merge. That was the right call for week one because the codebase had 30+ existing findings; hard-failing would have rejected every open MR until the cleanup pass landed.

After MR !303 cleaned the score up to the high 90s, the soft gate stopped being useful. Yellow comments that everyone scrolls past are noise. So this week the gate got teeth:

```yaml
# .gitlab-ci.yml — web:react-doctor job, after this week
script:
  - |
    set +e
    pnpm dlx react-doctor@latest . --offline --yes --fail-on none --json > /tmp/react-doctor.json
    set -e
    SCORE=$(python3 -c "import json; print(int(json.load(open('/tmp/react-doctor.json')).get('summary', {}).get('score', 0)))")
    ERRORS=$(python3 -c "import json; print(json.load(open('/tmp/react-doctor.json')).get('summary', {}).get('errorCount', 0))")
    WARNINGS=$(python3 -c "import json; print(json.load(open('/tmp/react-doctor.json')).get('summary', {}).get('warningCount', 0))")
    echo "react-doctor — score: $SCORE, errors: $ERRORS, warnings: $WARNINGS"
    if [ "$SCORE" -lt 95 ]; then
      echo "FAIL: HCE score $SCORE is below the project floor of 95."
      exit 1
    fi
    if [ "$ERRORS" -gt 0 ] || [ "$WARNINGS" -gt 0 ]; then
      exit 77
    fi
```

Two-tier severity now:

| Condition | Exit code | Status | Effect |
|-----------|----------:|--------|--------|
| Score >= 95, no errors, no warnings | 0 | 🟢 green | merge allowed |
| Score >= 95 but warnings exist | 77 | 🟡 yellow | merge allowed, but flagged |
| Score < 95 | 1 | 🔴 red | merge blocked |

Why 95 specifically? The current main branch sits comfortably above it (96-98 depending on the file mix), so the floor doesn't immediately reject any MR. But it leaves no room for "small regressions"; every MR has to clear the same bar that main currently clears. The score can only go up.

The same check runs in the pre-push hook so developers see it locally before push. A blocked CI run on a 3-minute pipeline is fine; a blocked push after a 2-hour test session is much worse for morale. Surfacing the check locally costs nothing and prevents the "wait, why is CI red on something I didn't touch?" surprise.

This is also the moment React Doctor stops being a tool we use and starts being infrastructure that constrains us. Tools are optional. Infrastructure is the default. The codebase will now stay at HCE >= 95 because the CI will reject anything that doesn't.

## Defensive Test Coverage: Filling Branch Holes Before They Become Bugs

The Permission Request system in MR !307 and MR !308 introduced new code paths that don't get hit by the happy path: stale-state errors (DB row changed between page load and admin approval), modal validation errors, label helper edge cases, exception classes that only fire in malformed-input scenarios. These are exactly the branches mutation testing flags as "tested but not asserted" if they get coverage from a happy-path test but no test names the specific failure mode.

Three of my test commits this week specifically targeted these gaps:

```
277cfca6 test(api): add unit tests for permission_request helpers + response validator
49ec8d46 test(api): cover _flatten_joins helper and permission_request exception classes
41a430c1 test(api): cover defensive service branches with mocked db
```

And on the FE:

```
e3ded9b9 test(web): cover deny-dialog onDenied, approval-queue refetching, client-detail AR-staff path
12d14a01 test(web): cover modal error paths, payload slot, and live counter
4515985a test(web): cover approval-queue loading/error/empty payload + idle stale paths
5c501f30 test(web): cover deny dialog, my-requests page, and label helpers
```

Six commits dedicated to defensive coverage on a feature that was already "working." None of them changed production behavior; they only added assertions that pin behavior that was correct-by-accident. The reason this matters is the same reason the b1 blog mentioned: tests that exist only as side effects of happy-path coverage will pass when the underlying code is broken. The branch coverage gap means a future refactor could silently change a defensive path, and only an incident in production would catch it.

A specific example: `_flatten_joins` is a one-line helper that converts Supabase join results from nested dicts into a flat row. The happy path is covered transitively (any test that calls a query function that uses it). But the helper has an early return when the join is missing, and that branch wasn't asserted anywhere. The test commit `49ec8d46` adds one test that passes a row with no joins and asserts the helper returns the row unchanged. Trivial test, but it pins the contract so a refactor that swaps the early return for `raise KeyError` will fail loudly instead of silently breaking some downstream caller.

## Refactor as a Separate Commit

The refactor commit inside MR !310 is the smallest behaviorally-relevant change this week, and it's deliberately separate:

```
34523a2d refactor(api): extract _map_permission_error helper for AR_STAFF gate routing
```

After both green commits in the MR widened the AR_STAFF gate, the cancel_invoice and update_invoice routers had identical error-translation boilerplate:

```python
try:
    return await invoice_service.cancel(invoice_id, actor_role=user.role)
except PermissionError as exc:
    raise HTTPException(status_code=403, detail=str(exc)) from exc
```

The refactor pulls the translation into a one-line helper:

```python
def _map_permission_error(exc: PermissionError) -> HTTPException:
    return HTTPException(status_code=403, detail=str(exc))
```

Three routers now use it (two from this MR plus a third coming in the next sprint). The change is tiny, and that's exactly why it ships as its own commit. The rule from CLAUDE.local.md is:

> `refactor(scope): ...`, Cleanup with all tests green (no behavior change)

Bundling this into a green commit would have made the diff harder to review (mixing the security fix with a stylistic cleanup) and harder to revert if the inline form turned out to be the right call. Separating it costs nothing and preserves the option to roll back just the refactor without touching the security fix.

This is the same pattern as commits that prefix `chore(scope):` for non-behavioral work: keep the commit boundaries aligned with what the commit actually does. A reviewer reading the squashed commit on main loses this granularity; a reviewer reading the pre-squash MR sees the discipline.

## SonarQube Quality Gate Held Across All Three Authored MRs

The SonarQube `sonar-scan` CI job enforces an 85% coverage threshold on new code for any MR. All three authored MRs this week (!307, !308, !310) passed the gate:

| MR | New code coverage | Notes |
|----|------------------:|-------|
| !307 BE permission system | 91.4% | 277cfca6 + 49ec8d46 + 41a430c1 brought it from 79% to 91% |
| !308 FE permission UI | 87.2% | e3ded9b9 + 12d14a01 + 4515985a + 5c501f30 closed it |
| !310 RBAC bypass closure | 96.8% | 9 integration tests on a small surface area |

The "brought from 79% to 91%" is the explicit work: SonarQube's first scan on MR !307 reported the coverage gap, and the three test commits closed it before merge. The discipline is "don't merge with a coverage drop"; the mechanism is the SonarQube gate; the action is "add the missing tests, don't disable the gate." Same playbook as react-doctor.

## What I Learned

**Soft gates become noise; hard gates become infrastructure.** The week-one react-doctor rollout had to be soft because the codebase wasn't ready for hard. Week two, the codebase was ready, so the gate hardened. The discipline is to know when each is appropriate. Soft gates that stay soft forever lose all signal value; hard gates introduced on day one alienate everyone.

**Defensive branch tests are cheap insurance.** Six small test commits across the Permission Request MRs took maybe 20 minutes total to write. The bug they prevent (a silent regression on a defensive path that production hits once a month) is the kind of bug that's hard to root-cause when it does happen. Cheaper to write the test now than to triage a sentry alert in three months.

**Refactors deserve their own commits even when they're tiny.** The `_map_permission_error` extraction is 4 lines of code. The reason it's a separate commit is exactly because it's tiny: I can revert it in one click if the inline form turns out to be preferred. Bundling it into the green commit would have removed that option for free.

## Evidence

- Direct main commit promoting the gate: `475222ed ci(react-doctor): enforce HCE score floor of 95` (2026-05-14)
- Authored MR with defensive test commits (BE): [MR !307 SIRA-207](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/307), commits `277cfca6`, `49ec8d46`, `41a430c1`
- Authored MR with defensive test commits (FE): [MR !308 SIRA-208 SIRA-209](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308), commits `e3ded9b9`, `12d14a01`, `4515985a`, `5c501f30`
- Authored MR with refactor commit: [MR !310 SIRA-374](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310), commit `34523a2d`
- Source: `.gitlab-ci.yml` `web:react-doctor:` block (now has score-floor check)
- Source: `apps/api/src/app/routers/invoices.py` (`_map_permission_error` helper extraction)
- SonarQube quality gate: 85% new-code coverage threshold per project policy
- Test suite counts at end of week: 2462 unit tests + 372 integration tests + 1293 web tests passing
