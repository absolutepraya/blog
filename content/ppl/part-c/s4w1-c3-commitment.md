---
title: "[S4, W1] PPL: Twelve MRs in Seven Days While Holding the Quality Bar"
date: 2026-05-13
description: "Twelve authored MRs, ten direct main commits, one substantive review, two security incidents responded to within 24 hours. The cadence held without breaking the floor metrics: zero force-pushes, zero merges with red CI, zero stale branches at end of week."
tags: ["ppl", "commitment", "work-ethic"]
slug: "s4w1-commitment"
toc: true
---

## Output Summary

Sprint 4 Week 1 (May 7 to 13, 2026) delivery:

| Metric | Count |
|--------|------:|
| MRs authored & merged | 12 |
| Direct main commits | 10 |
| MRs reviewed (substantive) | 1 |
| New service built end-to-end | 1 (sira-mr-bot) |
| Security incidents responded to | 2 (TanStack supply chain + RBAC) |
| Lines of integration test added | 437 (RBAC) |
| Force-pushes to main | 0 |
| MR merges with red CI | 0 |
| Stale branches at week end | 0 |

The week's headline: a new FastAPI service shipped from zero to production-running with strict TDD discipline (8 modules with paired red-green commits), plus a same-week security response to the TanStack npm supply-chain attack (Snyk reported May 11, our pin-all-deps MR merged May 12).

## The Twelve MRs

```
!275  SIRA-354 feat(mr-bot): replace CI-status card with MR-content card
!276  SIRA-355 fix(mr-bot): edge-case hardening
!286  SIRA-356 fix(mr-bot,infra): deploy without sudo and route via sira-api nginx
!288  SIRA-356 fix(ci): make mr-bot:deploy self-sufficient and inject env vars
!292  SIRA-361 feat(mr-bot): put author ping inside the embed Author field
!293  SIRA-362 feat(mr-bot): drop merge follow-up ping + recover from deleted cards
!294       fix(mr-bot): restore floating @ping above the embed
!295  SIRA-353 feat(web): add React Doctor scan in CI quality stage
!296       feat(mr-bot): enforce plain-paragraph summary format
!299  SIRA-365 chore(deps): pin all deps + add 24h install cooldown
!300  SIRA-364 feat(api): RBAC expansion & hardening (BE + docs)
!303  SIRA-366 chore(web): improve React Doctor score
```

Eight of these are the mr-bot service in stages (initial build, edge-case hardening, infra integration, three iterations on Discord ping placement, summary format enforcement). Two are quality work on the React side (React Doctor gate + score improvements). One is the supply-chain security response. One is the RBAC expansion.

The mr-bot stack happened in roughly this order across the week:

- **Day 1 (May 10)**: !275 initial build, 22 commits with 8 red-green pairs, merged
- **Day 2 (May 11)**: !276 edge-case hardening with 4 more red-green pairs, plus !286 (infra fix)
- **Day 3 (May 12)**: !288 (CI deploy fix), !292 (ping placement attempt 1), !293 (revert + recovery from deleted cards), !294 (ping placement attempt 2), !295 (React Doctor gate), !296 (paragraph enforcement), !299 (deps pin)
- **Day 4 (May 13)**: !300 (RBAC), !303 (React Doctor score)

Day 2 and Day 3 were the highest-density days. Each MR went through CI before merge; none merged red.

## Sustained TDD Across Twelve MRs

The TDD discipline I wrote about in b1 didn't apply only to the initial mr-bot build (!275). The 22 commits there with 8 red-green pairs are the visible part. The harder-to-see part is that the *follow-up* MRs also kept the discipline:

