---
title: "[S4, W1] PPL: Building a Service From Scratch Under Strict Red-Green"
date: 2026-05-13
description: "A new FastAPI service (sira-mr-bot) shipped this week with eight paired red-green commits across eight modules, plus three additional red-green pairs for post-launch edge-case hardening. Every module's contract lived as a failing test before any production line was written."
tags: ["ppl", "tdd"]
slug: "s4w1-tdd"
toc: true
---

## What I Worked On

MR !275 introduced a new service from zero: `services/sira-mr-bot/`, a FastAPI app (~680 LOC across 8 src modules) that posts and edits Discord cards for every team merge request. The service is fully test-first: every module landed as a `test(mr-bot): red` commit followed by a `feat(mr-bot): green` commit in the pre-squash history. Three follow-up MRs (!276, !293, !294) also kept the red-first discipline for edge-case fixes.

## Eight Modules, Eight Red-Green Pairs

The pre-squash history on `abhip/mr-notif-cleanup` reads top-to-bottom as a textbook TDD walk. Module order goes from leaves to roots so each red commit can only fail because the module it directly targets is missing:

```
011ed369 test(mr-bot): red — healthz endpoint returns ok
a6666ccc feat(mr-bot): green — healthz endpoint returns {ok: true}

8c0b26df test(mr-bot): red — extract Linear ticket from branch/title/description
1fdc6876 feat(mr-bot): green — extract Linear ticket id from MR metadata

d85bba94 test(mr-bot): red — Settings env loading + UserMap mtime reload
f68a1324 feat(mr-bot): green — Settings + UserMap with mtime-cached reload

33daa7be test(mr-bot): red — classify GitLab MR webhook payloads
f56693f4 feat(mr-bot): green — classify webhook payloads into transitions

dc043583 test(mr-bot): red — Redis store with msg_id, summary cache, NX lock
b5a55008 feat(mr-bot): green — Redis store for msg_id, summary cache, NX lock

73e84644 test(mr-bot): red — Gemini summarizer with truncation fallback
09085c9e feat(mr-bot): green — Gemini Flash summarizer with truncation fallback

e7588560 test(mr-bot): red — Discord client (build_embed, post_new, patch_existing, post_followup)
9f050033 feat(mr-bot): green — Discord client for embed posting and editing

8e131e34 test(mr-bot): red — webhook route integration (auth, classify, post/patch, ping, follow-up)
58d12ef8 feat(mr-bot): green — wire webhook route with auth, summary cache, lock, ping, follow-up
```

Eight pairs. None of the green commits introduced behavior the corresponding red commit didn't already pin down with an assertion.

## Why the Order Matters

I deliberately wrote the modules leaves-first (`healthz`, `linear`, then `config`, `transitions`, `store`, `summarize`, `discord`, finally `main` which wires it all together). That's not arbitrary; it's what made red-green tractable on a multi-module service.

If I'd started with the webhook route (`main.py`), the very first red commit would need fakes for Settings, Redis, Gemini, and Discord all at once. The "minimum implementation to make the test compile" would balloon into half the service. Starting with leaves keeps each red focused on one contract:

- The `transitions.red` test only knows about GitLab webhook payloads and a `Transition` dataclass. It does not know Redis exists.
- The `store.red` test only knows about Redis keys and a `Store` class. It does not know GitLab payloads exist.
- The `main.red` test wires real Settings + fake Redis + fake Gemini + fake Discord together, but each of those fakes implements an interface that was already pinned by its module's own red-green pair.

This is the practical version of "test the units, then test the integration." Doing it commit-by-commit means I never had a moment where I was implementing two things at once.

## A Concrete Walk: The Classify Red

Here's the shape of one red commit, the classify test (`33daa7be`). The webhook classifier maps a GitLab merge_request payload to one of four transition kinds (OPENED, DRAFTED, MERGED, CLOSED) or to `None` when the payload isn't actionable. The red test pinned every transition table row before the implementation:

```python
def test_classify_open_not_wip_returns_opened():
    payload = _payload(action="open", work_in_progress=False)
    t = classify(payload)
    assert t is not None and t.kind == "OPENED"

def test_classify_open_wip_returns_drafted():
    payload = _payload(action="open", work_in_progress=True)
    t = classify(payload)
    assert t is not None and t.kind == "DRAFTED"

def test_classify_update_wip_true_to_false_returns_opened():
    payload = _payload(
        action="update",
        work_in_progress=False,
        changes={"work_in_progress": {"previous": True, "current": False}},
    )
    t = classify(payload)
    assert t is not None and t.kind == "OPENED"

def test_classify_non_merge_request_object_kind_returns_none():
    assert classify({"object_kind": "push"}) is None

def test_classify_missing_iid_returns_none():
    assert classify({"object_kind": "merge_request",
                     "object_attributes": {"action": "open"}}) is None
```

