---
title: "Three Coding Agents, One Brain"
date: 2026-03-13
description: "A walkthrough of the AI dev setup I actually use on my MacBook: Claude Code, Codex, pi, shared skills, MCP tools, Herdr workspaces, WezTerm, voice dictation, and a dotfiles-backed agent architecture."
tags: ["ai", "developer-tools", "workflow", "claude-code", "codex", "herdr"]
toc: true
numbered_headings: true
aliases:
  - /posts/claude-code-workflow/
  - /posts/macbook-agent-dev-setup/
---

People keep asking how my AI dev setup actually works. Friends, classmates, engineers I bump into - most of them don't really want a model leaderboard. They want the practical version: which tools I use, how they fit together, what runs locally on my MacBook, and how I keep the whole thing from drifting into chaos.

Short answer: I don't lean on one AI coding tool for everything. I run a shared workflow, shared instructions, shared skills, and shared commands across multiple clients. The three I reach for on the MacBook are [Claude Code](https://www.anthropic.com/product/claude-code), [Codex](https://openai.com/codex/), and [pi](https://github.com/withpi/codemode). Around them sit the supporting pieces: specialist skills, MCP tools, voice dictation, dotfiles sync, and a workspace layer that keeps sessions isolated without making the environment feel fragmented.

If you're already on [GitHub Copilot](https://github.com/features/copilot), [Cursor](https://cursor.com/), Claude Code, or Codex and curious what a CLI-first, agent-heavy workflow looks like once it grows up, this is mine.

## Why I Use Multiple Agents

I don't think one AI tool wins every category.

Some are great for deep terminal-native sessions. Some let me swap providers freely. Some are nicer on the phone. Some are best as supporting tools, not daily drivers. The thing I actually care about isn't which client I'm in - it's whether the workflow stays the same when I switch.

That's the leverage. I keep the process stable and let the tools specialize. Shared instructions, shared skills, shared commands, shared infrastructure - that means I can move between agents without restarting from zero.

Claude Code, Codex, and pi are the center of the story right now. OpenCode is deliberately deferred for me at the moment. I still like the idea of it, especially the provider flexibility, but my current local setup is built around the tools whose harnesses I actually want to live inside every day.

## The Workflow: Idea to Shipped Code

Before I get into tools, the workflow layer matters more than the client.

