---
title: "PPL: AI for Mutation Tests, Bash, and Cross-Agent Research [Sprint 3, Week 1]"
date: 2026-04-15
description: "Three AI patterns this week: bulk test generation (400+ mutation-killing tests with human-curated targets), bash script design (flock FD semantics where AI missed a subshell bug), and multi-agent documentation research (verifying skill portability across Claude Code, Codex, and OpenCode)."
tags: ["ppl", "ai-literacy", "claude-code"]
slug: s3w1-ai-literacy
toc: true
---

## What I Worked On

Two AI-heavy tasks this week: writing 400+ mutation-killing tests across two rounds (commits `b8930639` and `fe69e036`), and designing `scripts/ci-supabase-slot.sh` with tricky `flock` + file descriptor semantics (commits `1b5a697d` and `00bfa6ea`). They represent two different AI usage patterns, which is why I'm writing about them together.

---

## Pattern 1: AI for Bulk Test Generation with Human-Defined Targets

Mutation-killing tests are exhausting to write manually because they require specific assertions that align with specific surviving mutants. The workflow looks like this:

1. **Run mutmut, get the survivors list.**
2. **Cluster the survivors by service and by mutation category** (operator changes, string boundary changes, default argument swaps, branch removal).
3. **Prompt the AI with a cluster**: "Here are 15 surviving mutants in `EmailService`. For each, write a test that asserts the specific behavior the mutant would break. Use the existing test patterns in `test_email_service.py`."

The AI is good at step 3 specifically because the project has strong existing test patterns. `test_email_service.py`, `test_payment_to_response.py`, and others established a vocabulary: `mock_resend_client`, `_BASE_RECORD`, `assert result.success is True and result.message_id == "res_abc123"`. Given a new mutant, the AI extrapolates from those patterns to produce a test that matches both the project's style and the specific mutation being killed.

What the AI could NOT do:

**Decide which mutants to target.** The per-method survivor targeting in round 3 required reading the mutmut output and identifying which methods still had significant survivors after round 2. The signal (which function, how many survivors) came from the tool, and the decision (which to prioritize) came from me. Services with more business-critical logic (risk scoring, payment status transitions) got prioritized over services with more logging-shaped mutants (email sending).

**Distinguish high-value kills from low-value kills.** A mutation that changes a log message string from "User authenticated" to "User authenticated " (trailing space) is technically killable by asserting the exact message. That kill is worth zero real-world value. The AI, unprompted, would happily write tests for those. I had to filter its output before accepting it.

The practical ratio across the 400+ tests: the AI produced maybe 500+ test drafts, and I kept around 80% after filtering. The rejected 20% were either testing implementation details (exact log messages, exact internal state variable names) that would make the code harder to refactor later, or duplicating existing test coverage under a different mutation category.

---

## Pattern 2: AI for Bash With Tricky Primitives

The `ci-supabase-slot.sh` script uses two bash features that are easy to use wrong:

1. **Automatic file descriptor allocation**: `exec {FD}>file` (where `{FD}` is a variable name, not a number)
2. **`flock` semantics across subshells**: the lock is held as long as the FD is open, but FDs opened in subshells close when the subshell exits

Claude Code, when I described the requirement ("three parallel Supabase stacks, one per CI job, flock-based slot assignment"), produced a first draft that was structurally correct but had the subshell bug I described in this week's b2 programming blog. Specifically, it called the lock-acquisition function like this:

```bash
SUPABASE_SLOT=$(acquire_slot)
```

And the function internally used `exec {SLOT_FD}>...`. Both parts in isolation are correct bash. Together, they are wrong: command substitution runs the function in a subshell, the `exec` opens the FD in the subshell, the subshell exits returning the integer slot number, and the FD closes. The lock releases immediately.

I did not catch this from reading the code. I caught it in CI, where two jobs on "different slots" somehow both tried to bind port 54321 at the same time. The Supabase CLI printed "port already in use" on one of them, I re-read the script, noticed the command substitution, and realized what had happened.

The fix required changing the function's calling convention (set a shell variable rather than echo the value) and adding an explicit comment explaining why the new shape exists. When I fed the fix back to Claude Code with "this fixes a real bug — the function was being called in command substitution and the flock FD was leaking into a subshell," it correctly identified what I had figured out and produced the refactored version.

The sequence shows AI's limit in this domain: **it knows the primitives, it does not always compose them correctly in context.** An expert bash writer would recognize the `SUPABASE_SLOT=$(acquire_slot)` pattern as suspicious the moment they saw `exec {FD}>...` inside the function body. The AI did not flag it as suspicious because, in isolation, both patterns are idiomatic. The bug lives in the interaction.

---

## What Changed in How I Prompt

This week pushed me toward a more structured way of prompting for CI and test work:

