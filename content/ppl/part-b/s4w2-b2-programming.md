---
title: "[S4, W2] PPL: One Modal for Eight Actions, One Argument for All Callers"
date: 2026-05-20
description: "Three programming patterns from the Permission Request system: a slot-based modal that handles 8 different action types without forking, an actor_role keyword-only argument that lets the same service method serve routers, executors, and tests, and a snapshot-based stale guard that catches concurrent admin approvals against changed targets."
tags: ["ppl", "programming", "solid"]
slug: "s4w2-programming"
toc: true
---

## What I Worked On

The Permission Request system (MRs !307, !308, !310) shipped end-to-end this week. The programming patterns that emerged are different shape from last week's sira-mr-bot work: less "new service from scratch" and more "extend an existing system without forking it." Three patterns worth writing down:

1. The **slot pattern** in `RequestPermissionModal`: one component serves 8 action types because the per-action fields slot in via props instead of subclassing.
2. The **`actor_role` keyword-only argument** in `InvoiceService.update` / `.cancel`: the same service method is called by routers (as the user), by permission-request executors (as the approving admin), and by tests (without auth context at all).
3. The **snapshot-based stale guard** in the permission request approval flow: the staff-submitted snapshot is verified against current DB state at approval time, so a target row that mutated between submit and approve gets rejected with a 409.

## The Slot Pattern: One Modal for Eight Actions

PBI 45 has eight distinct action types AR_STAFF can request:

```
delete_client, cancel_invoice, edit_invoice_financial,
edit_client_legal, edit_payment, edit_email_template,
edit_telegram_template, delete_invoice
```

Each one has different per-action fields. `delete_client` needs nothing beyond the reason; `cancel_invoice` needs no extra fields either but the modal opens from a different page; `edit_invoice_financial` needs the new amount and due date; `edit_payment` needs payment-specific fields. The naive design is one modal per action type: `DeleteClientRequestModal`, `EditInvoiceFinancialRequestModal`, etc. That's 8 component files, each one a copy-paste of the same scaffolding (reason field, character counter, submit handler, error state).

The pattern actually shipped uses a single `RequestPermissionModal` with two extension points:

```tsx
type RequestPermissionModalProps = {
  open: boolean
  onClose: () => void
  actionType: ActionType
  targetType: PermissionTargetType
  targetId: string

  // Extension points: caller controls the per-action payload
  payloadSlot?: React.ReactNode
  buildPayload: () => Record<string, unknown>
}
```

`payloadSlot` is whatever JSX the caller wants to render inside the modal body (e.g., an amount input for `edit_invoice_financial`). `buildPayload` is the caller-provided function that produces the submission payload from whatever state those inputs hold. The modal owns the reason field, the character counter, the validation, the submit button, the loading state, the error surfacing. The caller owns the action-specific stuff.

So the integration point on the client detail page reduces to:

```tsx
<RequestPermissionModal
  open={open}
  onClose={() => setOpen(false)}
  actionType="delete_client"
  targetType="CLIENT"
  targetId={clientId}
  buildPayload={() => ({})}  // no extra fields for delete
/>
```

And on the invoice edit page (forthcoming, but the same shape):

```tsx
<RequestPermissionModal
  open={open}
  onClose={() => setOpen(false)}
  actionType="edit_invoice_financial"
  targetType="INVOICE"
  targetId={invoiceId}
  payloadSlot={
    <>
      <AmountInput value={amount} onChange={setAmount} />
      <DateInput value={dueDate} onChange={setDueDate} />
    </>
  }
  buildPayload={() => ({ amount, due_date: dueDate.toISOString() })}
/>
```

Zero new component files for each new action type. Zero duplicated scaffolding. The pattern scales to 100 action types with the same modal.

