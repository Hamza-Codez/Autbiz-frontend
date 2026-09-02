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

Phase 1, frontend. Screens: `/orders`, `/orders/[orderId]`,
`/customers/[customerId]`, plus real navigation in the shell.

### Three defects found by building, none by reading

**`next build` failed prerendering `/orders`.** `useSearchParams()` must sit
inside a `Suspense` boundary; the page reads the query string, so Next.js cannot
statically render it and bails to the client. Lint, type check and all seven
tests passed at the time — **the app simply would not have deployed**, which is
exactly the failure `spec01-frontend` warns about and the reason the production
build is in the gate rather than assumed.

**React's compiler lint rejected `setState` called synchronously in an effect
body.** Fixing it properly closed a real race rather than just satisfying a rule:
without a cancellation guard, changing pages quickly lets a slow first response
land after the second and render results for a page the operator already left.
Every data effect now performs no `setState` before its first `await` and guards
on a `cancelled` flag.

**The generated types carried two error shapes.** The schema advertised
FastAPI's `HTTPValidationError` for 422 while the API actually returns the
envelope. Fixed in the backend (`app.openapi()`); recorded here because the
broken union at a call site is what surfaced it, which is the generated-types
pipeline doing its job.

### Decisions

**No client-side arithmetic on any monetary value.** The order detail renders
each line's unit amount from the server and has **no total row**. Once a figure
the user sees is produced by the client, "the number on screen" and "the number
the backend will act on" are two values that can disagree — the thing the whole
architecture exists to prevent. When a total is needed the API will provide one.

**Both not-found states say only "Not found".** The API returns an identical body
for an absent record and one the caller may not see (`AUT-7`); wording them
differently would undo that at the last hop, which is where it is easiest to undo
by accident.

**The balance renders as an explicit `0.00`** with a note that it is derived from
transactions — never as "no balance". A real zero and a missing value must not
look the same.

**A 403 on the account request hides the section rather than raising an error.**
`accounts:read` is a separate permission, so a principal with `orders:read` alone
sees the customer and no balance. That is not a fault worth shouting about.

**Navigation is derived from the permission list and is UX only** (`AUT-7`).
Unrecognised permissions are ignored — the backend may ship one before this file
knows about it, and rendering raw permission keys is debug output, not
navigation. This replaced the Phase 0 placeholder, which did exactly that.

### Tests

17 across four files. The Phase 1 additions:

- The list renders the **server's `total`**, not `items.length` — the page shows
  20 rows while the result set may be 137.
- An empty result renders the empty state, not an empty table.
- A failure renders the envelope's `message`, not a hardcoded string.
- A transport failure renders distinctly from an API error.
- The request sends `page`/`size` and **never `limit`**.
- Navigation renders from permissions; an empty list renders none and does not
  crash; an unrecognised permission is ignored.
- The shell shows a loading state rather than flashing login at a signed-in user.

**`spec01-frontend`'s fourth test is now written.** It had nowhere to live in
Phase 0 because the shell had no navigation to drive.

### Verified in a real browser

Login → order list → order detail → customer → absent order, with **no console
errors and no failed requests** beyond the deliberate 404.

Computed contrast measured rather than asserted from class names, and
`npm run check:rendered` was **extended to cover the signed-in screens** rather
than only login — it now signs in, walks to the orders table and measures there
too. Shell nav 17.93:1, table header 10.30:1, order link 8.82:1, date and status
cells 17.75:1, count line 7.56:1. **12/12 pass WCAG AA.**

Dev credentials come from `CHECK_EMAIL`/`CHECK_PASSWORD` with local defaults, and
the script exits with an actionable message if no user is seeded.

### Not done

- **Not deployed**, so `BACKEND_ORIGIN` is still unproven for Production and
  Preview.
- No filtering UI. The API accepts `customer_id` and `status`; the list sends
  neither.
