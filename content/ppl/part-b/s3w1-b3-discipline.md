---
title: "[S3, W1] PPL: Discipline in CI Hardening"
date: 2026-04-22
description: "Incremental fixes to CI scripts, SAST policy, and Docker networking that required careful tracing of failure modes rather than quick patches."
tags: ["ppl", "discipline"]
slug: "s3w1-discipline"
toc: true
---

## What I Worked On

This week I spent a significant portion of my time on infrastructure discipline: hardening the CI pipeline after observing repeated failures on the self-hosted runner. The work was not a single feature but a series of small, careful fixes that each required understanding a failure mode before writing code.

## Orphan Slot Cleanup in Supabase CI

Our integration tests use three parallel Supabase slots via flock. A job timeout or SIGKILL could leave a slot locked and containers running, permanently consuming one of three slots. I added an orphan sweep to `scripts/ci-supabase-slot.sh` that checks `.owner.pid` files and reaps dead stacks before attempting to claim a slot.

The key discipline was adding this cleanup at the *start* of the script, before `acquire_slot`, so every run heals the environment left by previous crashes. I also changed the slot directory permissions to `0777` (no sticky bit) so the gitlab-runner user can remove files created by manual smoke tests run as ubuntu.

## Bandit Policy Tuning

Bandit (Python SAST) started flagging a MarkupSafe usage in `email_template_service.py` as a potential XSS risk:

```python
template.render(body_html=Markup(body_html))
```

The warning was `B704: markupsafe.Markup` in a non-escaped context. I traced the call: `body_html` comes from admin-edited email templates, rendered through a Jinja2 `SandboxedEnvironment` with `autoescape=True`. The `Markup` call is deliberate, not a bug. Rather than ignoring the rule globally, I added an inline `# nosec B704` with a comment explaining the context. This keeps the security gate strict while documenting why this specific line is safe.

## Docker IPv6 Preflight

The production deploy job failed intermittently with `network is unreachable` during `docker pull`. The root cause was Cloudflare's Docker mirror returning AAAA records, and our VPS having no working IPv6 route. Docker does not fall back to IPv4 fast enough.

I did not just add a retry loop. I added a preflight check to the deploy script that verifies `/etc/docker/daemon.json` contains `"ipv6": false`, and prints the exact remediation command if it is missing. This turns a mysterious failure into a self-documenting check.

## Runner Timeout Documentation

A job failed with `execution took longer than 10m0s seconds` even though `.gitlab-ci.yml` specified `timeout: 25 minutes`. The real limit was the runner's `maximum_timeout` setting in GitLab admin, not the YAML. I added a note to `CLAUDE.md` explaining how to verify and fix this via the API, because the next person hitting this should not have to rediscover it.

## What I Learned

Infrastructure work rewards patience. Each of these fixes was under 20 lines, but the investigation behind them was longer than the code. The slot cleanup required reading how `flock` interacts with shell `EXIT` traps. The Bandit fix required understanding Jinja2's autoescape pipeline. The Docker fix required checking VPS network config. Discipline here means writing the explanation, not just the fix.

## Evidence

- Commit `c7e18ac0` — fix(ci): orphan slot cleanup in ci-supabase-slot.sh
- Commit `ec2ef1d0` — fix(ci): suppress Bandit B704 false positive with documented nosec
- Commit `a343d4a5` — fix(ci): Docker IPv6 preflight check in deploy script
- Commit `76b9e2f1` — docs(ci): document runner maximum_timeout check in CLAUDE.md
- Source: `scripts/ci-supabase-slot.sh`
- Source: `apps/api/src/app/services/email_template_service.py`
- Source: `CLAUDE.md`
