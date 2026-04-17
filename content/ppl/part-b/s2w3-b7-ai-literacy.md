---
title: "PPL: AI at Different Cognitive Distances [Sprint 2, Week 3]"
date: 2026-04-15
description: "Two weeks of AI-heavy work across six distinct patterns: iterative CI debugging, infrastructure design, bulk test generation, tricky bash composition, cross-agent documentation research, and context engineering via CLAUDE.md. The common thread is that the AI's usefulness depends on the cognitive distance to the task."
tags: ["ppl", "ai-literacy", "claude-code", "mutation-testing"]
slug: s2w3-ai-literacy
toc: true
---

## What I Worked On

Two weeks where AI was the primary productivity multiplier across very different task shapes. Week 1 leaned on iterative CI debugging (ten MRs of "run pipeline, read failure, ask AI, apply fix") and integration-test infrastructure design. Week 2 leaned on bulk test generation (400+ mutation-killing assertions), bash-with-tricky-primitives design (a `flock`-based slot allocator), and cross-agent documentation research. The common thread across all six patterns: AI is best when the task is a known pattern applied to new context, and weakest when the task is about how primitives interact in a specific environment.

---

## Pattern 1 (Week 1): Iterative CI Debugging

Setting up [mutmut](https://github.com/boxed/mutmut) and [Stryker](https://stryker-mutator.io/) in CI was not a one-shot task. Each configuration change revealed a new failure:

1. Wrong CLI invocation for mutmut inside a `uv` environment
2. Stryker not found because pnpm uses `node_modules/.pnpm/` not flat `node_modules/`
3. Stryker plugin resolution failure (pnpm-compatible plugin name differs from npm docs)
4. Seed tests failing under mutmut (assume clean DB state that mutations disrupt)
5. Router tests rate-limiting the CI runner under mutation load
6. Disk exhaustion from accumulated Docker artifacts

The workflow for each:

1. **Run CI** — pipeline fails with an error in the job log
2. **Describe the error to Claude Code** — paste the relevant log section + context about what step failed and what tool was involved
3. **AI proposes a fix** — usually a config change, a flag correction, or an ignore-list addition
4. **Apply and push** — a new MR
5. **Run CI again** — next failure surfaces

AI was fast at steps 2-4 because the failure modes are documented (mutmut docs, Stryker docs, pnpm workspace conventions). Providing the right context mattered more than crafting clever prompts: which tool, what environment (pnpm vs npm, uv vs pip), what the expected behavior was.

**What AI could not do**: predict which failures would come next. The sequence (pnpm exec fix → plugin discovery fix → seed test exclusion → router test exclusion) had to be discovered by running real pipelines. AI does not know our CI runner's specific pnpm version or which tests happen to be sensitive to mutation isolation.

---

## Pattern 2 (Week 1): Integration Test Infrastructure Design

MR !144 built integration test infrastructure from scratch: session-scoped `real_db` fixture, autouse `_truncate_tables` fixture, seed helpers for clients/invoices/payments.

The core design decision — truncate BEFORE AND AFTER each test, not just after — came from thinking through failure modes:

- Truncate only after: if a test aborts mid-run (import error, fixture failure), the DB stays dirty; the next test sees stale data.
- Truncate only before: works for isolation but leaves data in the DB after the suite finishes, causing false passes on re-runs that depend on "no data" preconditions.

AI helped design the `_do_truncate()` approach: connecting directly to Postgres via psycopg (PostgREST doesn't support `TRUNCATE`), using the Supabase-exposed Postgres port, and truncating in FK-safe order:

```python
_APP_TABLES = [
    "reminder_logs",
    "payments",
    "risk_scoring_logs",
    "invoices",
    "email_templates",
    "user_sessions",
    "app_users",
    "clients",
]
```

AI proposed the pattern. The human decision was verifying the psycopg direct connection would work in CI (where Supabase runs in a container on a known port), not just locally. AI cannot verify environment-specific behavior from docs alone.

---

## Pattern 3 (Week 2): Bulk Test Generation With Human-Curated Targets

Mutation-killing tests are exhausting to write manually because each one requires a specific assertion aligned to a specific surviving mutant. The workflow:

1. **Run mutmut, get the survivors list.**
2. **Cluster the survivors** by service and mutation category (operator changes, string boundary changes, default argument swaps).
3. **Prompt AI with a cluster**: "Here are 15 surviving mutants in `EmailService`. For each, write a test that asserts the specific behavior the mutant would break. Use the patterns in `test_email_service.py`."

The AI was good at step 3 because the project has strong existing test patterns. `test_email_service.py`, `test_payment_to_response.py`, and others established a vocabulary (`mock_resend_client`, `_BASE_RECORD`, `assert result.success is True and result.message_id == "res_abc123"`). Given a new mutant, AI extrapolates from those patterns.

What the AI could NOT do:

**Decide which mutants to target.** Round 3's per-method survivor targeting required reading the mutmut output and identifying which methods still had significant survivors. The signal came from the tool; the prioritization came from me. Services with business-critical logic (risk scoring, payment status transitions) got prioritized over logging-shaped mutants.

**Distinguish high-value from low-value kills.** A mutation changing `"User authenticated"` to `"User authenticated "` (trailing space) is technically killable by asserting exact message text. That kill is worth zero real-world value — it just couples the test to log message wording. AI unprompted would happily write those tests. I filtered them out.

The practical ratio: AI produced ~500 test drafts, I kept ~80% after filtering. The rejected 20% were testing implementation details (log messages, internal variable names) that would make future refactoring painful.

---

## Pattern 4 (Week 2): Tricky Bash Primitives

`scripts/ci-supabase-slot.sh` uses two bash features easy to use wrong:

1. **Automatic FD allocation**: `exec {FD}>file` (where `{FD}` is a variable name)
2. **`flock` semantics across subshells**: lock held as long as FD is open; FDs opened in subshells close when the subshell exits

When I described the requirement ("three parallel Supabase stacks, one per CI job, flock-based slot assignment") to Claude Code, it produced a structurally correct first draft that had a subtle bug. It called the lock-acquisition function like this:

```bash
SUPABASE_SLOT=$(acquire_slot)
```

And the function internally used `exec {SLOT_FD}>...`. Both parts are idiomatic bash in isolation. Together they are wrong: command substitution runs the function in a subshell, the `exec` opens the FD there, and when the subshell exits the FD closes and the lock releases.

I caught it in CI, not in code reading — two jobs both tried to bind port 54321 at the same time. The fix required changing the calling convention (function sets a shell variable rather than echoing the value) and adding a comment explaining why.

The sequence reveals AI's limit in this domain: **it knows the primitives; it does not always compose them correctly in context.** An expert bash writer would recognize `SUPABASE_SLOT=$(acquire_slot)` as suspicious the moment they saw `exec {FD}>...` inside the function body. AI did not flag the composition because each piece is idiomatic in isolation. The bug lives in the interaction.

---

## Pattern 5 (Week 2): Cross-Agent Skill Discovery Research

A third task was more about research: verifying that the project's custom skills (like `linear-management` for Linear ticket management) work across all three coding agents the team uses — Claude Code, OpenAI Codex CLI, OpenCode.

Each agent has its own skill discovery system:

| Agent | Skill Search Path | Command Search Path |
|-------|-------------------|---------------------|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `.claude/commands/<name>.md` |
| Codex CLI | `.agents/skills/<name>/SKILL.md` | N/A (uses skills) |
| OpenCode | `.claude/skills/` AND `.agents/skills/` | `.opencode/commands/<name>.md` |

The project already had `.agents -> .claude` as a symlink and `.opencode/commands -> ../.claude/commands`. Everything was already cross-agent-compatible via symlink indirection. But I only discovered that AFTER asking AI to research each agent's docs, drafting a sync plan, and then accidentally breaking `.claude/skills/` by creating a self-referencing symlink (the `.agents -> .claude` symlink meant my `mkdir -p .agents/skills` silently created `.claude/skills/`, then the subsequent `ln -s` turned it into a loop).

AI was useful for the research phase: fetching and summarizing skill directory conventions from three different doc sites in parallel. The symlink interaction bug was the same shape as the bash composition bug from pattern 4 — AI read each agent's docs correctly in isolation; it did not predict that `.agents -> .claude` would turn my mkdir into a silent modification of `.claude/skills/`.

Fix: `git restore .claude/skills/` after realizing no code changes were needed. The investigation was still valuable — it confirmed the cross-agent setup already works and documented exactly which paths each agent reads.

---

## Pattern 6 (Week 2): CI Slot Debugging Across Four Production Bugs

The initial version of `ci-supabase-slot.sh` worked in theory. The CI runner found four more bugs that required defensive additions — cross-user permissions, orphan containers from unknown project IDs, inbucket port 54324 collision, and (later) more edge cases. Each followed the same iterative-debugging loop as pattern 1, but at a higher level of environment specificity.

AI proposed each fix after I described the symptom in the runner log. The key was **describing the failure in terms of what the tool produced** ("Supabase start fails with 'port 54324 already in use' even after my port sweep"), not in terms of what I wanted done. That lets the AI propose alternatives (add inbucket to `--exclude`, extend port sweep) instead of just executing a guessed fix.

---

## Context Engineering via CLAUDE.md and `.claude/rules/personal.md`

Running alongside all six patterns was a meta-task: updating `CLAUDE.md` and `.claude/rules/personal.md` with specific patterns from each week's work.

MR !142 updated project-level `CLAUDE.md` with staging Supabase connection details (pooler URL, IPv4 vs IPv6 constraint), integration test marker conventions, the mutmut ignore list rationale, and SonarQube coverage merging approach. `.claude/rules/personal.md` got the `resource_group` pattern for Supabase-dependent jobs, the `glab api` command for reading MR discussions, and the convention for posting review threads as GitLab discussions.

This is the meta-level AI skill: a well-maintained instruction file is worth more than a clever prompt because it persists across sessions. Writing a good prompt helps one conversation. Writing a good CLAUDE.md helps every future conversation on the project.

Concrete payoff: next time I start a new session on SIRA, Claude Code knows how to run mutmut against our specific test layout without re-asking. Cross-agent commands like posting GitLab review threads use the right API surface on the first attempt. Future sessions start from the context that previous sessions had to construct.

---

## Results Across Six Patterns

| Pattern | Task | AI Role | Human Role |
|---------|------|---------|-----------|
| 1 | Iterative CI debugging (10+ MRs) | Generated fixes for each failure | Ran pipelines, identified failure context |
| 2 | Integration test infrastructure | Proposed autouse fixture + psycopg approach | Verified psycopg port logic in CI |
| 3 | 400+ mutation-killing tests | Generated 500+ test drafts from patterns | Prioritized targets, filtered low-value kills |
| 4 | `ci-supabase-slot.sh` bash script | Drafted flock + trap structure | Caught subshell FD bug, added intent comments |
| 5 | Cross-agent skill research | Fetched 3 agent docs in parallel | Caught symlink loop, used existing `.agents -> .claude` |
| 6 | CI slot production debugging | Proposed fixes for 4 environment-specific bugs | Ran pipelines, identified failure context |
| Meta | CLAUDE.md / personal.md context | N/A (human-written) | Distilled learnings into persistent context |

---

## The Common Thread

AI's usefulness correlates with the cognitive distance between a known pattern and the specific task:

- **Close distance** (bulk test generation, CI config fixes following documented behavior): AI is ~10x productivity multiplier.
- **Medium distance** (integration test fixture design, bash slot allocator): AI produces a useful draft, human validates environment-specific behavior.
- **Far distance** (composition of bash primitives in a specific calling convention, symlink interactions in a specific directory structure): AI gets each piece right individually but misses how the pieces interact. Human catches the bug in production.

The skill is not "ask AI better." The skill is knowing in advance which distance you're at and matching your review depth accordingly.

---

## Evidence

- MR !142 — docs: update CLAUDE.md with CI/testing/staging Supabase learnings
- MR !144 — [SIRA-242](https://linear.app/ppl-sira/issue/SIRA-242): integration test infrastructure
- MR !145, !146, !147, !148, !152, !158, !159 — week 1 CI mutation testing series
- MR !183, !184, !185, !197 — week 2 mutation testing + parallel Supabase slots
- Commit `b8930639` — test(api): 200+ mutation-killing unit tests
- Commit `fe69e036` — test(api): round 3 per-method survivor targeting
- Commit `1b5a697d` — chore(ci): add ci-supabase-slot.sh
- Commit `00bfa6ea` — chore(ci): fix ci-supabase-slot.sh subshell FD bug
- Cross-agent skill discovery: `.agents -> .claude` symlink, `.opencode/commands -> ../.claude/commands` symlink
- Source: `apps/api/tests/conftest.py`, `apps/api/pyproject.toml`, `scripts/ci-supabase-slot.sh`, `.gitlab-ci.yml`, `.claude/rules/personal.md`