The biggest upgrade I made was adopting [superpowers](https://github.com/obra/superpowers). It gives me a set of skills that enforce a disciplined engineering process: brainstorming, planning, execution, debugging, verification, and branch finishing. Without that layer, AI coding drifts into ad hoc prompting fast. With it, I get something much closer to a repeatable engineering workflow.

Here's what a real feature session looks like.

### Brainstorming via /superpowers:brainstorming

Everything starts with a conversation. I describe what I want, usually messy and incomplete. The AI doesn't jump straight to code - it explores the project first, checks existing patterns, and asks focused questions one at a time until the problem is actually shaped.

Sounds simple, but it changes the quality of the work a lot. A good brainstorming loop catches scope mistakes early, forces tradeoff conversations, and stops "simple" ideas from sneaking into messy implementations.

When I know what I want but can't quite articulate it, I also use [/grill-me](https://skills.sh/mattpocock/skills/grill-me). Useful when I don't want the AI to politely guess what I mean. I want it to interrogate the plan, walk every branch of the decision tree, and force us into actual shared understanding before anyone touches code.

For UI-heavy work, I want the opposite kind of help. I don't want to manually art-direct every spacing choice or color decision. I want to freestyle the product direction and let the AI push toward something stronger. That's what [/ui-ux-pro-max](https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max) is for.

### Planning via /superpowers:writing-plans

Once the design is clear enough, the planning skill turns it into something executable. The useful part isn't the checklist - it's that the checklist has enough structure that another agent, another session, or future-me can pick it up without guessing.

Good plans are explicit:

- exact files to touch
- exact verification steps
- enough detail that a task can run without re-deriving the whole design

That matters because I move between sessions and tools constantly. A workflow that depends on one long-lived chat context is fragile.

### Execution via /superpowers:executing-plans

Execution is where the process compounds. My default is to execute from a separate session with the plan as the source of truth. The agent works through tasks in order, verifies each one, and reports back with evidence instead of vague confidence.

For independent tasks, I use subagent-driven execution so things run in parallel. Schema work, API work, UI work - happening at the same time, then merging once they pass review.

I also use [/feature-dev](https://github.com/anthropics/claude-plugins-official) for smaller pieces of work when I want a structured exploration and review pass without manually orchestrating every step.

### Debugging via /superpowers:systematic-debugging

When something breaks, I try hard not to let the AI improvise. That's how you get three plausible-looking changes in a row and still no root cause.

The debugging skill works because it forces a sequence: reproduce, trace, compare against working patterns, form one hypothesis, test it, then fix. The discipline matters more than the branding. It stops the common failure mode where an AI reacts to the error message instead of figuring out where the bad state actually came from.

### Finishing via /superpowers:verification-before-completion

The last stage is verification. No "should work now," no "looks good," no soft claims. Run the command, read the output, confirm the exit code, and then say it's done.

Sounds obvious. It's also one of the easiest things to skip. A lot of the reliability in this setup comes from refusing to skip that last proof step.

The whole flow looks like this:

```mermaid
graph TD
    A[Describe the problem] --> B[Brainstorming]
    B --> C[Planning]
    C --> D[Execution]
    D --> E{Bug or gap?}
    E -->|Yes| F[Systematic debugging]
    F --> D
    E -->|No| G[Verification]
    G --> H[Finish or handoff]
```

## The Infrastructure

The workflow above doesn't happen by magic. The trick is that the environment is shared.

At the project level I still care a lot about instruction files like `AGENTS.md` and `CLAUDE.md`. But at user scope, I keep the shared source of truth in `.agents`, then expose it into different clients through thin wrappers. Behavior doesn't reset when I jump from Claude Code to Codex, pi, or a remote shell.

### Shared Skills And Commands

The idea is simple: instead of reconfiguring every tool, I keep one canonical folder of instructions, skills, and commands, and let each tool read from it. The shared pieces are what make the system feel durable:

- shared instructions
- shared skill definitions
- shared command docs
- thin tool-specific wrappers per runtime

The same idea shows up in different places: I keep one conceptual command or skill, and surface it in Claude Code, Codex, pi, Cursor, or OpenCode in the way each tool expects. The wrapper changes, the intent stays stable.

That's also why the setup survives migration. The workflow lives in files and conventions, not in habit.

On this MacBook, the layout looks like this:

```mermaid
graph TD
    A["~/.agents<br/>source of truth"]
    A --> AGENTS["AGENTS.md<br/>shared instructions"]
    A --> SKILLS["skills/<br/>shared skills"]
    A --> COMMANDS["commands/<br/>shared command docs"]

    AGENTS -->|symlink| CC
    AGENTS -->|symlink| PI

    SKILLS -->|symlink farm| CC
    SKILLS -->|symlink farm| CX
    SKILLS -->|symlink farm| PI
    SKILLS -->|symlink farm| CR

    COMMANDS -->|thin wrapper| CC
    COMMANDS -->|thin wrapper| CX
    COMMANDS -->|thin wrapper| PI
    COMMANDS -->|thin wrapper| CR

    CC[Claude Code]
    CX[Codex]
    PI[pi]
    CR[Cursor]

    style CC fill:#DE7356,color:#fff,stroke:#a35140,stroke-width:2px
    style CX fill:#74AA9C,color:#fff,stroke:#4f7d72,stroke-width:2px
    style PI fill:#111111,color:#fff,stroke:#888,stroke-width:2px
    style CR fill:#ffffff,color:#000,stroke:#888,stroke-width:2px
```

Clients can change. Models can change. As long as the shared instructions, skills, and command docs stay stable, I don't have to rebuild the workflow from scratch every time I move to a different surface.

### Commands

Commands compress recurring workflows into something named and repeatable.

I mostly care about work-oriented commands. The list shifts over time, but the pattern doesn't: if I notice I keep asking for the same kind of engineering task, I want a command for it.

A few I lean on:

- /update-branch for syncing a working branch safely
- /address-pr-reviews for turning review comments into an execution loop
- /create-pr for packaging finished work into a pull request flow

The specific names don't matter much. The point is the workflow stops depending on perfect prompting memory.

### MCP And Web Tools

[Model Context Protocol](https://modelcontextprotocol.io/) is how the agents stop guessing and start using the rest of my stack directly.

The MCP-backed tools I rely on most:

- [Context7](https://context7.com/) for docs lookup. Easiest way to dodge stale library guesses.
- [Brave Search MCP](https://github.com/brave/brave-search-mcp-server) for general discovery.
- [Linear MCP](https://linear.app/docs/mcp) for issues and project tracking.
- [Todoist MCP](https://github.com/Doist/todoist-ai) for task capture.
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) and Chrome DevTools MCP for browser-backed checks.
- Telegram MCP for workflows that need to read or write Telegram state directly.

The recent improvement is that Codex is no longer the only client with the full MCP surface. I mirrored the same MCP list into pi through a small bridge extension, so pi can call the same Todoist, Linear, browser, docs, Telegram, and search tools instead of becoming a second-class terminal client.

### When I Prefer CLI Over MCP

There's one part of the stack where I deliberately don't use MCP: Google Workspace.

Google ships [an official CLI for Workspace](https://github.com/googleworkspace/cli) that wraps the Discovery API for all consumer Google products. It also ships a set of agent skills. I install all of them, and they cover basically everything I'd want to do across Google's product line:

- **Sheets** - read and write cell values, append rows, run formulas, insert charts, format ranges.
- **Docs** - read and append content, manage shared docs.
- **Drive** - search, upload, download, manage files and folders, set permissions.
- **Gmail** - read, send, search, label, manage drafts.
- **Calendar** - list events, create events, find free slots, RSVP.
- **Slides** - read and write decks.

{{< figure src="/images/macbook-agent-dev-setup/gws-skills.png" alt="Google Workspace CLI skills installed locally, covering sheets, docs, drive, gmail, calendar, and slides" caption="The full set of Google Workspace skills I keep installed locally." >}}

The reason I prefer CLI over MCP here: the CLI is faster to invoke, faster to debug, doesn't require an always-on MCP process, and the skills wrap each command with the right context the agent needs. For a tool surface this big, that ergonomic win matters.

### Status Line

The status line at the bottom of the terminal is small, but it's the part of the interface I look at most during a long session. I use [ccstatusline](https://github.com/sirmalloc/ccstatusline). It shows context usage, the current model, git branch, active tool calls, and todo progress in one strip, fully configurable. Once context health is visible at a glance, long sessions stop turning into nasty surprises.

{{< figure src="/images/macbook-agent-dev-setup/ccstatusline.png" alt="ccstatusline showing model, context usage, git branch, and tool activity" caption="ccstatusline is the small bar I rely on most. It keeps the things I care about visible without me having to ask." >}}

## Skills I Reach For

I think of skills as a separate layer from the clients themselves. The tool matters, but the reusable behaviors matter more.

- [/superpowers](https://github.com/obra/superpowers) gives me the core workflow discipline.
- [/pr-review-toolkit](https://github.com/anthropics/claude-plugins-official) is what I reach for when I want extra review pressure on tests, error handling, and quality.
- [/grill-me](https://skills.sh/mattpocock/skills/grill-me) when I want the AI to interrogate my vague idea until it becomes a precise spec.
- [/ui-ux-pro-max](https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max) when I want a stronger UI system than I'd get from default prompting.

For document work, I keep Anthropic's official document skills installed. They let the agent create or edit office files end-to-end, which is great when I'd rather review the output than open the app and type:

- [/pptx](https://skills.sh/anthropics/skills/pptx) for PowerPoint decks
- [/docx](https://skills.sh/anthropics/skills/docx) for Word documents
- [/xlsx](https://skills.sh/anthropics/skills/xlsx) for Excel spreadsheets
- [/pdf](https://skills.sh/anthropics/skills/pdf) for PDFs

These pair really well with templates: hand the agent a template plus the source data, and the final document comes back ready to review. No typing in the app, no formatting fights.

If you're hunting for new skills, [skills.sh](https://skills.sh/) is the place to browse. It indexes a huge number of community-published skills, and most of what I rely on day-to-day either comes from there or from official Anthropic plugin repos.

### Usage Monitoring

[OpenUsage](https://www.openusage.ai/) made the whole stack easier to live with. I use it to monitor usage limits across the AI products I pay for instead of checking each one separately. Once you're regularly moving between Claude, Codex, Cursor, and provider-backed tools, having one dashboard is more useful than it sounds.

{{< figure src="/images/macbook-agent-dev-setup/openusage.png" alt="OpenUsage showing usage across multiple AI coding tools" caption="OpenUsage gives me one place to see how hard I'm pushing the different AI tools I use." >}}

## Where Each Tool Fits

### Claude Code

[Claude Code](https://www.anthropic.com/product/claude-code) is still my favorite place for deep terminal-native work. Especially good when I want long sessions that mix planning, editing, shell, and git without ceremony.

It's also where the plugin and workflow ecosystem first clicked for me. For strong orchestration in a terminal-first environment, Claude Code is still a big part of the picture.

### Codex

[Codex](https://openai.com/codex/) is where I go when I specifically want OpenAI's own models inside the harness designed for them. The CLI feels opinionated in a useful way: permissions, goals, tool calls, context, and verification all sit in the same loop.

The feature I use more than I expected is `/goal`. It gives a long session a durable objective instead of relying on whatever happens to be visible in the latest prompt. For complicated work, that matters. It lets the agent keep the north star in view while still moving through concrete shell work and file edits.

### pi

[pi](https://github.com/withpi/codemode) is my overflow and provider-flexibility lane. I use it when I want models or plans outside Claude Code and Codex, especially GitHub Copilot Enterprise and OpenCode Go.

The important part is that pi is not a separate world. It loads the same user instructions and now has a bridge to the same MCP tools Codex uses. That makes it useful as an extra execution surface instead of a disconnected experiment.

### OpenCode, Deferred

[OpenCode](https://opencode.ai/) is still interesting to me, but it is not the centerpiece of this version of the setup. The provider story is attractive, and I still like the shape of the project, but right now I get the best daily split from Claude Code, Codex, and pi.

That's the pattern across the whole setup. The agent should be swappable more often than the process.

## Herdr As The Workspace Layer

These days the center of gravity for my local workflow isn't really a terminal emulator. It is [Herdr](https://herdr.dev/), running inside WezTerm.

I used Superset for a while and liked the concept, but I wanted something more reliable and less tied to a third-party session model while Superset v2 settles. Herdr is closer to the thing I wanted: a tmux-like workspace manager built for agent-heavy terminal work, with spaces, tabs, panes, session persistence, and a config file I can sync with the rest of my dotfiles.

{{< figure src="/images/macbook-agent-dev-setup/herdr.png" alt="Herdr workspace in WezTerm showing Claude Code, Codex, and pi running side by side, with agent status monitored in the bottom-left agents section" caption="Herdr is the current workspace layer. In this screenshot Claude Code, Codex, and pi are all running side by side, while the bottom-left agents section monitors their status." >}}

The setup is opinionated:

- WezTerm stays mostly as a stable outer shell.
- Herdr owns spaces, tabs, panes, focus movement, and session layout.
- Claude Code, Codex, and pi run side by side inside Herdr.
- The bottom-left agents section gives me a live status board for those sessions, so I can see which agent is idle, active, or parked without opening every pane.
- My WezTerm status bar shows Herdr workspace/tab context, CPU, memory, network, and cron health.
- Keybindings are mapped so normal macOS muscle memory still works: `Cmd+T` for a tab, `Cmd+W` to close a pane/tab, `Cmd+Shift+Arrow` for tab/workspace movement, and `Cmd+Option+Arrow` for focus movement.

The important distinction: I want the workspace layer to remember where work lives. I do not want every agent client to invent its own session model and force me to translate between them.

## Remote Work

I keep a small VPS at [Jetorbit](https://www.jetorbit.com/) - 4 vCPU, 8 GB RAM - and I use it as a real remote agent box, not just a place to SSH into for emergencies.

Because my Mac and VPS share the same `.agents` architecture, remote work feels like the same system in a different place, not a separate environment I have to mentally translate.

### Tailscale: The Most Important Piece

Honestly, this might be the most important part of the whole setup, and I almost forgot to write about it.

I have **zero public ingress ports open on my VPS**. No port 22 for SSH. Nothing. The only way anything reaches the box is through [Tailscale](https://tailscale.com/), which puts my MacBook, VPS, iPhone, and work laptop on the same private overlay network.

That basically takes the external attack surface of my VPS down to zero. There's nothing to scan, nothing to brute-force, nothing for a stray bot to find. Every service I run - SSH, Mosh, dashboards, internal web tools, anything - is only reachable from devices already on my tailnet.

{{< figure src="/images/macbook-agent-dev-setup/tailscale.png" alt="Tailscale overlay network connecting personal devices privately" caption="Source: tailscale.com" >}}

Compared to the usual "open port 22 with key auth, hope nobody finds the box" approach, this is dramatically better. And the ergonomics are nicer too - no firewall whitelisting, no jump hosts, no juggling per-service ACLs.

### Claude Code On The VPS

For Claude Code, I usually connect through [Termius](https://termius.com/) and use [Mosh](https://mosh.org/) instead of plain SSH.

The big difference: Mosh runs over UDP rather than TCP, and it doesn't tie the session to a single TCP connection. SSH dies the moment the underlying connection breaks; Mosh just keeps the session alive and resyncs when the network comes back.

What that means in practice:

- I can switch from mobile data to Wi-Fi mid-command and the session doesn't drop.
- I can step into an elevator, lose signal entirely, and pick up where I was when I come out.
- Putting my laptop to sleep and reopening it 30 minutes later doesn't kill the session.

For long-running agent work over flaky networks, this is the difference between "remote workflow that actually works" and "rage-quitting back to the laptop."

For notifications, [notification-go](https://github.com/777genius/claude-notifications-go) is mainly relevant when I'm using Claude Code directly in a terminal. If I'm already inside Herdr, the terminal workspace itself is where I want the notification surface to stay.

### Session Persistence

All my shell sessions on the VPS are managed by my homemade [tmux-menu](https://github.com/absolutepraya/dotfiles/blob/config/vps/scripts/tmux-menu), powered by [fzf](https://github.com/junegunn/fzf). Reconnecting usually means resuming the latest session state instead of rebuilding context from scratch.

{{< figure src="/images/macbook-agent-dev-setup/tmux-menu.png" alt="tmux-menu showing fzf-powered session picker on VPS" caption="tmux-menu is the first thing I see when I log into the VPS. Pick a session, jump back into it." >}}

The flow looks like this:

```mermaid
graph LR
    A[ssh / mosh<br/>into VPS] --> B[tmux-menu launches]
    B --> C[fzf picker:<br/>list of sessions]
    C --> D{pick}
    D -->|existing| E[attach -<br/>resume state]
    D -->|new| F[create new<br/>session]
```

This part is easy to underestimate. A remote workflow gets dramatically better the moment "disconnecting" stops meaning "start over."

### Where Claude Remote Control Still Fits

[Claude Remote Control](https://code.claude.com/docs/en/remote-control) still has a place. If I specifically want the Claude app on my iPhone, it's the cleanest path.

But most of the time I prefer the SSH route on the VPS for Claude Code - the interface is more complete. Remote Control is useful, just not my default.

The [iPhone version of this setup](/posts/agents-dev-setup-on-iphone/) is now different enough that I split it into its own post. The short version: Blink Shell, Mosh, Tailscale, tmux, and Wispr Flow. The phone is not trying to be a tiny MacBook. It is a remote control surface for agents that are already running somewhere better.

## Voice Input

Voice input is one of the highest-leverage parts of the setup, because prompt-writing is often the bottleneck once the tooling is good.

On the MacBook I mostly use [Wispr Flow](https://wisprflow.ai/). It is polished, fast, and good at turning messy spoken thoughts into clean text. When I run out of the free tier, I switch to [Handy](https://handy.computer/), which is free and open source.

{{< figure src="/images/macbook-agent-dev-setup/wisprflow.png" alt="Wispr Flow website showing voice-to-text positioning and macOS download" caption="Wispr Flow is my default dictation layer on desktop. It is the smoothest option when I want polished text quickly." >}}

{{< figure src="/images/macbook-agent-dev-setup/handy.png" alt="Handy website showing the open-source speech-to-text app for macOS" caption="Handy is the fallback I actually keep around, because it is local, lightweight, and fast enough." >}}

For Handy, the model choice matters. I use Parakeet V3 because it has the best speed and quality balance for my use. The custom-word list matters too: project names, tool names, Indonesian names, weird repo terms, `pnpm`, `MCP`, `Codex`, `Todoist`, and all the other words normal dictation mangles.

{{< figure src="/images/macbook-agent-dev-setup/handy-model.png" alt="Handy transcription model settings showing Parakeet V3 as active" caption="Parakeet V3 is the Handy model I keep active. Fast, accurate, and light enough for daily use." >}}

{{< figure src="/images/macbook-agent-dev-setup/handy-custom.png" alt="Handy custom words list containing project names and developer-tool terms" caption="Custom words are what make dictation usable for software work. Without them, every agent prompt turns into cleanup." >}}

## Quality Of Life

Smaller things that don't define the workflow but make the daily experience better:

- ccstatusline keeps context usage, active tools, and status visible in the status line.
- notification-go for terminal-first Claude Code sessions when Herdr is not the active notification surface.
- Custom keybindings everywhere - once the interface becomes muscle memory, agent work feels much less awkward.
- Effort level cranked high when I want the agent to think harder, even at extra cost.

None of these is the reason the setup works. But once the foundation is good, small ergonomic wins add up.

## Getting Started

This setup didn't appear all at once. It grew because each piece solved a problem I had more than once.

If you want to build something like it, don't copy the whole stack on day one:

1. Start with one tool you actually like using.
2. Give it real project instructions.
3. Add one or two integrations that remove obvious context switching.
4. Add workflow discipline before you add more models.
5. Add remote access, monitoring, and specialist skills only when they solve a real recurring problem.

The biggest change wasn't switching from one model to another. It was treating the workflow as the product. Once the process, instructions, and context became portable, the individual agents mattered less. That's what made the setup feel durable.
