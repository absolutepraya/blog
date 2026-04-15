---
title: "PPL: Development Discipline [Sprint 3, Week 1]"
date: 2026-04-15
description: "Five merged MRs and four unpushed commits this week, all CI/testing focused. The arc: auto-run mutation testing on MRs, fix mutmut's 0% score, write 400+ mutation-killing tests, tune Stryker for speed, then shard parallel Supabase stacks so CI actually scales."
tags: ["ppl", "discipline", "git-flow", "ci"]
slug: s3w1-discipline
toc: true
---

## What I Worked On

Sprint 3 Week 1 (April 9 to 15) was a focused CI/testing week. Five MRs merged and four commits on the current branch (SIRA-274, unmerged as of writing). Every piece followed the same arc: make mutation testing actually work on MR pipelines without blocking merges, then scale it so three jobs could run in parallel without stomping on each other's Supabase ports.

---

## The Five Merged MRs

| MR | Date | Commit Message | What It Changed |
|----|------|---------------|-----------------|
| !183 | Apr 9 | chore(ci): mutation testing on MR pipelines + report comments | Mutation jobs auto-run per-MR instead of main-only, posted results to MR comments |
| !184 | Apr 9 | fix(ci): mutmut 0% score + linear false tagging | Excluded integration tests from mutmut (rate-limit 429 kept killing the initial run), stopped linear-notify from scanning MR body text |
| !185 | Apr 10 | fix(ci): linear false tagging + mutation score improvement | Linear `mr-merged` scans only first line of squash commit, 400+ strengthened service tests |
| !186 | Apr 10 | chore(ci): auto-run Stryker on MR + remove TS checker for speed | Stryker auto-runs on MRs with `typescript-checker` uninstalled (vitest already kills type-invalid mutants via runtime) |
| !187 | Apr 11 | chore(ci): make mutation:typescript manual and non-blocking | Reverted Stryker back to manual after the auto-run proved too slow even without the TS checker |

This is the full iteration trail. Each MR was mergeable on its own. No long-running branches. No stacked WIPs. The shortest gap between merges was 40 minutes (!184 at 14:22 to a follow-up in !185). The iteration pace matches what the CI runner gives back: if the pipeline takes 8 to 12 minutes to surface a failure, batching changes across pipelines wastes more time than it saves.

---

## The Walking-Back Pattern (!186 then !187)

!186 made Stryker auto-run on MRs. A day later, !187 walked that decision back and made it manual again. Both are mine, both sit in the week's commit log.

This is worth showing, not hiding. The sequence was:

1. Stryker was manual because it took 38 minutes on the CI runner
2. I removed the `typescript-checker` plugin (mutants with type errors still die at runtime under vitest, so the checker was redundant)
3. With the checker gone I expected the job to drop below 20 minutes and auto-run safely
4. It dropped to around 28 minutes. Still too slow to block MR merges, still slow enough that manually clicking "play" whenever we care was the right call

Walking back a commit by writing a new commit (not a force-push, not a revert with no context) is the discipline piece. The MR title says exactly what changed and why. A reviewer looking at `!186` and `!187` in sequence can reconstruct the reasoning without asking. Nothing in git history is rewritten.

---

## Current Branch: SIRA-274 Parallel Supabase Stacks

The branch `abhip/chore/SIRA-274-parallel-ci-supabase` has four commits as of this blog. Not merged yet, but the work happened this week:

```
dba63d41 chore(ci): shard mutation:python Supabase stacks across 3 slots
8c2f9970 chore(ci): shard api:integration-test Supabase stacks across 3 slots
00bfa6ea chore(ci): fix ci-supabase-slot.sh subshell FD bug
1b5a697d chore(ci): add ci-supabase-slot.sh for parallel local Supabase stacks
```

Read bottom to top: add the script, fix a bug in it, then apply it to each job that needed to share a Supabase instance. The `resource_group: supabase-local` lines got deleted from both jobs, so `mutation:python` and `api:integration-test` can now run at the same time on the same runner with their own stacks.

The fix commit (`00bfa6ea`) sits between the introduction and the two shard commits. The bug was specific: calling `acquire_slot` inside command substitution meant the file descriptor for the `flock` got opened in a subshell and released immediately after the function returned. Fixing this required calling the function directly in the caller's scope so `exec {SLOT_FD}>...` affected the shell that would later run the job. I'll cover the full design in the b2 Programming blog for this week.

---

## Commit Quality

Conventional commit prefixes stayed consistent:

- `chore(ci):` for non-blocking pipeline changes that enable something new (auto-run, sharding, report comments)
- `fix(ci):` for pipeline bugs (mutmut 0% score, linear false tagging, FD leak)
- `test(api):` for mutation-killing test rounds (200+ tests, round 3 survivor targeting)
- `fix(web):` for the axios SSRF upgrade

No vague "update", "tweak", or "wip" messages. The worst message this week is `chore(ci): remove total CI duration from report comments` which is still actionable.

---

## Carry-Over Commits That Did Not Get Their Own MR

Some work landed as direct commits rather than separate MRs, because they were small followups:

| Commit | What It Was |
|--------|-------------|
| `2e5bc2fd` | axios 1.13.5 → 1.15.0 (GHSA-3p68-rc4w-qgx5 SSRF). Dependency bump, no logic change |
| `b8930639` | 200+ mutation-killing unit tests. Tests only, no behavior change |
| `fe69e036` | Round 3 mutation-killing tests for per-method survivors |
| `7aceb817` | fix(web): preserve numeric CSV values and reuse invoice cache for export |
| `1d957968` | feat(api): Sentry performance spans for risk scoring, telegram, reminder worker |

These sit inside merged MRs in the history above. They show up here so the week's full scope is visible. The axios upgrade in particular is security-relevant and gets its own blog under b6.

---

## Results

| Category | MR Count | Commit Count |
|----------|---------:|-------------:|
| Mutation testing CI integration | 5 | 15+ |
| Parallel Supabase sharding (current branch, unmerged) | 0 | 4 |
| Security (axios CVE) | 0 | 1 |
| Mutation-killing test suites | 0 (in MRs above) | 3+ |
| **Total attributable this week** | **5** | **~25** |

The commit count is larger than the MR count because each MR typically squashes three to five iteration commits. The feature work (Sentry spans, CSV export fix) happened in teammate MRs where I contributed commits; they are counted under the teammate's MR.

![Filtered MR list showing 5 MRs merged by Daffa Abhipraya during Sprint 3 Week 1 (April 9–16)](/images/ppl/s3w1-b3-mr-list.png)

---

## Evidence

- MR !183, !184, !185, !186, !187 — mutation testing CI series
- Branch `abhip/chore/SIRA-274-parallel-ci-supabase` — four commits on parallel Supabase sharding
- Commit `2e5bc2fd` — axios SSRF upgrade
- Source: `.gitlab-ci.yml`, `apps/api/pyproject.toml`, `scripts/ci-supabase-slot.sh`, `apps/web/stryker.config.json`
