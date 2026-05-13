---
title: "[S4, W1] PPL: A New CI Quality Gate and the Score Improvement That Followed"
date: 2026-05-13
description: "Added React Doctor as a soft-fail CI quality gate in the quality stage, then followed up with a score-improvement commit that addressed findings across 28+ frontend files. Plus a small CI pin that fixed a flaky integration-test job for the whole team."
tags: ["ppl", "code-quality"]
slug: "s4w1-code-quality"
toc: true
---

## What I Worked On

Two MRs and one direct main commit for code quality this week:

- **MR !295 (SIRA-353)**: added the `web:react-doctor` job to the CI quality stage. React Doctor scans for React-specific anti-patterns (incorrect hook usage, missing keys in lists, performance issues, accessibility regressions, dead code). Results post to the MR as a yellow ci-report comment.
- **MR !303 (SIRA-366)**: follow-up to address the actual findings that the new gate surfaced. Touched 28+ files in `apps/web/src/components/` to clean up flagged patterns.
- **Direct commit `a4f0c61e`**: pinned the supabase CLI version in CI to stop integration-test jobs from breaking on postgres image tag drift.

## React Doctor as a Soft-Fail Gate

The job lives in `.gitlab-ci.yml` and runs in the `quality` stage:

```yaml
web:react-doctor:
  stage: quality
  before_script:
    - cd apps/web
    - pnpm install --frozen-lockfile
  script:
    - |
      set +e
      pnpm dlx react-doctor@latest . --offline --yes --fail-on none --json > /tmp/react-doctor.json
      DOCTOR_EXIT=$?
      set -e
      ERRORS=$(python3 -c "import json; print(json.load(open('/tmp/react-doctor.json')).get('summary', {}).get('errorCount', 0))")
      WARNINGS=$(python3 -c "import json; print(json.load(open('/tmp/react-doctor.json')).get('summary', {}).get('warningCount', 0))")
      SCORE=$(python3 -c "import json; print(json.load(open('/tmp/react-doctor.json')).get('summary', {}).get('score', 'N/A'))")
      echo "react-doctor — errors: $ERRORS, warnings: $WARNINGS, score: $SCORE"
      if [ "$ERRORS" -gt 0 ] || [ "$WARNINGS" -gt 0 ]; then
        exit 77
      fi
  after_script:
    - bash scripts/ci-report.sh react-doctor /tmp/react-doctor.json
  allow_failure:
    exit_codes:
      - 77
```

Three design decisions worth explaining.

**Soft-fail with exit 77, not hard-fail.** Exit 77 maps to yellow status via `allow_failure: exit_codes: [77]` in our pipeline conventions. The job posts findings to the MR but doesn't block merge. This is the right severity for a new linter: blocking on day one would have rejected every existing MR (the codebase had 30+ findings before SIRA-366 cleanup). Yellow surfaces the findings, gives authors a chance to clean up incrementally, and avoids the "everyone disables the linter by Friday" failure mode.

**`--fail-on none` flag.** This tells React Doctor itself to always exit zero. The severity decision lives in our shell wrapper, not the tool. The reason: we want the JSON output even when there are findings, so we can parse it and post a structured comment. If React Doctor exited non-zero on findings, the `set -e` would kill the job before we could capture the output.

**`--offline` flag.** React Doctor by default checks for the latest version on each run; `--offline` skips that. On Nashta's runner with intermittent egress, the version check was adding 30-90 seconds to the job. Offline mode is fine because `pnpm dlx react-doctor@latest` already pulls the latest on every run.

The result is a 30-second job that adds a new MR comment section showing errors, warnings, and score. The pattern is reusable: any new quality tool we adopt can plug into the same yellow-status soft-fail shape.

## SIRA-366: Cleaning Up the Findings

After the gate landed, the initial run on main reported a score in the 70s with several dozen findings across the components directory. MR !303 addressed them. The diff stat shows the breadth:

