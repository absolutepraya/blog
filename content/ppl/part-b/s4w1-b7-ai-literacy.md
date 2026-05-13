---
title: "[S4, W1] PPL: Gemini Flash in Production, With a Truncation Fallback"
date: 2026-05-13
description: "The new mr-bot service uses Gemini 2.0 Flash to summarize each MR description into a single 2-4 sentence paragraph for the Discord card. The interesting parts are the fallback when Gemini is down or returns malformed output, the prompt that fights Markdown drift, and the cost shape (free tier holds for our team)."
tags: ["ppl", "ai-literacy"]
slug: "s4w1-ai-literacy"
toc: true
---

## What I Worked On

The new sira-mr-bot service uses Gemini 2.0 Flash to summarize each MR description into a single plain paragraph that lands on the Discord card. The integration is the cleanest AI-in-product work I've shipped this semester because the failure modes (Gemini quota, Gemini timeout, Gemini returning Markdown structure, empty description) all have explicit handling, not "hope for the best."

Code lives at `services/sira-mr-bot/src/sira_mr_bot/summarize.py` (121 lines).

## Why Gemini Flash, Not OpenAI or Claude

Three constraints drove the model choice:

| Concern | Gemini 2.0 Flash | OpenAI gpt-4o-mini | Anthropic Haiku |
|---------|------------------|--------------------|--------------------|
| Free tier exists | Yes (15 RPM, 1500 RPD) | No | No |
| Latency p50 | ~800ms for 200-word summary | ~700ms | ~600ms |
| Markdown discipline (subjective) | Wobbly without strict prompt | Solid | Solid |
| Our MR volume | ~10-20 / day |: |: |

For a project that's pre-launch and student-budgeted, the free tier is the deciding factor. We post Discord cards for every team MR, plus edits when an MR transitions state, plus the occasional retry. Estimated worst case is ~50 Gemini calls per day, well inside the 1500 RPD free quota. If volume grows, the bot can absorb a paid upgrade without code changes (just swap the API key).

Gemini's looser Markdown discipline is the cost we accept for free. The fix lives in the prompt and a post-processing pass; see below.

## The Prompt That Fights Markdown Drift

Gemini Flash without careful prompting will happily return:

```
**Summary**

- Bullet point one
- Bullet point two

## Section header

Paragraph that's actually the summary.
```

Discord embeds don't render those headings well, and the bullet structure breaks our card layout. The prompt at `services/sira-mr-bot/src/sira_mr_bot/summarize.py:11` is six lines of hard rules:

```
Summarize this GitLab merge request as a SINGLE plain paragraph
of 2-4 sentences.

Hard rules for output format:
- Output exactly one paragraph of running prose. No line breaks inside the paragraph.
- Do NOT use Markdown headings (no `#`, no `##`), bullet lists (no `-`, `*`, `+`),
  or numbered lists (no `1.`).
- Inline `code`, **bold**, and *italic* are allowed inside the paragraph
  when they clarify a term.
- Be concrete: name what changed, not what the goal is. No fluff, no marketing language.
- 2-4 sentences. Longer than one sentence, shorter than five.

Example of the desired style:
The bot no longer sends a separate Discord follow-up message when a
merge request is merged, instead silently updating the existing card.
If the original Discord card is deleted, the bot now recovers by
posting a fresh card and re-binding its stored message ID for future
updates.
```

Three things the prompt does that matter:

**It names what NOT to do, specifically.** "No headings" alone leaves room for "well, the model thought ## was OK." Listing the exact characters (`#`, `##`, `-`, `*`, `+`, `1.`) leaves no room.

**It allows inline formatting.** Inline `code`, bold, and italic survive in Discord embeds and are useful for technical terms (`useState`, `pnpm`). Banning them entirely would dumb down the output.

**It gives an example of the target style.** The example summary at the end is from a real previous MR. Few-shot prompts with one good example outperform abstract instructions for style.

## The Post-Processing Pass

Even with the strict prompt, Gemini occasionally returns one heading or one stray bullet. Rather than fight harder with prompting (which has diminishing returns), I added a defensive flattener at `summarize.py:42`:

```python
_LEADING_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+")
_LEADING_BULLET_RE = re.compile(r"^\s{0,3}([-*+]|\d+\.)\s+")


def _flatten_to_paragraph(text: str) -> str:
    """Strip Markdown structure and collapse the output to a single paragraph."""
    cleaned_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = _LEADING_HEADING_RE.sub("", line)
        line = _LEADING_BULLET_RE.sub("", line)
        if line:
            cleaned_lines.append(line)
    return re.sub(r"\s+", " ", " ".join(cleaned_lines)).strip()
```

Per-line: strip leading `#` heading markers, strip leading bullet/numbered list markers, then join all lines with single spaces. The result is one paragraph of running prose regardless of what shape Gemini returned. Inline `**bold**` and `*italic*` survive because the regex only matches at line start.

This is defense-in-depth: the prompt tells Gemini what we want; the post-processor cleans up if Gemini drifts. Neither alone is enough; both together produce a one-paragraph summary every time.

