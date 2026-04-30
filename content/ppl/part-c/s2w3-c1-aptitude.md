---
title: "PPL: New Things Learned and Applied [Sprint 2, Week 3]"
date: 2026-04-15
description: "Mutation testing across two languages, parallel-shard CI architecture using flock, and structured CI report comments. Three substantial learnings this week, none of them taught in any Fasilkom course, all applied directly to SIRA."
tags: ["ppl", "aptitude", "learning", "mutation-testing", "ci"]
slug: s2w3-aptitude
toc: true
---

## Overview

Sprint 2 Week 3 (April 9 to 15) was a CI-and-testing-infrastructure week. Five MRs merged in seven days (!183, !184, !185, !186, !187), three direct-to-main commits, all centered on operationalizing mutation testing in our pipeline. The interesting Part C angle is not what landed but what I had to learn first. Three new things this week, all outside standard coursework, all applied directly to the project.

---

## 1. Mutation Testing as a Quality Signal Beyond Coverage

Mutation testing was the centerpiece of the week. Coverage measures *which lines run*, not *whether the assertions actually verify behavior*. A test suite with 91% coverage can have a 0% mutation score, meaning the tests run the code but do not catch deliberately broken versions of it. That gap is exactly what we hit on SIRA after Sprint 1.

I had to learn two mutation testing tools from scratch:

