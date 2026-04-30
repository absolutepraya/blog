---
title: "[S2, W2] PPL: AI Literacy"
date: 2026-03-30
description: "Using Claude Code strategically for complex bash scripting, service design, and meta-level tooling in Sprint 2 Week 2."
tags: ["ppl", "ai-literacy", "claude-code"]
slug: s2w2-ai-literacy
toc: true
---

## What I Worked On

With 19 MRs landing this week across CI scripting, application features, and infra fixes, AI assistance was involved throughout. The most interesting usage this week was not code generation but rather iterative verification: describe what the output should look like, generate, run against real CI output, observe differences, fix, repeat.

---

## AI for Complex Bash Scripting

The CI report scripts (`scripts/ci-report.sh`) grew from 0 to 356 lines in MR !126 alone, and another 111 lines across !129, !132, and !140. Writing bash that parses CI job output, formats it as GitLab-flavored markdown, and posts it via the GitLab API is exactly the kind of code that AI handles well — repetitive structure, lots of string manipulation, easy to verify.

The workflow looked like this:

1. Describe the desired MR comment format (markdown table, emoji status, collapsible `<details>` for green results)
2. AI generates the parsing function for that CI job's output
3. Run the script against a real CI log from a recent pipeline
4. Compare actual output with expected comment format
5. Identify mismatches (ANSI escape codes not stripped, wrong field extracted) and fix with AI
6. Repeat until the comment renders correctly in GitLab

This iterative approach worked because the correctness criterion was concrete and observable: does the rendered comment in GitLab look right? AI was fast at generating boilerplate and fixing specific diffs; human judgment was needed to evaluate the visual output and identify what the next iteration should change.

One concrete example: the initial `fmt_sonar` function parsed the SonarQube JSON response incorrectly, pulling the wrong field for coverage. Pointing at the actual JSON structure with "this field, not that one" fixed it in one round.

---

## AI for Application Logic

**SIRA-214 session management** (MR !120) involved some non-trivial design decisions: how to handle the session limit (kick oldest vs. reject new), whether to upsert or error on duplicate session ID, what fields to expose in the API response. I used AI to brainstorm the tradeoffs for each. The final implementation (upsert existing, kick oldest when at capacity) came from evaluating AI-generated options against the UX requirement that users shouldn't be silently logged out.

```python
# Enforce limit: kick oldest if at capacity
if len(active_sessions) >= MAX_SESSIONS:
    oldest = active_sessions[-1]  # ordered desc by last_active_at
    await user_sessions_queries.deactivate_session(self.db, oldest["id"])
```

**SIRA-160 email integration** (MR !108) involved Jinja2 template rendering and the Resend HTTP API. AI generated the initial `EmailTemplateService` structure, which I then reviewed and trimmed. The key edit was separating rendering from transport: AI's first version had both in one class, which violated SRP. I caught this and asked for a refactor before committing.

---

## Meta-Level: Building a Claude Code Skill

This week I created a `linear-management` skill for Claude Code, which is AI improving the AI workflow. The skill codifies the correct way to manage Linear tickets in this project (naming conventions, team key, known MCP bugs). Now any future Claude session automatically picks up these project-specific instructions without me needing to re-explain them.

This is strategic AI use: the ROI of writing one skill once is paid back on every session that uses it.

---

## What AI Didn't Handle Well

CI runner environment differences. Several times during the CI script work, code that generated correct output locally produced different results in the actual runner (different bash version, PATH issues, ANSI escaping differences between `tee` and direct output). AI's suggestions for these issues were hit-or-miss because the runner environment differs from what it knows. Manual SSH + debugging was faster for these.

---

## Results

| Task | AI role | Human role |
|------|---------|------------|
| `ci-report.sh` bash scripting | Generated all parser functions | Verified output, caught field mismatches |
| Session service design | Proposed design options | Made tradeoff decision |
| Email template service | Generated initial structure | Caught SRP violation, refactored |
| Linear management skill | Drafted skill content | Reviewed and finalized |
| CI runner debugging | Suggestions hit-or-miss | Manual debugging for env differences |

---

## Evidence

- MR !126 — ci-report.sh (356 lines added), `scripts/ci-report.sh`
- MR !129, !132, !140 — continued ci-report.sh iteration
- MR !120 — [SIRA-214](https://linear.app/ppl-sira/issue/SIRA-214) session management service
- MR !108 — [SIRA-160](https://linear.app/ppl-sira/issue/SIRA-160) email integration
- Commit `81cce25` — `chore: add linear-management skill`
