---
title: "[S4, W2] PPL: Closing Reviews Is the Other Half of the Job"
date: 2026-05-20
description: "Five merge decisions this week, each at a different depth. The headline case was verifying that Fadhli's 42 follow-up commits actually addressed each of the 13 findings from last week's MR !304 review. Plus delegating yanto to verify discussion-resolution before merging Fernanda's security-headers MR."
tags: ["ppl", "code-review"]
slug: "s4w2-code-review"
toc: true
---

## What I Worked On

Five MRs merged by me this week as the gatekeeper, none authored by me. Each at a different depth:

| MR | Author | Merge depth | Time invested |
|----|--------|-------------|--------------:|
| !304 SIRA-319 atomic duplicate merge | Fadhli | Deep verification of 13-finding review follow-up | ~60 min |
| !316 SIRA-377 7 HTTP security headers | Fernanda | Delegated verification via yanto | ~5 min |
| !311 SIRA-331 risk prioritization | Soy | Light read + CI gate check | ~15 min |
| !269 SIRA-321 invalid value visibility | Fadhli | Light read + CI gate check | ~10 min |
| !291 SIRA-277 telegram P0/P1 fixes | Fernanda | Bare approval (CI gate only) | ~3 min |

The S4W1 blog on this competence was about *opening* reviews; this week was about *closing* them. Opening a review is the work I usually associate with "code review." Closing one is the work that decides whether a fix actually shipped or just generated a thread.

## !304: Verifying 13 Findings Across 42 Commits

The MR !304 review thread from last week (May 13) listed 3 P0, 4 P1, 4 P2, 2 P3 findings on Fadhli's atomic duplicate-client merge. The most consequential was a P0 lock-ordering deadlock that would surface as a 500 on concurrent merges from opposite directions; the other P0s were about PL/pgSQL `raise exception` getting downgraded to generic 500 because the wrapper only caught `ValueError`, and the absence of any integration test exercising the actual RPC atomicity claim.

Between May 13 and May 20, Fadhli pushed 42 commits to the MR. The relevant ones tracked against the original findings:

| Finding | Severity | Fix commit | Status |
|---------|:--------:|------------|--------|
| Lock ordering deadlock | P0 | `f9d61b55 fix(db): prevent deadlock in merge rpc by locking in id order` | ✅ matches recommendation (order by id, then for update) |
| `APIError` not translated to `ValueError` | P0 | `791ba896 fix(api): catch and translate merge client error message` | ✅ catches `APIError`, translates known messages |
| Zero integration test for RPC atomicity | P0 | `2f4321c5 test(api): add test for merging related rows with real database` | ✅ seeds keep + discard + invoice + reminder_log + risk_scoring_log, calls RPC, asserts reassignment |
| Same-type `str` arg swap risk | P1 | `22ccaf82 fix(api): make duplicate merge rpc wrapper keyword-only` | ✅ wrapper is now keyword-only |
| TOCTOU + O(n²) re-scan | P1 | `5af5d63e fix(api): avoid full duplicate recomputation and query dismissed pairs by id` | ✅ removed full re-scan, queries by pk |
| Post-merge `get_client` failure masking | P1 | `4a6ce259 fix(api): log merge refusal reason and post-merge reload error` | ✅ logs loudly and returns clear message |
| Tests patching private method | P1 | `079400fa test(api): stop patching private duplicate merge helpers` | ✅ patches public dependency now |
| `is_dismissed_pair` non-PK query | P2 | covered by `5af5d63e` (above) | ✅ |
| Redundant `_encryption_key` field | P2 | `6d314864 refactor(api): reuse duplicate detection service in client merge flow` | ✅ constructed once in init |
| SIRA-XX ticket reference in comment | P2 | `88505157 fix(db): removed redundant 'drop function if exists' line and changed comment to be durable` | ✅ comment now load-bearing only |
| Missing audit logs on refusals | P2 | covered by `4a6ce259` (above) | ✅ |
| Redundant `drop function if exists` | P3 | covered by `88505157` (above) | ✅ |
| `threshold=80` magic number | P3 | not addressed | ❌ accepted as not-blocking, noted in resolved thread |