- [mutmut](https://github.com/boxed/mutmut) for Python. Operates by randomly mutating ASTs (changing `==` to `!=`, `+` to `-`, `True` to `False`, etc.) and re-running the test suite. A mutant that survives the test suite indicates a behavior the tests do not actually verify.
- [Stryker](https://stryker-mutator.io/) for TypeScript. Same concept, different language. Configured via `stryker.conf.js`, integrates with Vitest as the test runner.

Neither tool is taught in any Fasilkom course. The mutmut docs assume you know AST manipulation; the Stryker docs assume you understand pnpm workspace layouts. I had to read both from scratch to wire them into our pipeline.

The thing I did not appreciate before this week: **mutation testing is a feedback loop on test design, not a quality gate**. The first run on SIRA's API gave a mutmut score of 0% because mutmut's test runner was not actually picking up our pytest config. The score had nothing to do with our tests; it was a tooling integration bug. After fixing that (MR !184), real scores came in around 65% on the first pass, exposing tests that asserted "no exception was raised" without actually checking the returned value. Each surviving mutant became a backlog item for the team.

---

## 2. Parallel CI Sharding with `flock` and Per-Slot Supabase Stacks

The integration-test job uses `npx supabase start`, which boots a real Supabase stack (Postgres, GoTrue, PostgREST, Storage, Studio). Two MRs running this job at the same time would collide on ports and container names. The default GitLab solution is `resource_group: supabase-local`, which serializes everything to one job at a time. That made our pipeline a 25-minute critical path because integration-test, mutation-python, and mutation-typescript all needed Supabase.

I learned a different approach: **shared concurrency control via `flock`**, with each job claiming one of three pre-staged Supabase directories. Each shard has its own `config.toml` with a unique `project_id` (`sira-0`, `sira-1`, `sira-2`) and ports shifted by `N * 100`, so containers do not collide. This shipped as MR !197 (`scripts/ci-supabase-slot.sh`) the week before and got tuned this week (`SIRA-274`, direct commit `54fe8055`):

```bash
exec 200>"$LOCK_FILE"
if flock -n 200; then
    SLOT_DIR="/tmp/sira-sb/sira-$slot"
    cp -r "$SOURCE_SUPABASE_DIR" "$SLOT_DIR"
    sed -i "s/project_id = .*/project_id = sira-$slot/" "$SLOT_DIR/config.toml"
    # ... shift all ports by slot * 100 ...
fi
```

`flock` itself is a Unix primitive (advisory file locking via `fcntl(2)`) that I had only used informally before. Learning to combine it with directory staging and EXIT traps for cleanup, plus orphan-reaping for jobs that get SIGKILL'd before the trap fires, was new territory. The result: three Supabase-dependent jobs run in parallel, the slowest critical path drops from 25 minutes to about 8.

`flock` is not in any Fasilkom networking or systems course at the level needed to do this safely (the stale-lock recovery alone took two iterations of MR follow-ups). Genuinely new applied knowledge.

---

## 3. CI Report Comment Architecture with Tri-State Status

The team was glossing over CI failures because the GitLab UI requires a click into each job to see the error. I built a CI-side reporting system (`scripts/ci-report.sh`) that posts a formatted markdown comment on every MR with the actual results, color-coded with an emoji and collapse-by-default for green results.

Three concepts I had to learn for this:

**(a) GitLab `allow_failure: exit_codes:` for tri-state pipelines.** Default GitLab CI is binary (pass/fail). Real-world quality gates have a third state: "warning, do not block but flag attention." The trick is `exit_codes: [77]` in the YAML and structuring the job so:

- exit 0 → green (clean pass)
- exit 77 → yellow (warning, non-blocking)
- exit 1 → red (failure, blocks merge)

I learned this from an obscure GitLab docs page and applied it to mutation-python, schema-test, and the BDD job. None of these block merges, but all flag attention when something regresses.

**(b) `<details>` HTML inside markdown comments for collapse behavior.** GitLab markdown supports embedded HTML. Wrapping a green result in `<details><summary>` makes it auto-collapse, so a 50-line passing report does not push the rest of the MR conversation off the screen. Yellow and red results stay expanded. Subtle UX detail that changed how the team interacts with the comments.

**(c) Stripping ANSI color codes from `tee`-piped output before regex parsing.** CI output is colorized for the terminal but the codes break regex parsing for the comment formatter. The function `strip_ansi() { sed -E 's/\x1b\[[0-9;]*[mK]//g'; }` was new to me; I learned the exact escape pattern from a stackoverflow answer and verified by running real CI output through it locally before pushing.

Each `fmt_*` function in `ci-report.sh` (for `api-test`, `web-test`, `web-build`, `schema-test`, `sast`, `bdd`, `sonar`) follows the same pattern: strip ANSI, regex-parse the relevant lines, emit collapsed-or-expanded markdown. Six format functions, all built this week.

---

## What Connects These Three Learnings

The thread is **observability over output**. Mutation testing observes whether tests actually test. Parallel sharding observes (and fixes) the critical-path bottleneck. CI report comments observe what the pipeline produced and surface it where the team will read it.

Coursework tends to teach individual tools. The applied skill this week was integrating three independent systems into one feedback loop where every MR gets:

1. Mutation testing run automatically (!186)
2. Three integration-test slots running in parallel
3. A formatted comment summarizing what passed and what regressed

That integration is the work that does not show up in any single MR diff. It shows up in how the team experiences the pipeline.

---

## Evidence

- [MR !183 chore(ci): mutation testing on MR pipelines + report comments](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/183)
- [MR !184 fix(ci): mutmut 0% score + linear false tagging](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/184)
- [MR !185 fix(ci): linear false tagging + mutation score improvement](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/185)
- [MR !186 chore(ci): auto-run Stryker on MR + remove TS checker for speed](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/186)
- [MR !187 chore(ci): make mutation:typescript manual and non-blocking](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/187)
- Direct commit `54fe8055` — SIRA-274 shard Supabase CLI stacks for parallel integration-test (!197)
- Direct commit `1d957968` — feat(api): add Sentry performance spans to risk scoring, telegram, and reminder worker
- Direct commit `e7e1efa6` — chore(ci): update mutation target to 80% + add manual Stryker note
- Source: `scripts/ci-report.sh`, `scripts/ci-supabase-slot.sh`, `apps/api/pyproject.toml` (mutmut config), `apps/web/stryker.conf.js`
