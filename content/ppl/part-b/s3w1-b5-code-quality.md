---
title: "PPL: Quality Gates and Test Coverage [Sprint 3, Week 1]"
date: 2026-04-22
description: "Using SonarQube coverage thresholds and SAST gates as forcing functions to maintain test quality on a large monorepo."
tags: ["ppl", "code-quality"]
slug: "s3w1-code-quality"
toc: true
---

## What I Worked On

This week I used our quality gates as active tools rather than passive checks. When MR !200 failed the SonarQube quality gate, I treated it as a signal to improve test coverage and fix code smells before merging. I also verified that our SAST pipeline (Bandit + pnpm audit) stayed clean across multiple commits.

## SonarQube New-Code Gate

Our SonarQube instance enforces three conditions on new code:

- Coverage >= 80%
- Issues (new code) = 0
- Duplications <= 3%

The initial CI run on MR !200 showed:

| Metric | Initial | After Fix | Threshold |
|--------|---------|-----------|-----------|
| Coverage | 28.5% | 97.7% | >= 80% |
| Issues | 2 | 0 | <= 0 |
| Duplications | 0.0% | 0.0% | <= 3% |

The 28.5% coverage was because the new `rich-editor` component had zero tests. I wrote `rich-editor.test.tsx` with targeted assertions for each user-visible behavior: toolbar buttons, variable chip rendering, link insertion, and aria-pressed states. The test file is only 90 lines but exercises the component surface thoroughly.

![SonarQube Quality Gate passing on MR !200 after the coverage fix](/images/ppl/s3w1-b5-sonarqube-mr200.png)

The final dashboard tells the story: 938 new lines, 97.7% coverage on the 358 new lines that required coverage, 0 new issues, 0.0% duplications, and 6 fixed issues rolled up from earlier commits. All three new-code conditions green.

The 2 issues were code smells in the editor's variable node implementation. One was an unused import, the other a complex conditional. Both were straightforward to fix, but SonarQube caught them before human review did.

## SAST Cleanliness

Bandit runs on every MR via the `security:sast` CI job. This week it flagged one line in `email_template_service.py`:

```python
template.render(body_html=Markup(body_html))  # nosec B704
```

I traced the warning: Bandit sees `Markup` and assumes unsanitized HTML. In our case, `body_html` comes from admin-edited templates rendered through a `SandboxedEnvironment` with `autoescape=True`. I added a `# nosec B704` comment with an explanation, keeping the gate strict while documenting the exception. The Bandit check remained green for all subsequent commits.

pnpm audit also stayed clean after MR !195 fixed a moderate vulnerability in a transitive dependency.

## What I Learned

Quality gates work best when they fail fast and give specific feedback. SonarQube's new-code gate is more useful than overall coverage because it focuses on the code you just wrote. A 90% overall coverage number can hide a 0% covered new file. The 28.5% -> 97.7% swing on MR !200 is a perfect example: the gate forced me to test the new code immediately, not defer it to a later "test sprint" that never happens.

## Evidence

- [MR !200 - Tiptap WYSIWYG editor](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200)
- Commit `2f3ab4e1` — test(web): cover rich-editor package + unblock SonarQube gate
- Commit `65742c09` — refactor: resolve 6 SonarQube violations
- Commit `ec2ef1d0` — fix(ci): suppress Bandit B704 false positive with documented nosec
- Source: `apps/web/tests/components/rich-editor/rich-editor.test.tsx`
- Source: `apps/api/src/app/services/email_template_service.py`
