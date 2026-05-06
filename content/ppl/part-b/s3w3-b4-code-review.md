---
title: "[S3, W3] PPL: Receiving Review and Closing the Loop"
date: 2026-05-06
description: "A quieter outbound-review week, but two MRs this week were entirely about responding to teammate review feedback: !252 cleaning up @qenthm's read on telegram-settings, and !206 addressing post-merge feedback on the export modals. Plus a small contribution and an approval thread."
tags: ["ppl", "code-review"]
slug: "s3w3-code-review"
toc: true
---

## What I Worked On

Honest framing for this week: outbound review activity was thin. The bulk of my collaboration happened on the receiving end, where two of my MRs were entirely about closing the loop on teammate review feedback. MR !252 reopened @qenthm's review of an earlier telegram-settings MR and addressed every concrete item. MR !206 went back to a previously-merged MR and applied post-merge feedback that had landed too late for the original round. On the outbound side, I contributed one commit to @qenthm's invoice bulk-actions MR (!205) and approved the SonarQube fix MR (!242) after running through it locally.

This is a deliberately less-impressive week for review-throughput than S3W2 (which had 6 substantive reviews with 83 findings). I want to write the honest version rather than pad.

## Receiving Review: MR !252 (Closing Out @qenthm's Feedback)

@qenthm reviewed an earlier MR of mine (!226) that merged Telegram Topic Routing into Event Notifications. By the time I returned to address his feedback, the structural change had already shipped via someone else's MR (!248). What remained was three specific cleanup items @qenthm flagged:

> - Remove dead `?? ''` reads on `topics[...]` (handleSave + per-row Input value).
> - Remove dead `?? true` reads on `toggles[...]` (enabledCount + per-row enabled).
> - Rename `topicId` / `setTopicId` to `fallbackTopicId` / `setFallbackTopicId` for clarity at every call site.

Each of these is the kind of small, surgical fix that's easy to ignore but accumulates into noise if you do. I shipped them in MR !252 against current main, with one explicit non-action documented in the description:

> The two `findValue(...) ?? ''` reads in the `useEffect` stay as-is because `findValue` can legitimately return `undefined` for keys not yet seeded in the settings table. The handleSave entry uses a non-null assertion (`topics[r.topicKey]!`) to express the runtime invariant under TS strict's `noUncheckedIndexedAccess`.

That last paragraph is the part I think matters most for review-receiving etiquette. Saying "I'm not changing X because Y" makes the disagreement explicit and explainable, instead of either silently ignoring the comment or capitulating without thinking.

The MR shipped with **979 / 979 frontend tests passing**.

## Receiving Review: MR !206 (Post-Merge Feedback on Export Modals)

MR !206 is interesting because it addresses feedback that came in **after** the original MR (!151) merged. The feedback was real and worth doing, but the original MR had already shipped. The choices were: ignore the feedback, file a follow-up MR, or open !206 with the explicit framing "post-merge review feedback on already-shipped work."

I went with the third option. The MR title is `SIRA-151 fix(web,api): address post-merge review feedback for export modals`. The description names which earlier reviewer raised which point, what the fix is, and why it didn't go in the original MR (timing). This is bookkeeping that sounds tedious but it makes the eventual git log readable: anyone tracing why a particular line changed sees the review trail back to the original feedback comment.

The communication win here is treating "the review came in late" as a process artifact, not a personal failing on either side. The reviewer's input is still valuable; the reviewer just has to accept that it lands as a follow-up MR. Naming that explicitly in the title and description normalizes the pattern so the team can use it more often.

## Outbound: One Contribution + One Approval

**MR !205 (qenthm's invoice bulk actions)**: I contributed one commit (`7650bbae`) to the branch — a merge of main into the feature branch to bring it up to date before the auto-merge. Not a substantive review, but a small in-branch contribution. The merge brought 84 commits from main onto the feature branch, which is the kind of housekeeping that prevents merge conflicts from reaching the reviewer of record.

**MR !242 (sonar fixes by @fadhliraihan)**: approved with a thread. The MR was a sweep of low-priority SonarQube issues across the codebase. I went through each cluster of changes locally before approving to confirm none of them changed behavior — sonar fixes that change behavior under the guise of "code quality" are a real risk, and an approval that didn't catch one would be worse than no approval at all. The changes were genuinely cosmetic (renaming for clarity, simplifying Boolean expressions), so the approval went through.

## What I Learned (and What I Didn't Do)

The honest reflection: this week didn't have the volume of substantive review threads that S3W2 had. Part of that is that my own MR throughput was high (9 MRs), which crowds out review time. Part of it is that the team's ramp on Telegram-related work meant fewer MRs were ready for review during this window.

The skill I want to keep growing: **knowing when to ship a follow-up MR vs. ask for the original to be amended**. MR !206's framing ("post-merge review feedback") is a pattern I want to use more, because the alternative (re-opening a merged MR or losing the feedback) is worse for everyone.

## Evidence

- [MR !252 SIRA-161 refactor(web): address @qenthm review on telegram-settings](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/252) — 3 cleanup items, 1 explicit non-change with rationale, 979 tests passing
- [MR !206 SIRA-151 fix(web,api): address post-merge review feedback for export modals](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/206)
- [MR !205 SIRA-196 invoice bulk actions](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/205) — contributed merge commit `7650bbae`
- [MR !242 SIRA-308 sonar fixes](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/242) — approved after local walk-through
- Original review thread that !252 closes: [MR !226 thread](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/226)
