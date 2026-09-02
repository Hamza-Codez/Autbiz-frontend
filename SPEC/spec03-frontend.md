# spec03.md — Proposal and approval queue (UI)

**Phase 2 · Backend: `Autbiz-backend/SPEC/spec03-backend.md`**

---

## The problem

The backend can now calculate an adjustment, hold it for approval, and turn it
into a credit. Nobody can do any of that, because there is no screen for it.

This phase is where a human performs the whole approval cycle — propose,
wait, approve — end to end. That matters beyond the feature: Phase 4's agent
performs the *same* cycle against the *same* services, and `ARCHITECTURE.md` §6
requires that the agent, a human in the UI, and a direct API caller all hit the
same gate. If the UI needed a special path, the gate would not be one gate.

**This is also the screen most likely to be built wrong in a specific way:** by
treating a 202 as a completion.

---

## Ground rules inherited

From `ARCHITECTURE.md`:

- §6 — route guards and per-role navigation are UX, never security.
- §7 — `APPROVAL_REQUIRED` is a normal, successful result to be narrated
  honestly. It is not an error and must not be rendered as one.
- §8 — the two staleness mechanisms have two distinct messages, each naming its
  remedy.

From `rules.md`: `AUT-2` (no client-side amounts), `AUT-11`, `AUT-13`, `AUT-20`.

From `sops.md`: §6 gates, §7 generated types.

---

## Screens

### Proposing a credit — on `/orders/[orderId]`

A three-step flow, and **the user types no number at any point.**

1. **Select a logged issue.** Only issues already recorded on the order are
   selectable. There is no free-text field, no "other", and no way to describe an
   issue that is not there. An order with no logged issue offers nothing to
   select and says why.
2. **Request the calculation** — `POST /orders/{id}/adjustments` with the issue
   id. The server returns the amount and its basis. **Render both.** The basis is
   the answer to "where did this figure come from", and hiding it makes the number
   look arbitrary to the person being asked to approve it.
3. **Submit for approval** — `POST /credits` with the adjustment id.

The response is **202**. Render it as what it is:

> Proposed a credit of $73.00. Awaiting approval from a supervisor.

**Never render a success toast saying the credit was applied.** Nothing was
applied. This is the single most likely defect in this phase, it will look
correct in every screenshot, and it will be discovered by a customer who was told
they were credited and was not.

Eligibility refusals (409 `ORDER_OUTSIDE_CREDIT_WINDOW`, `ISSUE_NOT_ELIGIBLE`,
`CREDIT_ALREADY_ISSUED`) render the envelope's `message`, which names the remedy.
The UI does not substitute its own copy.

### `/approvals` — the queue

Visible only to principals with `approvals:write` — **UX only**; the endpoint is
guarded regardless.

Each row shows the order, the issue, the amount, the basis, who initiated it, and
when it expires. Expiry is evaluated by the server on read (`AUT-11`), so a row
can arrive already expired with no write having happened. Render an expired row
as expired and offer no approve control.

**A request the current user initiated shows no approve control.** That is UX
(`AUT-4` is a database constraint, and the server returns 409 `SELF_APPROVAL`
regardless) — but a button that always fails is a bad button. Show why it is
absent: *"You proposed this. It needs a different approver."*

Approving returns **201** and a credit. *That* is a completion, and it says so.

Rejecting returns 200. Both refresh the queue.

### `/credits` — history

Paginated, filterable by order and customer. Read-only. Shows the credit, its
adjustment, and who approved it.

### Handling the two staleness failures

A 409 on approval is not a generic error. Render the server's message verbatim
and give the user the action it names:

| Code | The action the screen must offer |
|---|---|
| `STALE_CALCULATION` | Re-run the calculation on the order and submit a new approval. |
| `PROPOSAL_EXPIRED` | Re-run the calculation to get a current figure. |

Both messages already name the remedy. The screen's job is to make that remedy
reachable in one click, not to paraphrase it.

---

## Reasoning for anything surprising

**Why the basis is displayed and not just the amount.** The approver is the
control that the whole architecture rests on. An approver shown only a figure is
rubber-stamping; an approver shown the figure and how it was derived is
reviewing. The basis costs one line of UI and is the difference.

**Why there is no amount input, anywhere, at any permission level.** Not even for
an admin, not even "to override". The backend has no field to receive it
(`AUT-2`), so an input would be a control that cannot work — and the first person
who asks for one is describing an architectural escalation
(`ARCHITECTURE.md` §13), not a UI change.

**Why the initiator still sees their own pending request.** They need to know it
is waiting, and on what. Hiding it would make "did my proposal go through?"
unanswerable and invite a duplicate proposal.

**Why `Idempotency-Key` is generated when the form opens, not when submit is
pressed.** The key is recorded only on success. Generating per attempt makes a
retry after a validation error look like a new operation; generating per form
opening makes the retry idempotent, which is the point.

---

## Tests

### Component

- The proposal flow renders the server's amount **and** basis.
- A 202 renders "awaiting approval" copy and **never** applied/success copy —
  asserted against the actual response fixture.