**For bulk tasks (mutation tests):** give the AI the full context upfront — the mutmut output for a cluster of mutants, the existing test file that establishes the pattern, the list of which services to target. Then ask it to produce the tests in that style. Review heavily before accepting.

**For design tasks (bash script, complex config):** ask the AI to produce an initial draft, then probe for failure modes it did NOT consider. The prompt "what happens if this function is called in command substitution?" would have surfaced the bug before CI did. I did not ask that question on the first iteration, and CI paid for it.

**For walk-backs (MR !186 → !187):** describe the problem in terms of the signal the tool returns, not in terms of what I want done. "Stryker still takes 28 minutes after removing the TS checker, which is too slow to block MRs" lets the AI propose the walk-back shape (manual + allow_failure). Saying "revert to manual" would have gotten me there but with less discussion of alternatives.

---

## Pattern 3: AI for Cross-Agent Skill Discovery Research

A third AI task this week was less about code and more about research: verifying that the project's custom skills (like `linear-management` for Linear ticket management) work across all three coding agents the team uses: Claude Code, OpenAI Codex CLI, and OpenCode.

Each agent has its own skill discovery system:

| Agent | Skill Search Path | Command Search Path |
|-------|-------------------|---------------------|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `.claude/commands/<name>.md` |
| Codex CLI | `.agents/skills/<name>/SKILL.md` | N/A (uses skills) |
| OpenCode | `.claude/skills/` AND `.agents/skills/` | `.opencode/commands/<name>.md` |

The project already had `.agents -> .claude` as a symlink and `.opencode/commands -> ../.claude/commands`. So all skills and commands were already available to all three agents through symlink indirection. But I only discovered this AFTER asking AI to research each agent's docs, drafting a sync plan, and then accidentally breaking `.claude/skills/` by creating a self-referencing symlink inside it (the `.agents -> .claude` symlink meant my `mkdir -p .agents/skills` created `.claude/skills/`, then my `ln -s` turned it into a loop).

The AI was useful for the research phase: fetching and summarizing the skill directory conventions from three different documentation sites in parallel. But the symlink interaction bug was exactly the kind of context-dependent composition error from Pattern 2. AI read the docs correctly for each agent in isolation; it did not predict that `.agents -> .claude` would turn `mkdir -p .agents/skills` into a silent modification of `.claude/skills/`.

The fix was `git restore .claude/skills/` after realizing no code changes were needed. The investigation was valuable anyway: it confirmed the cross-agent architecture is already working and documented exactly which paths each agent reads.

---

## The CLAUDE.md Feedback Loop

A related piece of AI literacy: this week I also updated `.claude/rules/personal.md` with specific patterns from the CI work. Things like:

- The `resource_group` pattern for serializing Supabase-dependent jobs, and when to move past it
- The `glab api` command pattern for reading MR discussions
- The convention for posting review threads (GitLab discussions) rather than plain comments

These additions mean the next session starts with the right mental model for SIRA's CI and review conventions. Without them, Claude Code would suggest generic GitLab review patterns, not the ones specific to this project's workflow.

This is the meta-level AI skill: a well-maintained instruction file is worth more than a clever prompt, because it persists across sessions. Writing a good prompt helps one conversation. Writing a good CLAUDE.md helps every future conversation on this project.

---

## Results

| Task | AI Role | Human Role | Outcome |
|------|---------|------------|---------|
| 400+ mutation-killing tests | Generated 500+ test drafts from patterns + mutant lists | Prioritized targets, filtered low-value kills | Mutation score ~66% → ~80% |
| `ci-supabase-slot.sh` | Drafted script structure, wrote initial bash primitives | Caught subshell bug, enforced trap ordering, added intent comments | 92-line script that hardened against partial failure |
| MR !186 walk-back | Proposed `when: manual` + `allow_failure` shape | Framed the problem as "28 min is still too slow" | Quick revert MR (!187), no latency cost |
| Cross-agent skill sync | Fetched 3 agent docs in parallel, identified skill paths | Caught symlink loop, verified existing `.agents -> .claude` setup | Confirmed all skills work in all 3 agents with zero changes |
| `.claude/rules/personal.md` updates | N/A (human-written) | Distilled CI review conventions into persistent instructions | Future sessions know the gitlab discussion pattern |

---

## Evidence

- Commit `b8930639` — test(api): 200+ mutation-killing unit tests
- Commit `fe69e036` — test(api): round 3 per-method survivor targeting
- Commit `1b5a697d` — chore(ci): add ci-supabase-slot.sh
- Commit `00bfa6ea` — chore(ci): fix ci-supabase-slot.sh subshell FD bug
- Cross-agent skill discovery: `.agents -> .claude` symlink, `.opencode/commands -> ../.claude/commands` symlink
- Source: `apps/api/tests/test_*_service.py`, `scripts/ci-supabase-slot.sh`, `.claude/rules/personal.md`
