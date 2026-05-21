---
title: "[S4, W2] PPL: Applying New Patterns and Training a New Agent"
date: 2026-05-20
description: "Three programming patterns I hadn't used in SIRA before all landed this week (slot-based React modal, actor_role keyword-only argument across service layers, snapshot-based optimistic locking). Plus a different kind of aptitude: training yanto to handle SIRA merges autonomously through a single Discord message that taught the squash convention."
tags: ["ppl", "aptitude"]
slug: "s4w2-aptitude"
toc: true
---

## What I Worked On

Last week's c1 was about applying four unfamiliar technologies (Gemini SDK, Discord PATCH, Redis SETNX, FastAPI lifespan). This week's aptitude was less about new technologies and more about applying patterns I had read about but never used in this codebase, plus a non-technical aptitude moment: training yanto (the team's Discord agent) to handle SIRA merges autonomously.

Four things to walk through:

1. **Slot-based modal** (`RequestPermissionModal`): one React component serves 8 action types via props instead of inheritance
2. **`actor_role` keyword-only argument**: same service method serves routers, executors, and tests with different role semantics
3. **Snapshot-based stale guard**: optimistic locking applied at the application layer for admin approval flows
4. **Agent memory training**: codifying the squash-only convention into yanto's persistent memory in 20 seconds of Discord

## Slot Pattern: First Time Using It in React

The Permission Request system has 8 distinct action types (delete_client, cancel_invoice, edit_invoice_financial, edit_client_legal, edit_payment, edit_email_template, edit_telegram_template, delete_invoice). The naive build is 8 separate modal components, each a copy-paste of the same scaffolding. I'd seen the "render props" or "slot" pattern in other codebases (notably Radix UI primitives) but had never reached for it in SIRA.

The shape that landed in `apps/web/src/components/request-permission-modal.tsx`:

```tsx
type RequestPermissionModalProps = {
  open: boolean
  onClose: () => void
  actionType: ActionType
  targetType: PermissionTargetType
  targetId: string
  // Extension points
  payloadSlot?: React.ReactNode
  buildPayload: () => Record<string, unknown>
}
```

The modal owns the reason field, character counter, validation, submit handler, loading state, and error surfacing. The caller owns whatever per-action fields they need, supplied via `payloadSlot` (the JSX) and `buildPayload` (the function that produces the submission payload from caller-controlled state).

The reason this is an aptitude moment and not just "I wrote a modal" is the project-fit decision. I could have:
- Subclassed: one base class, 8 subclasses, each overriding `renderFields()` and `buildPayload()`. Java-style. Works but the React community uses props for this, and SIRA uses functional components throughout. Subclassing would have been off-pattern.
- Generic-typed: `RequestPermissionModal<T extends ActionType>` with conditional types. More type-safe but harder to read. The actual 8 action types don't share structure, so the generic types would have been mostly `unknown` anyway.
- Slot-based with `payloadSlot` + `buildPayload`. Idiomatic React, matches Radix conventions, no inheritance.

The third was the right answer for this codebase. The aptitude part isn't knowing the pattern; it's knowing why it fits here and not the other two.

## actor_role Keyword-Only: Applying DIP Across Layers

`InvoiceService.cancel(invoice_id, *, actor_role=None)` is the pattern from b2's blog. The aptitude lens is that this was the first time I structured a service method to receive role context as an explicit dependency rather than reading it from a thread-local or request scope.

The shape and the three call sites:

```python
# Router (direct call as user)
await invoice_service.cancel(invoice_id, actor_role=user.role)

# Executor (admin-approved staff request)
await invoice_service.cancel(invoice_id, actor_role=reviewer.role)

# Internal job (no auth)
await invoice_service.cancel(invoice_id)
```

I'd seen this pattern in framework docs (Django's `request_user` injection, Spring Security's principal pattern) but never implemented it from scratch in our FastAPI codebase. The `*,` syntax forcing keyword-only is the small detail that prevents the most common future bug: a refactor that accidentally passes role positionally, lining up with `invoice_id`. Without the `*,`, the bug would be silent. With it, the call site must name the argument.

Applying the pattern correctly meant updating three layers in coordination: service signature, router invocation, and executor invocation. Each layer has different reasons for passing the role (router knows from auth, executor knows from approval, jobs explicitly opt out). Getting them all aligned in one MR was the aptitude work.

## Snapshot-Based Stale Guard: Optimistic Locking at the App Layer

The permission_request approval flow needs to handle the case where the target row mutated between staff-submit and admin-approve. Database-level optimistic locking (e.g., a `version` column with compare-and-swap) is the classic answer, but it produces a constraint violation that doesn't carry enough context to render a useful admin UI.

The pattern I landed on stores an `expected_state` snapshot at submit time, re-computes the snapshot at approve time, compares them structurally, and surfaces the diff if they don't match:

```python
async def approve(
    self,
    request_id: str,
    *,
    reviewer: AuthenticatedUser,
) -> PermissionRequest:
    request = await self._load_pending_request(request_id)
    current_state = await self._snapshot_target(
        request.target_type, request.target_id
    )

    if current_state != request.expected_state:
        await self._mark_stale(request_id, current_state)
        raise StaleStateError(
            f"Target {request.target_type} {request.target_id} changed "
            f"since submit; please refresh the queue and re-evaluate."
        )

    await self._executors[request.action_type](reviewer, request)
    return await self._mark_approved(request_id, reviewer)
```

The aptitude angle: I had read about optimistic locking in distributed-systems contexts (Riak, CockroachDB) but had never built one for an admin-review workflow. The two adaptations from textbook OL: (1) compare at the application layer because the admin UI needs the diff, and (2) keep the snapshot scope tight to fields that matter for the action (cancel_invoice cares about status and amount, edit_client_legal cares about company_name and tax_id, etc.). Snapshotting the entire row would have caused spurious "stale" errors on irrelevant changes.

## Training yanto: A Different Kind of Aptitude

The fourth aptitude moment is non-technical. After yanto autonomously merged MR !316 on 2026-05-20 evening, it ran into a 422 error from GitLab on the first merge attempt because the project requires squash. Yanto figured out the convention by retrying with `squash=true`. The merge succeeded but the convention discovery cost one round-trip.

I trained it:

```
[16:59] praya: save ke memory lu bro, tiap merge selalu squash
jadi next kali buat SIRA, default merge pake squash enabled ya bro

[17:00] yanto: sip, udah gua simpen
```

Two lines of Indonesian-casual Discord typing. yanto wrote the rule to its persistent memory file (`~/.hermes/memories/USER.md` on the VPS, since the rule is about Abhip's projects). Next SIRA merge yanto handles will set squash on the first call.

This is aptitude in agent-collaboration patterns. The skill is recognizing the moment ("yanto just learned a thing by failing; capture it") and knowing the agent's memory API ("save ke memory" is the verb that triggers durable storage). Without that recognition, the 422 retry would happen on every future merge yanto handles. With it, the cost is zero from now on.

The broader pattern: any time an agent OR a new teammate trips on an unwritten project rule, the right immediate response is to write the rule down somewhere durable. For a human, that's a CONTRIBUTING file or an AGENTS.md update. For an agent, it's the agent's memory file. The pattern is the same; the storage is different.

## ui-ux-pro-max as Workflow Aptitude

A smaller aptitude moment: the FE design for MR !308 (Permission Request UI) was driven by the `ui-ux-pro-max` skill. I gave it the brief ("internal admin queue page for permission request approval in a productivity SaaS context") and it returned concrete recommendations:

- Typography: Plus Jakarta Sans (already in the project)
- Style family: flat design (matches the rest of the app)
- Transition timing: 150-300ms range
- Status badge convention: amber/emerald/red mapping to PENDING/APPROVED/DENIED

The MR description literally cites this: "Followed the `ui-ux-pro-max` recommendation pass (productivity / internal dashboard SaaS, Plus Jakarta Sans, flat design, 150-300ms transitions). Matched the existing app's visual language."

I'd installed the skill weeks ago but never invoked it for a real MR until now. The aptitude moment is recognizing the right use case (internal CRUD with established conventions) and the right NOT-use case (I would not use this for a customer-facing landing page where actual design talent is needed). Knowing when a skill applies is more useful than knowing it exists.

## What I Learned

**Pattern fit beats pattern knowledge.** I had read about slot-based components, keyword-only DIP, and optimistic locking before. Applying each one this week required deciding why it fit THIS codebase and not the alternatives. Knowing the pattern is necessary; choosing it correctly is the harder part.

**Agent memory is the cheapest infrastructure improvement.** Twenty seconds of Discord typing turned a recurring 422 retry into a one-time event. Any time an agent trips on a convention twice, the rule needs to be written into memory. The cost is always lower than the recurring re-discovery.

**Skills work best for tasks with established conventions.** ui-ux-pro-max gave good recommendations for the Permission Request UI because the app already had Plus Jakarta Sans, the StatusBadge pattern, and the TableEmptyState component. The skill's job was to surface "use the things you already have." Tighter project conventions, more useful skill output.

## Evidence

- [MR !308 SIRA-208 SIRA-209 FE permission request UI](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308): slot-based modal, ui-ux-pro-max-driven design
- [MR !310 SIRA-374 RBAC bypass closure](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310): `actor_role` keyword-only argument across service / router / executor
- [MR !307 SIRA-207 BE permission request system](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/307): snapshot-based stale guard pattern
- Source: slot-based modal: `apps/web/src/components/request-permission-modal.tsx`
- Source: `actor_role` propagation: `apps/api/src/app/services/invoice_service.py`, `apps/api/src/app/routers/invoices.py`, `apps/api/src/app/services/permission_request_executor.py`
- Source: snapshot guard: `apps/api/src/app/services/permission_request_service.py`
- yanto memory training: Discord `#dev` 2026-05-20 16:59-17:00 ("save ke memory lu bro, tiap merge selalu squash" → "sip, udah gua simpen")
- yanto memory file (on VPS): `~/.hermes/memories/USER.md` (persistent across sessions)
- ui-ux-pro-max skill location: `~/.agents/skills/ui-ux-pro-max/SKILL.md`
- ui-ux-pro-max cited in [MR !308 description](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308)
