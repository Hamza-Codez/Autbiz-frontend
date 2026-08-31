# spec05.md — Agent console (UI)

**Phase 4 · Backend: `Autbiz-backend/SPEC/spec05-backend.md`**

---

## The problem

The agent runs and there is no way to ask it anything.

The console is a small screen with one hard requirement: **it must not make the
agent look more certain, more complete, or more finished than it is.** Every
honest thing the backend does — returning `APPROVAL_REQUIRED` as a normal result,
reporting a turn limit as its own status, refusing to invent a figure — can be
undone by a screen that renders all of them as a confident paragraph of text.

---

## Ground rules inherited

From `ARCHITECTURE.md`:

- §7 — `APPROVAL_REQUIRED` is a normal, successful result the agent narrates
  honestly. Approval terminates the run.
- §9 — the trace is the record of what happened.

From `COMPLEXITY-FREEZE.md`: **the response is not streamed.** A stream cannot
become an error once begun, and `APPROVAL_REQUIRED` arrives mid-run.

From `rules.md`: `AUT-13` (a refusal names the remedy), `AUT-10`.

---

## Screens

### `/agent` — the console

Visible to principals with `operations:execute` — UX only.

**Submit.** A single task field and a submit control. The control is disabled
while a request is in flight and re-enabled on both success and failure.

**Waiting.** A non-streamed agent call can take tens of seconds. The waiting
state must:

- stay visibly alive, so the operator does not conclude it has hung and submit
  again;
- **not fabricate progress.** No fake step list, no invented "calling
  get_order…" ticker. The backend sends nothing until it is done, so anything
  shown mid-flight is a guess. An honest indeterminate indicator is correct; a
  simulated trace is a lie that will eventually contradict the real one.

**Result.** Four terminal presentations, visually distinct:

| Status | Presentation |
|---|---|
| Completed | The agent's summary, plus a link to the trace. |
| Approval pending | The summary, **plus an explicit statement that nothing has been applied**, plus a link to the approval in the queue. |
| `ABORTED_TURN_LIMIT` | Its own state with the backend's specific message. **Never rendered as an answer.** |
| Provider failure (502) | A transport-style failure, distinct from a refusal by the agent. |

**The approval-pending case is the one to get right.** The response is a 200 and
contains fluent prose. Rendering it identically to a completed run is the
frontend equivalent of the model claiming it applied a credit it only proposed.

### Trace access

Every result links to `/executions/[executionId]` (built in Phase 3). The console
does not re-render the trace; it points at it.

### `/executions` — unchanged

The Phase 3 list and viewer now have real rows. No changes are expected. If any
are needed, record them in this spec's As Built rather than silently amending
`spec04-frontend`.

---

## Reasoning for anything surprising

**Why no simulated progress.** It is the obvious way to make a slow
non-streaming call feel responsive, and it is the one thing this screen must not
do. A fabricated step list will sometimes contradict the real trace one click
away, and at that point the operator cannot trust either. An indeterminate
indicator is less satisfying and always true.

**Why the turn-limit status gets its own presentation instead of an error
banner.** It is not an error — the system worked and stopped where it was told
to. Rendering it as a failure teaches operators to retry, which spends tokens on
the same wall. Rendering it as an answer is worse: `AUT-10` exists precisely to
prevent a truncated run resembling a completed one.

**Why the console shows no controls for the operations the agent performs.** No
approve button, no apply button. Those live in the approvals queue, under
`approvals:write`, where the self-approval rule and the staleness checks are
already correct. A shortcut here would be a second path to the same gate.

---

## Tests

### Component

- Submit is disabled in flight and re-enabled on success and on failure.
- A completed result renders the summary and a trace link.
- **An approval-pending result renders an explicit "nothing has been applied"
  statement** and a link to the queue — asserted against the real response
  fixture, and asserted to differ from the completed presentation.
- `ABORTED_TURN_LIMIT` renders its own state with the backend's message, and is
  not presented as an answer.
- A 502 renders a transport failure distinct from any agent refusal.
- The waiting state renders no step list and no tool names.

### Production build — part of the gate

```bash
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

### Rendered verification

Drive a real browser end to end:

- Submit a task that ends in a proposal; confirm the screen says nothing was
  applied, and that the linked queue row is the right one.
- Approve as a second account; confirm the credit exists and the trace shows two
  visibly separate runs.
- Confirm a long-running call keeps the waiting state alive without inventing
  progress.
- **Measure computed styles** for the four terminal states; they must be
  distinguishable by more than colour.

---

## Blocking open decisions

- **§12.7 — model name.** Affects observed latency, which determines whether the
  waiting state is adequate. If p95 latency turns out to make the non-streaming
  experience unacceptable, that is a `COMPLEXITY-FREEZE.md` §3 revisit condition
  requiring an escalation record — **not** a unilateral decision to stream.

---

## Definition of done

- [ ] Types regenerated from the live schema and re-exported
- [ ] Console submits a task and renders four visually distinct terminal states
- [ ] Approval-pending explicitly states nothing was applied, and links to the
      queue
- [ ] `ABORTED_TURN_LIMIT` never rendered as an answer
- [ ] Waiting state invents no progress
- [ ] No approve or apply controls on this screen
- [ ] Every result links to its trace
- [ ] Frontend gate: type check, lint, tests
- [ ] Clean production build
- [ ] Full cycle verified in a real browser with two accounts

---

## As Built

*To be completed after implementation. Record every divergence and why —
including observed p95 latency and whether the waiting state proved adequate.*

<!-- nothing yet -->
