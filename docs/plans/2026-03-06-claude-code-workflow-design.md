# Blog Post Design: How I Use Claude Code

**Date:** 2026-03-06
**Type:** Single comprehensive post (~3500 words)
**Audience:** Engineers already using AI (Copilot/Cursor) but not CLI-native AI workflows
**Tone:** Casual English, conversational, first-person. Not formal, not cringe.

## Title Options

- "How I Actually Use Claude Code"
- "My Development Workflow with Claude Code"
- "Claude Code Changed How I Write Software"

(Final title TBD at writing time)

## Structure

### 1. Opening Hook (~200 words)

- The trigger: friends/peers keep asking "how do you work with Claude Code?"
- Quick context: use it for everything - personal projects, internship work, VPS management
- What this post is: a walkthrough of the real workflow, not a feature list

### 2. Why Claude Code Over IDE Tools (~400 words)

Key insight: CLI-native = agent, not autocomplete layer.

Points to cover:
- Copilot/Cursor suggest code inside your editor. Claude Code runs in your terminal as a full agent - reads codebase, executes commands, manages git, talks to external services via MCP
- It's not "AI writes code for me" - it's a structured engineering process with discipline baked in
- Real scale example: aiccountant project with 800-line CLAUDE.md, 9 custom slash commands, session hooks, 5 custom subagents, 14+ per-package CLAUDE.md files

### 3. The Workflow: Idea to Shipped Code (~1200 words)

Walk through a real feature development session. This is the core of the post.

#### Brainstorming
- Describe what you want in plain language
- Claude asks clarifying questions one at a time (not a wall of questions)
- Proposes 2-3 approaches with trade-offs and a recommendation
- Writes a design doc, gets approval section by section
- Hard gate: no code until design is approved

#### Planning
- Design approved -> breaks into bite-sized tasks (2-5 minutes each)
- Each task has: exact files to touch, complete code snippets, verification steps
- Assumes reader has zero context - everything explicit
- Saved as a plan doc that can be executed in a separate session

#### Execution
- Two modes: subagent-driven (same session) or executing-plans (separate session)
- Subagent-driven: dispatches a fresh agent per task
  - Each agent does TDD: write failing test -> implement -> verify
  - Then spec compliance review (did it match the plan?)
  - Then code quality review (is it good code?)
  - Two-stage review prevents both under-building and over-building
- Can run in isolated git worktrees for safety

#### Debugging
- When something breaks: systematic-debugging skill activates
- 4 phases: root cause investigation -> pattern analysis -> hypothesis testing -> implementation
- No "just try changing X" - must understand before fixing
- Real example: Vite error with no error message, solved through systematic tracing
- If 3+ fixes fail: stop and question architecture (it's not an implementation bug)

#### Finishing
- verification-before-completion: must run actual commands and show output before claiming done
- No "should work now" or "probably passes"
- finishing-a-development-branch: presents options (merge, PR, keep, discard)
- Clean up worktree, report what was done

### 4. The Infrastructure (~800 words)

What makes the workflow possible.

#### CLAUDE.md - Your Project's Brain
- Not just rules - philosophy, pitfalls, workflow docs, common mistakes
- Layered approach: root CLAUDE.md for monorepo-wide, per-package CLAUDE.md for specifics
- Evolves with the project (aiccountant has 19+ commits to CLAUDE.md alone in the PPL project)
- Example content: git operations policy, API integration patterns, file naming, component props

#### Slash Commands - One-Word Workflows
- /execute: creates staff-level execution plans with scope, tracks, complexity estimates
- /work: picks highest-priority task from backlog, tracks progress
- /create-pr: triggers GitHub Actions workflow for PR creation
- /analyze-pr-feedback: extracts actionable tasks from PR reviews
- Custom per-project, stored in .claude/commands/

#### MCP Servers - External Service Integration
- Linear: issue tracking, ticket creation, status updates
- Todoist: task management with custom formatting
- Exa: web search for research
- Context7: library/framework documentation lookup
- Telegram, Gmail, Google Calendar: communication integration
- Firecrawl: web scraping
- Karakeep: bookmark management
- Not just "plugins" - real bidirectional integrations that Claude uses autonomously

#### Plugins
- Superpowers: the workflow engine (14 skills that chain together)
- Claude HUD: real-time statusline showing context usage, active tools, agent tracking, todo progress
- notification-go: desktop notifications + sounds when Claude needs input (plan ready, question, review, done, error)
- feature-dev: feature development workflow automation
- claude-md-management: CLAUDE.md file auditing and improvement

#### Hooks - Automated Checks
- Post-edit validation: checks IDE diagnostics after every file edit
- Session-end: extracts learnings from session transcripts (compound engineering)
- Session-start: initializes superpowers workflow context

### 5. Bonus: The Mobile Setup (~300 words)

- Tailscale VPN connects phone to VPS (no public SSH exposure)
- mosh for persistent, low-latency terminal sessions (survives network switches)
- Termius SSH app on phone
- "I literally wrote parts of this post from my phone"
- The VPS runs Claude Code directly - no need for a powerful local machine

### 6. Closing (~100 words)

- This setup evolved over months, not built in a day
- Start simple: CLAUDE.md + a couple MCPs
- The compound effect: each piece makes the others more powerful
- Link to the PPL-specific post for deeper dive on a real project

## Screenshots Needed

1. **Claude HUD** - statusline showing model, context bar, git status, usage
2. **Brainstorming session** - the back-and-forth question flow
3. **Subagent execution** - agents dispatching and working on tasks
4. **Systematic debugging** - the investigation flow (phases visible)
5. **Phone terminal** - Termius app showing Claude Code running via mosh

## Front Matter

```yaml
title: TBD
date: 2026-03-06
description: "A walkthrough of how I use Claude Code as my primary development tool - from brainstorming to shipping, with custom skills, MCP integrations, and a mobile VPS setup."
tags: ["claude-code", "ai", "developer-tools", "workflow"]
toc: true
```

## Writing Constraints

- No em dashes
- No emoji
- Casual English, conversational first-person
- Show don't tell - concrete examples over abstract claims
- Code blocks for commands and configs
- Mermaid diagrams where they help (workflow flow)
