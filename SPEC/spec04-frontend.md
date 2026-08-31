# spec04.md — Cancellation and the trace viewer (UI)

**Phase 3 · Backend: `Autbiz-backend/SPEC/spec04-backend.md`**

---

## The problem

Two gaps, and the second one is a product feature that looks like plumbing.

**Cancellation has no screen.** It is the second approval-gated operation and
must go through the same queue as a credit, or the queue is not one queue.

**The execution trace has no viewer.** `COMPLEXITY-FREEZE.md` records that the
trace in PostgreSQL *is a product feature, not just telemetry* — that is the
stated reason there is no external observability platform. A trace nobody can
read does not discharge that argument. Building the viewer now, before anything
writes a trace, means Phase 4 ships an agent whose behaviour is legible from its
first run rather than one that has to be debugged from the database.

---

## Ground rules inherited

From `ARCHITECTURE.md`: §6 (guards are UX), §7 (one execution, many runs;
`APPROVAL_REQUIRED` is a normal result), §8 (two staleness messages), §9 (the
minimum trace content).

From `rules.md`: `AUT-11`, `AUT-13`, `AUT-14`.

---

## Screens

### Cancellation — on `/orders/[orderId]`

The same three-step shape as a credit proposal, and the same rule: **the user
describes no outcome.**

1. Request the computation — `POST /orders/{id}/cancellations`.
2. Render the consequences the server computed. Not a summary of them, not an
   icon — the actual list, because this is what the approver will be deciding on.
3. Submit — `POST /cancellations/{id}/execute` → **202**.

Render the 202 as awaiting approval. **Never as cancelled.** A screen that says
an order was cancelled when it was not is worse here than in the credit flow: the
operator will tell a customer their order is gone.

409 `ORDER_NOT_CANCELLABLE` renders the envelope `message`, which names why.

### `/approvals` — extended, not duplicated

Cancellation approvals appear in **the existing queue**, alongside credit
approvals, distinguished by subject. There is no second approvals screen.

If the backend ends up with two approval tables (option 2 of the `spec04-backend`
amendment), this screen still presents one queue. **A second queue in the UI
would let a supervisor clear one and believe they were done.**

Every rule from `spec03-frontend` carries over unchanged: no approve control on
your own request, with the reason shown; expired rows render as expired; the two
staleness codes render distinct copy and distinct offered actions.

### `/executions` — list

**Who sees this screen is blocked by `ARCHITECTURE.md` §12.10** — who may read an
`Execution` is undecided. The screen is specified here; its audience is not.
Route guards are UX either way (§6), and the endpoint enforces the real rule.

Task, status, when it ran, and its aggregate token and cost totals.

### `/executions/[executionId]` — the trace viewer

The whole point of the phase. One execution, its runs in sequence, each run's
steps in sequence, each step's tool calls.

Per `ARCHITECTURE.md` §9, the view must show: acting user, task, model,
started/completed, status, every tool call, input and output tokens, estimated
cost, whether approval was required, and the approval status.

Presentation rules:

- **Runs are visibly separate, with the gap between them shown.** An execution
  that paused overnight for a human decision must look like that, not like one
  continuous sequence. This is `AUT-9` made visible: approval terminates a run.
- **Tool arguments and results are rendered in full**, collapsed by default,
  expandable. A truncated argument is the one you needed.
- **A failed tool call is visually distinct from a refused one.** An error and a
  `APPROVAL_REQUIRED` observation are different events; rendering both as red
  teaches the reader to distrust the trace.
- Ids, timestamps, token counts and costs are monospace and tabular.
- `ABORTED_TURN_LIMIT` renders as its own terminal status with an explanation —
  never as a completed execution, and never as a generic failure.

Nothing writes a trace until Phase 4, so this screen is built and verified
against seeded rows. Say so in the As Built section; a reviewer finding an empty
list should not conclude it is broken.

**If §12.10 resolves to "approvers may read the trace of what they are
approving", this screen may render a projection rather than the full trace** —
the adjustment, its basis, and the calls that produced it. An approver whose
visibility is narrower than the initiator's would otherwise read data through the
trace that they could not fetch directly. Which of the two this screen renders is
not decided; build the full viewer for the initiator path and treat the approver
path as gated on §12.10.

---

## Reasoning for anything surprising

**Why the trace viewer is built before anything produces a trace.** The
alternative is discovering in Phase 4 that the agent misbehaves *and* that the
only way to see why is a SQL client. The viewer is cheap now and is the primary
debugging surface for the phase that follows.

**Why full arguments and results, rather than a summary.** The trace exists so a
human can reconstruct what happened and why a figure was what it was. Summarizing
is a second interpretation layer between the reader and the record, and the
disagreement it eventually causes is unresolvable.

**Why one queue even if the backend has two tables.** The supervisor's mental
model is "things waiting for me". Splitting that by the implementation's storage
choice leaks a schema decision into a workflow, and the failure mode is silent:
an empty queue that is not actually empty.

---

## Tests

### Component

- A 202 on cancellation renders awaiting-approval copy and **never** cancelled
  copy — asserted against the real response fixture.
- The consequences list renders every item the server returned.
- The approvals queue renders credit and cancellation subjects in one list.
- The trace viewer renders runs as visibly separate, and shows the elapsed gap
  between them.
- A tool call's arguments and result render in full when expanded.
- A tool error and an `APPROVAL_REQUIRED` observation render distinctly.
- `ABORTED_TURN_LIMIT` renders as its own status with an explanation.
- An execution with one run and an execution with two runs both render correctly.

### Production build — part of the gate

```bash
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

### Rendered verification

- The full cancellation cycle with two accounts, through the shared queue.
- The trace viewer against a seeded two-run execution; the run boundary is
  visible.
- **Measure computed styles** for the tabular columns and the run separation.

---

## Blocking open decisions

- **§12.4 — `cancel_order` refund behaviour.** The consequences panel has nothing
  to render until this is decided.
- **§12.10 — who may read an `Execution`.** Blocks the audience of both trace
  screens, and blocks whether the approver path renders the full trace or a
  projection of it.
- **`ARCHITECTURE.md` §9 amendment** for the approval subject. The queue's shape
  depends on it, though this spec commits to one queue either way.

---

## Definition of done

- [ ] §12.4 resolved; §9 amended
- [ ] Types regenerated from the live schema and re-exported
- [ ] Cancellation flow renders server-computed consequences; no outcome input
- [ ] 202 renders as awaiting approval, never as cancelled
- [ ] Cancellation approvals appear in the single existing queue
- [ ] §12.10 resolved; the approver path renders whatever it decided
- [ ] Trace viewer shows every field required by `ARCHITECTURE.md` §9
- [ ] Runs visibly separate with the gap shown
- [ ] Tool arguments and results expandable in full
- [ ] Error, refusal and turn-limit states visually distinct
- [ ] Frontend gate: type check, lint, tests
- [ ] Clean production build
- [ ] Verified in a real browser against seeded trace rows

---

## As Built

*To be completed after implementation. Record every divergence and why —
including that the trace viewer was verified against seeded rows because nothing
writes a trace until Phase 4.*

<!-- nothing yet -->