The "missing iid returns None" case is the design decision the test forced me to make. A GitLab webhook with no `iid` is malformed; should the classifier crash with KeyError, raise a custom exception, or return None? Returning None is the safest because the route can decide whether to log-and-skip or 4xx-the-caller. That decision lived in the test before any classifier code existed (see `services/sira-mr-bot/src/sira_mr_bot/transitions.py:33` for the implementation).

## Edge-Case Hardening Stayed Red-First

MR !276 (SIRA-355 edge-case hardening) shipped four additional red-green pairs. The service was running in CI by then but had several "what happens when..." gaps:

```
0a3c5029 test(mr-bot): red — Discord 200 missing id field
8394d176 fix(mr-bot): raise DiscordResponseError on 200 with missing id

5b362b7a test(mr-bot): red — missing iid in classify
844b1ddd fix(mr-bot): return None from classify when iid is missing or invalid

8d2add70 test(mr-bot): red — Discord 429 single retry
8476c0f1 fix(mr-bot): retry once on Discord 429 with capped Retry-After backoff

d18c8c64 test(mr-bot): red — webhook fail-open when Redis is down
67a895eb fix(mr-bot): fail open on Redis errors and still post the Discord card
```

Each one is a real failure mode I considered after deployment: what if Discord returns 200 OK but no message id (it has happened)? What if Gemini's classify gets a malformed iid (some webhooks omit fields)? What if Discord rate-limits us with 429? What if Redis is briefly unavailable? The discipline of writing the red first means I had to decide the contract before patching code. For the Redis fail-open case in particular, the red test pinned a behavior I would not have gotten right writing implementation-first: when Redis is down, the bot should **still** post the Discord card (we don't lose the notification) and just skip dedup until Redis recovers. That tradeoff was a deliberate decision, made in test, not a happy accident in implementation.

## Test Counts at Merge

MR !275 description records the test count at merge: **46 passing tests** across `test_config.py` (44 lines), `test_discord.py` (5.4k chars), `test_linear.py`, `test_main.py` (8.3k chars), `test_store.py`, `test_summarize.py` (4.3k chars), and `test_transitions.py`. Every one of those tests existed before the production code it covers. By MR !276, the count was higher because the four new edge-case tests landed red-first there too.

For the full repo: pre-push runs 2,233 tests across both apps. They were all green when this branch merged.

## What I Learned

Three patterns reinforced this week:

**Module order is part of the TDD plan, not an afterthought.** Starting with the integration test (`main.red`) would have forced me to fake every dependency before I had a contract for any of them. Leaves-first means each red commit pins exactly one contract, and the integration red at the end is small because every dependency it needs already has its own interface.

**Red-green discipline is more valuable on greenfield code than on patches.** When I'm patching existing code, the existing tests pin most of the behavior already. When I'm writing a new service from zero, the only thing forcing me to think before typing is the red commit. Without it, I would have written 680 lines of "looks fine" code with no contract anywhere.

**Edge-case fixes deserve the same rigor as features.** The four red commits in MR !276 took maybe 30 minutes total to write. Skipping them would have saved 30 minutes and produced fixes that "work in the case I was thinking of" rather than "satisfy a contract that survives review." The cost of TDD discipline scales sublinearly; the cost of skipping it scales with the number of edge cases you forgot.

## Evidence

- [MR !275 SIRA-354 replace CI-status card with MR-content card](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/275): 22 commits including 8 red-green pairs across modules
- [MR !276 SIRA-355 edge-case hardening](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/276): 4 additional red-green pairs for Discord 200-without-id, missing iid, 429 retry, Redis fail-open
- Pre-squash red-green commit pairs (mr-bot modules): `011ed369`/`a6666ccc` (healthz), `8c0b26df`/`1fdc6876` (linear), `d85bba94`/`f68a1324` (config), `33daa7be`/`f56693f4` (transitions), `dc043583`/`b5a55008` (store), `73e84644`/`09085c9e` (summarize), `e7588560`/`9f050033` (discord), `8e131e34`/`58d12ef8` (main webhook route)
- Pre-squash red-green commit pairs (edge cases): `0a3c5029`/`8394d176`, `5b362b7a`/`844b1ddd`, `8d2add70`/`8476c0f1`, `d18c8c64`/`67a895eb`
- Source: `services/sira-mr-bot/src/sira_mr_bot/{transitions,store,summarize,discord,main,config,linear}.py` and matching `services/sira-mr-bot/tests/test_*.py`
- Test count at MR !275 merge: 46 mr-bot tests + 2,233 repo-wide tests passing