- **MR !276 (edge-case hardening)**: 4 more red-green pairs. The fixes could have been one-liners; they went through tests first.
- **MR !293 (recover from deleted cards)**: red test for "Discord 404 on PATCH → re-post a fresh card" before the recovery logic landed.
- **MR !295 (React Doctor)**: not red-green per se (it's a CI configuration change, not application code), but the configuration went through a soft-fail rollout with the explicit decision documented in the MR description, not "let's see what happens."
- **MR !300 (RBAC)**: 437 lines of integration tests across PARTIAL invoice hardening, field allowlist, AR_STAFF capabilities. Each test seeds real DB rows, so the assertions verify actual behavior, not mock behavior.

The discipline didn't relax just because the week was busy. The two reverts on the ping placement (`75b187ca`, `37ebf290`) are visible in pre-squash history; they're real revert commits, not force-push erasures. The fact that I walked back a design decision twice in one week and *both walk-backs are in git* is the discipline marker, not the absence of walk-backs.

## Direct Main: Scoped to Infra, Not Used as a Shortcut

Ten direct main commits, all scoped to dev tooling / CI / docs:

```
5a2bd625 docs: refresh AGENTS.md across root, apps/api, apps/web
cca07ae1 refactor(infra): rename superset-* to wt-* across SIRA
e2b63141 chore(infra): remove conductor + superset GUI configs (wt is canonical)
a4f0c61e fix(ci): pin supabase CLI version to prevent postgres image tag drift
99aab08b feat(scripts): name superset containers after worktree
8d865ef6 feat(scripts): align superset port allocation with wt slot offsets
e6a67589 chore: lower pre-push process priority
458e1324 chore: cap pre-push test workers
66e6d4d5 chore(tooling): drop supabase/sonarqube MCP and allow main pushes
1da5d418 chore(wt): add .wt/config.toml for universal worktree CLI
```

The pattern: every one of these touches dev tooling, infra config, docs, or CI, not product code. The supabase CLI pin (`a4f0c61e`) is the highest-leverage one; it unblocked every subsequent integration-test job across the team. Putting it through an MR would have delayed the fix by one CI cycle for zero review value.

The discipline isn't "never push to main." It's "every push to main has to pass the test 'would a teammate reasonably object to this not going through review?' applied honestly." None of these ten meet that bar.

## Floor Metrics Held

A few signals from the week:

- **Zero force-pushes** to main or to any of the 12 MR branches. Every walk-back (two reverts on the ping placement) is visible.
- **Zero merges with red CI.** Every MR had a green pipeline at merge time. The 85% new-code coverage gate blocked one early push of MR !275; I added the missing coverage and re-pushed.
- **Zero stale branches.** All 12 MRs had `should_remove_source_branch=true`, so source branches were auto-deleted on squash. At week end, my namespace had only `abhip/manila` (current week's worktree), no orphans.
- **Zero post-merge regressions** from my MRs. The mr-bot service has been running on Nashta since May 11 without errors in production logs.

These are floor metrics, not ceiling ones. The point is that twelve MRs in seven days didn't come at the cost of any of them.

## Time Allocation

Realistic estimate for the week:

- sira-mr-bot service (!275, !276, !286, !288, !292, !293, !294, !296): 12 hours (the biggest chunk, including TDD iterations, infra integration, and three rounds of Discord ping debugging)
- React Doctor + score cleanup (!295, !303): 3 hours
- Security response (!299 pin all deps): 1.5 hours
- RBAC expansion (!300): 4 hours (most of which is the 437-line integration test suite)
- CI fixes + dev tooling direct commits: 2 hours
- One substantive review (!268 diagnostic): 30 minutes (after my own fix on main was already verified)

Total: roughly **23 hours** of focused project work over seven days.

## Same-Week Security Response

The TanStack supply-chain attack hit Snyk's blog on May 11. MR !299 (pin all deps + 24h cooldown) merged on May 12. That's ~24-hour turnaround between "external incident reported" and "structural fix in main." The fix is documented in b6 (security); the commitment marker is that the response landed in the same sprint week the news broke, not a sprint later.

Speed mattered here for a real reason: our app uses `@tanstack/react-router` and `@tanstack/react-query` directly. Every day we waited was another day where running `pnpm install` could have pulled a malicious version. The fix is structural (the `minimum-release-age=1440` setting defends against the *next* unknown attack too), but the timing was the part that required commitment.

## What Sustained Commitment Looked Like This Week

Two patterns I think generalize:

**Land the long thing without breaking the short things.** The mr-bot service was a multi-day build; landing it in stages (initial, edge cases, infra integration, three ping iterations) meant ~8 MRs all related to one feature. While that was happening, security (!299) and RBAC (!300) couldn't wait. Both halves got done; neither dropped.

**Discipline through revert cycles.** The Discord ping placement went through four iterations. The discipline isn't "got it right on attempt 1"; it's "every iteration went through the same merge pipeline as the original, with two real revert commits visible in history, no force-pushes hiding the wrong calls." A week where I walk back two design decisions cleanly is healthier than a week where I rewrite history to look like I never made them.

## What's Next

The mr-bot is running but a few post-merge ops items remain (DNS, nginx vhost, certbot, GitLab CI variables, users.json populated with the 9 team members' Discord IDs). These are documented in `services/sira-mr-bot/README.md` and in the MR !275 description. None blocks the team; they unlock the bot firing on real MRs for everyone (not just my MRs, which were used as the test corpus).

## Evidence

- 12 authored MRs: [!275](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/275), [!276](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/276), [!286](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/286), [!288](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/288), [!292](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/292), [!293](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/293), [!294](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/294), [!295](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/295), [!296](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/296), [!299](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/299), [!300](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/300), [!303](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/303)
- 1 reviewed MR (substantive): [!268](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/268)
- 10 direct main commits: `5a2bd625`, `cca07ae1`, `e2b63141`, `a4f0c61e`, `99aab08b`, `8d865ef6`, `e6a67589`, `458e1324`, `66e6d4d5`, `1da5d418`
- Revert commits in pre-squash history: `75b187ca`, `37ebf290`
- Filtered MR list: [GitLab merge requests deployed 2026-05-07 to 2026-05-14](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests?scope=all&state=merged&author_username=absolutepraya&deployed_after=2026-05-07&deployed_before=2026-05-14)
- External incident reference: [Snyk: TanStack npm Packages Compromised (2026-05-11)](https://snyk.io/blog/tanstack-npm-packages-compromised/)