```
apps/web/react-doctor.config.json                       |  30 ++++++-
apps/web/src/components/app-sidebar.tsx                 |  32 ++++---
apps/web/src/components/client-analytics-pdf.tsx        |   6 +-
apps/web/src/components/client-duplicates-sheet.tsx     |   4 +-
apps/web/src/components/communication-history-table.tsx |   2 +-
apps/web/src/components/days-late-badge.tsx             |   2 +-
apps/web/src/components/email-template-editor.tsx       |   2 +-
apps/web/src/components/error-boundary.tsx              |   8 +-
apps/web/src/components/general-settings.tsx            |  14 +--
apps/web/src/components/import-csv-modal.tsx            |   6 +-
apps/web/src/components/invoice-export-modal.tsx        |   3 +-
apps/web/src/components/invoice-version-timeline.tsx    |   2 +-
apps/web/src/components/mobile-blocker.tsx              |   2 +-
```

The fixes broke down into a few categories:

- **Missing `key` props on list rendering** (most common): `.map()` calls that returned JSX without a stable key prop. The fix is a one-liner per spot but the bug it prevents is real; React reconciliation can swap DOM nodes incorrectly between renders, leading to stale state and accidental re-renders.
- **`useEffect` dependency arrays with missing or stale dependencies**: a few effects used closure-captured state that wasn't in the deps array. React Doctor flagged these accurately; missing deps cause the effect to read stale values.
- **Dead components**: a couple of files exported components that nothing imports. Combined with `knip` (which we already use for dead-code detection), this caught them.
- **`react-doctor.config.json` adjustments**: I had to add some intentional ignores (e.g., for the `routeTree.gen.ts` file that TanStack Router auto-generates and shouldn't be linted).

The ignore config grew from:

```json
{ "ignore": { "files": ["src/routeTree.gen.ts"] } }
```

to a richer 30-line file in MR !303 that scopes specific rule disables to specific files where the lint rule is wrong for that context. The principle: never silence a finding globally when you can scope the silence to the one file where the rule misfires.

## CI Pin: One-Liner Fix, Big Quality Win

The direct commit `a4f0c61e` deserves a callout because it's one of the highest-leverage quality fixes of the week. The integration-test job had been intermittently failing for several days with `failed commit on ref ... no such file or directory` errors during a Docker image pull. The root cause was non-deterministic CLI resolution:

```bash
# Before (broken)
npx supabase start

# After (a4f0c61e)
npx -y supabase@2.98.2 start
```

`npx supabase` resolves `latest` from npm at the time of each job run. Across two concurrent jobs, this could install two different CLI versions, each wanting a different postgres image tag. The Nashta runner had cached one tag, the other CLI wanted a different tag, and the pull-during-job hit a containerd race.

Pinning to a specific version (`2.98.2`) makes the resolution deterministic. Verification: pipeline 16318 (the first run after the fix) had integration tests passing in ~4.7 minutes with all images cached. Pre-fix runs had been failing after 16-minute timeouts.

The lesson: "use latest" is a quality bug, not a feature. Anything `latest` in CI is a future flake.

## What I Learned

Three patterns from this week:

**A new quality gate should be soft-fail on day one.** Blocking merges with a tool that's just been introduced creates a backlog of "fix the linter" MRs that compete with feature work. Yellow-status surfaces findings, lets authors triage, and the gate naturally tightens as the codebase converges to clean.

**Scoped ignores beat global suppressions.** When a linter rule misfires on a specific file (e.g., generated code), the right move is to ignore the rule in that one file's scope. Globally disabling the rule loses the protection everywhere else.

**`latest` is a CI smell.** Any time CI installs a tool with `latest` or `*` or `^`, the build is implicitly time-dependent. The supabase CLI bug was invisible until two jobs hit different `latest` values on the same day. The fix is always to pin, never to retry-until-it-works.

## Evidence

- [MR !295 SIRA-353 add React Doctor scan in CI quality stage](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/295): `.gitlab-ci.yml` job definition
- [MR !303 SIRA-366 improve React Doctor score](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/303): 28+ component files cleaned up
- Direct commit `a4f0c61e` on main: supabase CLI pin (`fix(ci): pin supabase CLI version to prevent postgres image tag drift`)
- Source: quality gate: `.gitlab-ci.yml` `web:react-doctor:` block
- Source: config: `apps/web/react-doctor.config.json` (30 lines after !303)
- Source: CI report integration: `scripts/ci-report.sh react-doctor` subcommand
- Verification: pipeline 16318 (first clean integration-test run after the supabase pin)