This is the Open/Closed principle in React component form: the modal is open for extension (via `payloadSlot` + `buildPayload`) and closed for modification (the reason field, submit flow, error handling don't change per action). Adding a new action type means adding one integration point at the relevant page, not modifying the modal at all.

## actor_role: One Service Method, Three Callers

The Permission Request system has a tricky calling pattern. When AR_STAFF submits a `cancel_invoice` request, the flow is:

```
1. UI submits to POST /permission-requests
2. BE stores a row in permission_requests (status=PENDING)
3. Admin reviews on /admin/approval-queue
4. Admin clicks "Approve"
5. UI calls PUT /permission-requests/{id}/approve
6. BE marks the request APPROVED
7. BE invokes _execute_cancel_invoice(reviewer, request)
8. Executor calls InvoiceService.cancel(invoice_id) — AS THE ADMIN
```

Step 8 is where the design choice lives. The same `InvoiceService.cancel()` method is called from:

- The router for direct admin cancel (`POST /invoices/{id}/cancel` by an admin)
- The executor for staff-requested cancel (admin-approved via permission_request)
- Internal jobs (overdue auto-cancel, never user-facing)
- Unit tests (no auth context at all)

The original method signature didn't distinguish callers. Adding role enforcement at the router level worked for direct calls but broke the executor (which is itself called from a router that runs as admin, so a router-level gate would have rejected the executor). Adding it inside the service worked, but only if the service knew the caller's role.

The shape that landed:

```python
class InvoiceService:
    async def cancel(
        self,
        invoice_id: str,
        *,
        actor_role: str | None = None,
    ) -> Invoice:
        if actor_role == ROLE_AR_STAFF:
            raise PermissionError(
                "AR_STAFF cannot cancel invoices directly; submit a "
                "permission request for admin review."
            )
        # ... existing cancel logic unchanged ...
```

`actor_role` is keyword-only (the `*,` enforces this) and defaults to `None`. The default means "trust the caller; this is not a router-facing call." Callers that care about RBAC pass an explicit value:

```python
# Router (direct cancel)
await invoice_service.cancel(invoice_id, actor_role=user.role)

# Executor (admin-approved staff request)
await invoice_service.cancel(invoice_id, actor_role=reviewer.role)

# Internal job
await invoice_service.cancel(invoice_id)  # default None, no gate

# Test
await invoice_service.cancel(invoice_id)  # default None, no gate
```

This is the Dependency Inversion principle in action: the service depends on an abstract concept (the actor's role), not on a concrete authentication system (FastAPI's `current_user` dependency). The router knows about FastAPI auth. The executor knows about the permission_request flow. The service knows neither; it just asks "what role is acting?" and applies the rule.

The keyword-only constraint (`*,`) is the small detail that prevents the most common future bug: someone refactors a caller and accidentally passes the role as a positional argument, which then silently lines up with `invoice_id` and breaks production. Keyword-only forces every call site to name the argument, which makes the dependency obvious in every call.

## The Snapshot-Based Stale Guard

The third pattern is in the permission_request approval flow. When an admin clicks "Approve" on a pending request, the BE has to handle the case where the target row changed between submit and approve. Example: staff submits "cancel invoice X" while X is UNPAID. Before admin reviews, someone marks X as PAID. If admin approves without checking, the BE would try to cancel a PAID invoice and either fail with a generic error or (worse) silently cancel a paid invoice.

The defensive design:

1. **At submit time**, the BE writes the request with a `expected_state` snapshot: the target row's current values for fields that matter to the action.
2. **At approve time**, the BE re-reads the target row, computes the current snapshot, and compares to `expected_state`.
3. **If they don't match**, the request is marked `STALE`, the admin sees a 409 with a banner explaining what changed, and the executor is NOT run.

A simplified slice from `permission_request_service.py`:

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
            f"Target {request.target_type} {request.target_id} changed since "
            f"submit; please refresh the queue and re-evaluate."
        )

    await self._executors[request.action_type](reviewer, request)
    return await self._mark_approved(request_id, reviewer)
```

`_snapshot_target` returns a dict of the fields that matter for the action type. For `cancel_invoice`, that's `{status, amount}`. For `edit_client_legal`, that's `{company_name, address, tax_id}`. The comparison is structural: two dicts are equal if they have the same keys and same values.

The pattern is similar to optimistic locking in databases (compare-and-swap), but the comparison is at the application layer, not the DB layer. The reason to do it at the application layer: the admin UI needs the staleness info to display a meaningful banner. A pure DB-level CAS would return "constraint violation," not "the invoice status changed from UNPAID to PAID." Surfacing the actual diff is what makes the 409 actionable.

The UI handles this on the approval queue page:

```tsx
{request.is_stale && (
  <Banner variant="amber">
    Permintaan ini stale: target berubah sejak diajukan. 
    Lihat snapshot expected_state vs current state di bawah, 
    lalu putuskan apakah perubahan ini masih bisa di-approve.
  </Banner>
)}
```

The admin can still approve if they decide the change is fine (e.g., the staff submitted "edit amount" while the invoice was UNPAID, but it's now PARTIAL and the amount change is still valid). Or they can deny because the underlying situation changed. The point is the system surfaces the staleness, not silently overwrites or silently rejects.

## What I Learned

**Slot-based components scale further than subclass-based ones.** Eight action types in PBI 45 means I would have written eight modal files if I'd gone subclass-first. Instead I wrote one. The next two sprints will add two more action types (`delete_invoice` once a domain rule is lifted, and a couple of payment-edit variants). Adding them won't touch the modal at all. That's the Open/Closed payoff: the cost of extending stays flat as the system grows.

**Keyword-only arguments enforce dependency intent.** The `actor_role` parameter exists to make role-based authorization explicit at every call site. Making it positional would have let callers pass it accidentally. Making it keyword-only (`*,`) forces every caller to name the dependency, which makes "this code path cares about RBAC" visible in every file that touches it.

**Defensive snapshots beat defensive flags.** The original PBI 45 design discussion had a `force_approve=true` flag on the approve endpoint for the admin to override staleness. I cut that in implementation. The snapshot pattern is honest: it surfaces the actual diff to the admin, who can decide. A `force_approve` flag hides the decision behind a checkbox. The snapshot approach is more code but produces a better UI affordance.

## Evidence

- [MR !307 SIRA-207 BE permission request system](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/307): snapshot-based stale guard, executor dispatch
- [MR !308 SIRA-208 SIRA-209 FE permission request UI](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/308): `RequestPermissionModal` with `payloadSlot` + `buildPayload`
- [MR !310 SIRA-374 RBAC bypass closure](https://gitlab.lab.local/joint-research/ui/smart-invoice-reminder/SIRA/-/merge_requests/310): `actor_role` keyword-only argument across service / router / executor
- Source (slot modal): `apps/web/src/components/request-permission-modal.tsx`
- Source (actor_role): `apps/api/src/app/services/invoice_service.py`, `apps/api/src/app/routers/invoices.py`, `apps/api/src/app/services/permission_request_executor.py`
- Source (snapshot guard): `apps/api/src/app/services/permission_request_service.py`
- Source (single source of truth for UI labels): `apps/web/src/lib/permission-request-labels.ts`
- Design reference: PBI 45 staff permission request system, [SIRA-189 epic on Linear](https://linear.app/ppl-sira/issue/SIRA-189)
