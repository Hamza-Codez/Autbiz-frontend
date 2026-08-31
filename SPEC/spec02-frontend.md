# spec02.md — Domain read screens (UI)

**Phase 1 · Backend: `Autbiz-backend/SPEC/spec02-backend.md`**

---

## The problem

Phase 0 shipped a shell with a placeholder where navigation belongs. There is
nothing to look at, and more importantly nothing that proves the generated-types
pipeline survives a real domain — Phase 0's contract was four endpoints with
almost no shape to it.

This phase is the first time the frontend renders a nested structure it did not
define: an order with items, issues and a customer. If the re-export discipline
is going to break, it breaks here rather than in Phase 4 in front of an agent
response.

It is also where navigation stops being a placeholder and starts being rendered
from the permission list — which is **UX, never security** (`ARCHITECTURE.md`
§6).

---

## Ground rules inherited

From `ARCHITECTURE.md`:

- §6 — route guards and per-role navigation are UX only. Hiding a link keeps
  someone off a screen the backend would refuse anyway.
- §11 — types are generated from the live OpenAPI schema and **re-exported**,
  never hand-defined.

From `rules.md`:

- §21 — the browser talks only to its own origin; no public API URL variable.
- `AUT-13` — a refusal names the remedy. The UI renders the envelope's `message`;
  it does not substitute its own copy.

From `sops.md`:

- §6 — the production build is part of the gate, run after removing `.next` and
  the tsbuildinfo.
- §7 — never hand-edit the generated file; re-export, never redefine.

---

## Screens

### `/orders` — order list

Paginated table driven by the backend's `page` / `size` / `total` / `pages`.

- **Query state lives in the URL**, so a filtered list is linkable and the back
  button works. The component that writes it must compare against the value
  already in the URL and bail when unchanged — an effect that pushes
  unconditionally re-triggers itself and makes every keystroke a navigation.
- **Never send `limit`.** The backend rejects unknown query parameters (spec02
  backend), so a wrong name is a visible 422 rather than a silently defaulted
  page — but do not rely on the error to catch a typo you can avoid.
- Empty result renders an empty state, not a spinner and not a zero-row table
  with no explanation.
- The list shows only what the principal may see. **The UI does not filter.** It
  renders what the API returns; the count comes from `total`.

### `/orders/[orderId]` — order detail

Order header, line items, logged issues, and a link to the customer.

- A 404 renders "not found", **with the same copy whether the order is hidden or
  absent.** The API deliberately makes these indistinguishable (`AUT-7`); a UI
  that says "you do not have access to this order" on one path and "no such
  order" on the other undoes that at the last hop.
- Money is rendered from the server's value. **No client-side arithmetic on
  amounts, ever** — not a subtotal, not a line total, not a sum of items. If a
  total is needed on screen, the API provides it. This is the frontend half of
  `AUT-2`.
- Quantities, SKUs, order ids and timestamps are monospace and tabular so columns
  align and a transposed digit is visible.

### `/customers/[customerId]` — customer view

Identity, their visible orders, and their account balance.

The balance is a server-derived figure (zero in this phase, since no transactions
exist until Phase 2). Render what arrives. **Do not special-case zero into
"no balance"** — a real zero and a missing value must not look the same.

### Navigation

Rendered from the permission list returned by `/auth/me`:

| Permission | Navigation |
|---|---|
| `orders:read` | Orders |
| `accounts:read` | *(no top-level entry; account data appears within a customer)* |

An empty permission list renders no navigation, and the shell still renders.
Never crash on an unexpected permission string — an unknown permission is
ignored, not fatal, because the backend may ship a new one before the frontend
knows about it.

---

## Reasoning for anything surprising

**Why the 404 copy is deliberately unhelpful.** Every instinct says to tell the
user which of the two situations they are in. That instinct is the leak. The
backend spends a test asserting byte-identical bodies; the UI must not
reintroduce the distinction through wording, iconography, or a different
redirect.

**Why no client-side money arithmetic, even for display.** It looks harmless to
sum line items for a subtotal. But once a number the user sees is produced by the
client, "the figure on screen" and "the figure the backend will act on" are two
values that can disagree — and the whole architecture exists to guarantee they
cannot. A displayed total that the server did not compute is the same class of
error as an agent-chosen amount, arriving by a different door.

**Why query state lives in the URL rather than component state.** Beyond
linkability: an operator reporting a problem can paste the URL, and the person
helping them sees the same list. With filters in component state, every bug
report starts with "which filters did you have set?"

---

## Tests

### Type check and lint

Run against a schema regenerated from a **running** backend, not a stale
committed copy. A backend rename must break this check.

### Component

- The list renders `total` from the response, not `items.length`.
- An empty result renders the empty state, not a spinner.
- A 404 on order detail renders the not-found state, and the copy is identical
  for a hidden order and an absent id — asserted against both fixtures.
- Navigation renders from the permission list; an empty list renders no
  navigation and does not crash; an unrecognized permission is ignored.
- A transport failure renders a distinct message from a 404.
- The search/filter component does not push when the value already matches the
  URL.

### Production build — part of the gate

```bash
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

Removing both first is required, not hygiene. **No test files inside the
routable app directory** — that fails the build with an error naming neither the
file nor the cause while every other check stays green.

Never build while a dev server is running; never run two dev servers.

### Rendered verification

Drive a real browser:

- The order list paginates, and the URL reflects the page.
- An order detail renders items and issues.
- Money and quantity columns align; **measure computed styles**, not class names.
- Text is legible against its background.

---

## Blocking open decisions

- **§12.2 — order visibility rule.** The list and detail screens cannot be
  verified against a hidden-vs-absent fixture pair until "hidden" is defined.
  Gates the 404 test, which is this phase's most important assertion.
- **§12.3 — who logs an `OrderIssue`, through what surface.** If issues are
  reported through the UI, this phase gains a form and a permission; if they
  arrive in seed data, it does not. The screen inventory above assumes **no
  form** and must be revised if §12.3 says otherwise.

---

## Definition of done

- [ ] §12.2 and §12.3 resolved
- [ ] Types regenerated from the live schema and re-exported, not redefined
- [ ] Order list paginated, query state in the URL, no `limit` parameter
- [ ] Order detail renders items and issues
- [ ] Customer view renders the server-derived balance, zero rendered as zero
- [ ] 404 copy identical for hidden and absent
- [ ] No client-side arithmetic on any monetary value
- [ ] Navigation rendered from permissions; unknown permission ignored
- [ ] Frontend gate: type check, lint, tests
- [ ] Clean production build (`.next` and tsbuildinfo removed first)
- [ ] Rendered check in a real browser, computed styles measured

---

## As Built

*To be completed after implementation. Record every divergence and why.*

<!-- nothing yet -->