## The Truncation Fallback

Gemini Flash sometimes fails: quota exceeded, network blip, the model returns an empty string. The bot's job is to post the Discord card *anyway*, with a degraded but reasonable summary. The fallback path at `summarize.py:101`:

```python
async def summarize(self, title: str, description: str) -> str:
    if not self._settings.GEMINI_API_KEY:
        return self.truncate(description)
    client = self._client or GoogleGenAiClient(self._settings.GEMINI_API_KEY)
    prompt = f"{_PROMPT_HEADER}Title: {title}\nDescription:\n{description or '(empty)'}"
    try:
        text = await client.generate(
            model=self._settings.GEMINI_MODEL,
            prompt=prompt,
            timeout_s=self._settings.GEMINI_TIMEOUT_S,
        )
    except Exception as exc:
        log.warning("gemini call failed: %s", exc)
        return self.truncate(description)
    flattened = _flatten_to_paragraph(text)
    if not flattened:
        return self.truncate(description)
    return flattened[: self._settings.SUMMARY_MAX_CHARS].rstrip()
```

Three fallback triggers, each handled the same way: call `self.truncate(description)`.

The `truncate` method just takes the raw MR description, hard-clips to `TRUNCATION_FALLBACK_CHARS` (configurable, default ~280 chars), and appends an ellipsis. It's not as good as a Gemini summary but it's strictly better than "no summary" and far better than crashing the webhook. The user sees a card with the first chunk of the MR description, which is what they would have seen in plain GitLab anyway.

Tests for this path pinned the contract before the code existed (red commit `73e84644`, green `09085c9e`). The contract: when Gemini fails, return the truncation, never raise.

## Cost Awareness

For an AI feature, "cost awareness" usually means "tokens × price." For our use, the relevant metric is "calls per day vs free quota." The bot posts a card on each MR open + edits on each transition. At ~10 MRs/day on our team, with ~3 transitions each on average, that's ~40 Gemini calls/day. Free tier is 1500 RPD. We're at ~3% of quota.

The cooldown lock (in `store.py`, separate from the Gemini client) ensures duplicate webhook deliveries don't trigger duplicate summaries. The summary cache (also `store.py`, keyed on `mr-bot:summary:<iid>:<commit_sha>`) returns the cached summary for the same MR + SHA combo so repeated edits don't re-summarize. Both are explicit cost-control mechanisms, not accidental ones.

## Claude as a Co-Author

Worth noting separately: the mr-bot service was built with Claude as a co-author. The MR description records this explicitly (`Co-Authored-By: Claude <noreply@anthropic.com>` in commits). Claude wrote a substantial fraction of the test scaffolding, the prompt engineering iterations, and the Dockerfile. I wrote the architectural decisions (Protocol-based dependency inversion, the truncation fallback, the post-processor as defense-in-depth), reviewed every line, and made the final call on every design tradeoff.

The pattern that works for me: Claude generates a first draft of well-scoped code (single module, clear contract from a red test), I read it carefully, push back on anything that doesn't fit the broader architecture, and iterate. The TDD discipline (red commits before greens) is mine, not Claude's; Claude can write tests but it can't decide which contracts matter for the project. That part still has to come from me.

## What I Learned

Three patterns from shipping this AI integration:

**Defense-in-depth on AI outputs, not just AI inputs.** The prompt says "no Markdown structure" but the post-processor strips it anyway. Either could fail (the prompt could be ignored; the regex could miss an edge case). Both together produce reliable output. AI integrations need the same belt-and-suspenders thinking as untrusted user input.

**A truncation fallback is the price of admission for shipping AI features.** Any feature that calls an external LLM needs a non-LLM degraded path. Gemini quota, timeouts, rate limits, and outages are all real failure modes. "Show the user the raw description" is a fine fallback; "the webhook crashes" is not.

**AI as co-author works when the architectural decisions stay with me.** Claude can write the code; the contract decisions (when to fail open vs fail closed, when to cache vs always-fresh, when to retry vs give up) are mine. Reversing this would produce code that compiles but doesn't fit. Keeping the decisions with me means the code fits the broader system even when Claude generated most of the lines.

## Evidence

- [MR !275 SIRA-354 mr-bot service with Gemini summarizer](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/275): initial integration
- [MR !296 enforce plain-paragraph summary format](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/296): prompt rewrite + post-processor hardening
- Source: prompt: `services/sira-mr-bot/src/sira_mr_bot/summarize.py:11`
- Source: post-processor: `services/sira-mr-bot/src/sira_mr_bot/summarize.py:42`
- Source: Gemini call with fallback: `services/sira-mr-bot/src/sira_mr_bot/summarize.py:101`
- Source: truncation: `services/sira-mr-bot/src/sira_mr_bot/summarize.py:94`
- Pre-squash red-green pair: `73e84644` (red) / `09085c9e` (green): Gemini summarizer with truncation fallback
- Co-authored commits: every mr-bot commit in `abhip/mr-notif-cleanup` carries `Co-Authored-By: Claude <noreply@anthropic.com>`