12 of 13 findings addressed with named commits, one P3 explicitly declined and acknowledged in the thread. Fadhli marked all threads resolved at 2026-05-19 06:40, then added 2 more verification tests (`d30323ee` and `fef0a8c0`), then rebased and pushed once more on 2026-05-20 09:50.

My job on May 20: open each fix commit, read the diff, confirm the fix matched what I had suggested. The deadlock fix in `f9d61b55` literally has:

```sql
perform 1 from clients
where id in (p_keep_client_id, p_discard_client_id)
order by id
for update;
```

Which is exactly the snippet from the original P0 finding. That's the verification: not "did Fadhli push commits" but "did the commits actually do what the finding said to do." A reviewer who only checks for the green CI badge and the "all threads resolved" status would miss a case where the author "addressed" a finding by making the symptom go away without fixing the root cause. Reading the fix commits is the close-the-loop work.

Once each P0 and P1 fix was verified against its finding, I merged at 10:44.

## !316: Delegating Verification to Yanto

The other deep merge this week was MR !316 (Fernanda's HTTP security headers implementation). Instead of doing the verification manually, I delegated to yanto. The Discord exchange:

```
[16:54] praya: yanto merge this
[16:54] praya: bismillah

[16:57] yanto: udah gua merge
masih jalan nih, 3 min elapsed, iteration 11/60, ...
statusnya aman juga tadi:
1. MR mergeable, no conflict, no draft
2. pipeline 16712 success
3. blocking discussions resolved
4. review minor dari qen udah ke-address di head MR

merge result:
1. MR !316 sekarang status merged
2. merge commit: 0622841c738c548b25e48de4648ef40aab7085b6
3. squash commit: 737a715ee527d9eba357b34ac4efbdda9553d1b9

sempet kena 422 dulu, ternyata project ini wajib squash pas merge.
terus gua merge ulang pake squash=true, sukses
```

Yanto's checklist before merging was exactly what I would have manually verified:

1. **MR mergeable**: no rebase conflict, not in draft
2. **Pipeline 16712 success**: all CI green
3. **Blocking discussions resolved**: no unresolved threads
4. **Review minor from Qen already addressed in head MR**: author pushed fixes after Qen's comments

That fourth check is the key one. It's the same close-the-loop step I did manually for !304: verify that the author actually addressed the reviewer's feedback in subsequent commits, not just marked threads resolved. Yanto did this autonomously by reading Qen's review comments and grepping the commit log for fixes.

The pattern repeated the next morning on a different MR (!324, a CSP hotfix that landed past the S4W2 deadline but proves the agent-as-merger workflow continued to scale):

![Discord screenshot of praya asking "merge @yanto" on dip's MR !324 link, and yanto's verbose merge status reply. The reply states yanto set merge_when_pipeline_succeeds=true with squash already enabled (no 422 this time because the squash convention was already in yanto's memory). Yanto notes hitting a glab 405 error on the standard merge path and falling back to a direct GitLab API call with squash=true. The auto-merge was queued and will fire on pipeline green.](/images/ppl/s4w2-yanto-merge-mr324.png)

Same checklist, different API failure mode (405 instead of 422), squash convention applied on the first attempt thanks to the prior memory training. The discipline that scaled across two merges in two days is the same discipline that scales across the rest of the project.

The 422 retry is the agent learning the project's squash-only convention. After the merge succeeded, I had yanto save the rule to memory:

```
[16:59] praya: save ke memory lu bro, tiap merge selalu squash
jadi next kali buat SIRA, default merge pake squash enabled ya bro
[17:00] yanto: sip, udah gua simpen
```

Next time, yanto skips the 422 retry and squash-merges on the first try.

This is the same pattern as the b3 discipline blog described, but from the b4 angle: delegating verification work to an agent doesn't mean skipping the verification. It means moving the verification work into the agent's checklist so a 5-minute Discord exchange replaces a 15-minute manual gate.

## Light Merges: When Light Is Appropriate

The other three merges were lighter touches:

- **!311 SIRA-331 risk prioritization** (Soy, May 19): four small features bundled (sort fix, badge colors, tab view, risk filter). Read the diff for the sort fix (the most algorithmic part), spot-checked the badge color values against the design tokens, confirmed the new filter UI matched the existing chip pattern, checked CI green. ~15 minutes.
- **!269 SIRA-321 invalid value visibility** (Fadhli, May 19): UI fix to make truncated values visible. Visual change only, no logic risk. Read the changed files in 10 minutes, checked CI green, merged.
- **!291 SIRA-277 telegram P0/P1 fixes** (Fernanda, May 15): bare approval based on CI gates alone. Fernanda flagged this as a P0/P1 stack she had already verified locally. I trusted that, especially given the fix nature (these were already-identified bugs being fixed, not new behavior being introduced).

The bare approval on !291 is the one that deserves justification. Without a comment, the approval is just trust + CI. The reasons I treated it as appropriate:

1. **Fix vs feature**: it patched existing P0/P1 bugs. The failure mode of "a bug fix introduces a new bug" is real, but the existing tests around the buggy paths covered the regression risk.
2. **CI signal**: pipeline green across all stages including integration tests and mutation testing.
3. **Author track record**: Fernanda's MRs have shipped clean for the last several sprints; the risk of "she shipped something wrong" is lower than the risk of "I block her on something nitpicky."

A bare approval on a feature MR with new business logic would be wrong. A bare approval on a fix MR with strong CI signal and a trusted author is a calibrated trust signal. The discipline is knowing which is which.

## What I Learned

**Closing a review is not the same as opening it.** Opening a review takes effort: read the diff, find issues, write findings. Closing requires verifying the author's fixes actually addressed each finding. Both are work. The S4W1 b4 blog covered opening; this week covered closing. They are different competences and they both matter for the MR's quality.

**Delegation moves the work, not the standard.** Yanto's autonomous merge of !316 didn't lower the verification bar; yanto explicitly checked the same four things I would have. The change was who did the work, not whether it got done. For high-frequency low-stakes merges, this is the obvious scaling pattern.

**Bare approval is a depth choice, not laziness.** Approving without comment is appropriate when the trust signal (CI green + known-good author + fix-vs-feature) is strong enough that adding a comment would just be ceremony. The wrong move is to bare-approve everything; the right move is to bare-approve when the gate signal is genuinely enough.

## Evidence

- [MR !304 SIRA-319 Fix invalid and non-atomic duplicate client merge](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/304): review thread `eb494aa3` posted 2026-05-13, merged by me 2026-05-20 10:44 after verifying 12 of 13 findings addressed
- [MR !316 SIRA-377 implement 7 HTTP security headers](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/316): merged via yanto delegation, squash commit `737a715e`, 2026-05-20 16:58
- [MR !311 SIRA-331 Risk Prioritization](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/311): light read merge, 2026-05-19 07:46
- [MR !269 SIRA-321 invalid value visibility](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/269): light read merge, 2026-05-19 03:08
- [MR !291 SIRA-277 telegram bug fixes](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/291): bare approval, 2026-05-15 06:18
- !304 follow-up commits addressing each finding (selected): `f9d61b55` (deadlock fix), `791ba896` (APIError translation), `2f4321c5` (integration test), `22ccaf82` (keyword-only), `5af5d63e` (TOCTOU + PK query), `4a6ce259` (logging + error handling), `079400fa` (test patching), `6d314864` (refactor), `88505157` (P3 cleanup)
- yanto autonomous merge of !316: Discord `#dev` 2026-05-20 16:54-17:00, including squash-convention codification