- A 409 renders the envelope `message`, not a hardcoded string, for each of the
  eligibility and staleness codes.
- `STALE_CALCULATION` and `PROPOSAL_EXPIRED` render **different** copy and
  different offered actions.
- An order with no logged issues renders an explanation and no selectable issue.
- The queue hides the approve control on a row the current user initiated, with
  the reason shown.
- An expired row renders as expired and offers no approve control.
- Submit controls are disabled while a request is in flight and re-enabled on
  both success and failure.
- The idempotency key is stable across retries within one form opening and
  differs across openings.

### Production build — part of the gate

```bash
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

### Rendered verification

Drive a real browser through the full cycle with two accounts:

- Operator proposes; the screen says awaiting approval.
- The operator's own queue row offers no approve control.
- Supervisor approves; a credit appears in history and the account balance moves.
- Amount columns align; **measure computed styles**, not class names.

---

## Blocking open decisions

- **§12.1 — credit amount arithmetic.** The proposal screen has no figure to
  render until the backend can produce one.
- **§12.5 — approval TTL.** The queue's expiry presentation and its test need a
  defined lifetime.
- **§12.9 — idempotency retention window.** Affects how long a replayed key
  returns the original result.

---

## Definition of done

- [ ] §12.1, §12.5, §12.9 resolved
- [ ] Types regenerated from the live schema and re-exported
- [ ] Proposal flow renders server amount and basis; **no amount input exists**
- [ ] No client-side arithmetic on any monetary value
- [ ] 202 renders as awaiting approval, never as applied
- [ ] Both staleness codes render distinct copy and distinct offered actions
- [ ] Queue hides the approve control for the initiator, with a reason
- [ ] Expired rows render as expired
- [ ] `Idempotency-Key` generated per form opening
- [ ] Frontend gate: type check, lint, tests
- [ ] Clean production build
- [ ] Full two-account cycle verified in a real browser

---

## As Built

Phase 2, frontend. The proposal flow on the order detail, and `/approvals`.

### The 202, which is the whole point

`POST /credits` returns **202 `APPROVAL_REQUIRED`** and the screen renders
"Awaiting approval — **nothing has been applied yet**". It never says applied,
never says success.

Three assertions guard it, including that the words "credit applied" never
appear. This is the single most likely defect in the codebase: it looks correct
in every screenshot and is discovered by a customer who was told they had been
credited and had not.

### Decisions

**No amount input exists, at any permission level.** The backend has no field to
receive one (`AUT-2`), so an input would be a control that cannot work. A test
asserts no numeric or amount-named input is present anywhere in the flow.

**Both screens render the basis, not just the total** — the SKUs, quantities and
unit amounts the figure was summed over. An approver shown a number is
rubber-stamping; one shown its derivation is reviewing.

**One queue.** When Phase 3 adds cancellation approvals they appear here too; a
second queue would let a supervisor clear one and believe they were done.

**The approve control is hidden on your own proposal, with the reason shown.**
UX only — `AUT-4` refuses it at the database and the service returns 409
regardless — but a button that always fails is a bad button.

**Expired rows are rendered as expired, not hidden.** `AUT-11`: expiry is
evaluated server-side on read, so a row can arrive already expired with no write
having happened. Hiding it would leave its initiator wondering where the
proposal went.

**Refusals render the envelope verbatim.** `STALE_CALCULATION` and
`PROPOSAL_EXPIRED` are different situations with different §8 messages, and each
already names its remedy.

### Two defects found while building

**The queue wiped its own refusal message.** `decide()` set the error, then
triggered a reload whose success path called `setError(null)` — so a refused
approval flashed its reason and then showed nothing. The supervisor would see an
unchanged row with no explanation, which reads as a dead button. It no longer
reloads on failure.

**The calculated figure had no accessible name.** A screen reader announced a
bare "20.00", and the same number appears again as a line total below it. Adding
`aria-labelledby` fixed the ambiguity in the UI and in the test at once — the
test was failing for a real reason.

### Verified in a real browser, two accounts

Operator finds an order with an open issue, calculates **960.00**, submits, and
sees "nothing has been applied yet". Supervisor opens the queue, sees the amount
**with its basis** (`PMP-200 × 2 = 960.00`), approves, and the queue empties. No
console errors, no failed requests.

**This is what found the CSRF defect** — every mutation through the real proxy
returned 403, invisible to 27 passing component tests and 83 passing backend
tests. Fixed in the backend and recorded in `rules.md` §23.

27 tests, clean production build, `npm run check:rendered` 12/12.

### Not done

- **Not deployed.**
- **No UI for logging an issue.** §12.3 resolved to
  `POST /orders/{id}/issues` and the endpoint exists, but nothing calls it from
  the browser — issues had to be seeded to exercise the credit flow. Without a
  form the whole Phase 2 flow is unreachable through the product, which makes it
  the first thing Phase 3 should add.
- The rendered check covers login, shell nav and the orders table; the proposal
  and queue screens are not in it yet.
- No credit history screen. `GET /credits` exists and nothing renders it.
