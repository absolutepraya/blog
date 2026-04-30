---
title: "[S3, W1] PPL: Responding to Review Feedback"
date: 2026-04-22
description: "Addressing automated quality gate failures and post-merge review feedback on export modals through iterative commits."
tags: ["ppl", "code-review"]
slug: "s3w1-code-review"
toc: true
---

## What I Worked On

Code review is not only about reading other people's diffs. This week my review feedback came from two sources: the automated CI pipeline on MR !200, and a post-merge review on MR !195 that flagged silent error handling in export modals. I addressed both through focused follow-up commits.

Three of my MRs landed in the week's deploy window (MR !200 Tiptap editor, MR !195 CSV export fix, MR !197 parallel CI Supabase slots), each with its own review cycle:

![My merged MRs deployed between 2026-04-16 and 2026-04-23, filtered by author](/images/ppl/s3w1-b4-filtered-mr-list.png)

## SonarQube Gate Failure on MR !200

The first CI run on MR !200 failed the SonarQube quality gate with two problems:

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Coverage (new code) | 28.5% | >= 80% | Failed |
| Issues (new code) | 2 | <= 0 | Failed |

The coverage failure was because the new `rich-editor` package had no tests. The issues were code smell violations in the new editor components. I treated this as review feedback and responded with two commits:

1. `test(web): cover rich-editor package + unblock SonarQube new-code gate` — added `rich-editor.test.tsx` with 9 assertions covering toolbar rendering, variable chip display, link insertion, and accessibility attributes. Coverage jumped to 97.7%.
2. `refactor: resolve 6 SonarQube violations on main` — fixed the specific code smells flagged by the analyzer.

The gate passed on the next run. This is a review-response cycle, just with an automated reviewer.

## Post-Merge Review on Export Modals

After MR !195 merged, a review pointed out that the CSV export modals had silent `catch {}` blocks that swallowed errors:

```tsx
// Before: error disappears
handleExport().catch(() => {})
```

I fixed this in commit `d54182ca` by replacing the silent catches with Sentry capture and user-facing toast notifications:

```tsx
// After: error is logged and user is told
handleExport().catch((err) => {
  Sentry.captureException(err)
  toastError('Export failed. Please try again.')
})
```

I also added regression tests for the failure path in `client-export-modal.test.tsx` and `payment-export-modal.test.tsx`, so the fix is protected from future refactors.

## What I Learned

Review feedback is most valuable when it comes with data. The SonarQube report gave exact file paths and line numbers. The post-merge review gave exact component names. In both cases, I could address the feedback without guessing. I also learned to add tests for the fix, not just the fix itself. A code change without a test is a temporary change.

## Evidence

- [MR !200 - Tiptap WYSIWYG editor](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/200)
- [MR !195 - Preserve numeric CSV values and reuse invoice cache](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/195)
- Commit `2f3ab4e1` — test(web): cover rich-editor package + unblock SonarQube gate
- Commit `65742c09` — refactor: resolve 6 SonarQube violations
- Commit `d54182ca` — fix(web,api): address post-merge review feedback for export modals
- Source: `apps/web/tests/components/rich-editor/rich-editor.test.tsx`
- Source: `apps/web/src/components/client-export-modal.tsx`
