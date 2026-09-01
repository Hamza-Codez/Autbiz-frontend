# spec01.md — Authentication Shell (UI)

**Phase 0 · Backend: `Autbiz-backend/SPEC/spec01-backend.md`**

---

## The problem

There is no frontend, and more importantly there is no proof that the proxy
pattern works. Until a login round-trip succeeds in production — cookie set,
cookie returned, session surviving a refresh — every later phase is building on
an assumption.

Phase 0's frontend is deliberately three screens. Its value is not the UI. It is
that it forces the rewrite, the cookie flags, the CSRF double-submit, and the
generated-types pipeline to be correct before anything depends on them.

---

## Ground rules inherited

From `ARCHITECTURE.md`:

- **§3 is the invariant register** — `AUT-1` through `AUT-21`, the single
  authoritative list.
- `AUT-7` (§6) — route guards and per-role navigation are **UX, never
  security**. Hiding a link keeps someone off a screen the backend would refuse
  anyway.
- `AUT-13` — a refusal names the remedy. The UI renders the envelope's
  `message`; it does not substitute its own copy.
- §11 — types are generated from the live OpenAPI schema and **re-exported**,
  never hand-defined.

From `rules.md`:

- §21 — the browser talks only to its own origin; `/api/:path*` rewrites to the
  backend. **No public environment variable for the API URL** — a public base
  overrides the proxy and undoes the same-origin design.
- §23 — the `csrf_token` cookie is deliberately readable by JS for the
  double-submit pair; the `session` cookie is httpOnly and never read by
  JavaScript. **No browser storage for auth, ever.**
- §26 — no Dockerfile in the frontend; the platform builds the framework
  natively.

From `sops.md`:

- §6 — the gates, and the rule that the production build is part of them.
- §7 — never hand-edit the generated file; re-export, never redefine; no test
  files inside the routable app directory.

---

## The proxy rewrite

```text
/api/:path*   →   ${BACKEND_ORIGIN}/:path*
```

`BACKEND_ORIGIN` is **server-side only** and read at **build** time. Changing it
requires a redeploy, not a restart.

Three rules:

1. **The build refuses to start** if `BACKEND_ORIGIN` is unset in production. A
   build that stops is a five-minute fix; one that ships pointing at localhost is
   an afternoon of confusion.
2. **Strip a trailing slash defensively.** A pasted origin carries one, and the
   doubled path 404s in a way that points nowhere near the cause.
3. Set it for **Production and Preview both**. "Works in Production, broken in
   Preview" is this variable, every time.

---

## Type generation

```bash
npm run gen:api      # regenerate from the running backend's OpenAPI schema
```

The shared types module **re-exports** generated types and never redefines a
shape. A backend rename then breaks the type check loudly, at the earliest
possible moment, instead of failing at runtime in front of a user. Expect that
alarm to fire; it is doing its job.

**Never hand-edit the generated file.** It is regenerated; edits vanish and take
the drift alarm with them.

Contract tests for Phase 0 are therefore free — the type check *is* the contract
test.

---

## Screens

### `/login`

Email, password, submit. No registration link — users are created by an admin.

Behaviour:

- Submit control **disabled while a request is in flight**. Network latency makes
  people double-click.
- 200 → redirect to `/`.
- 401 → inline error using the envelope's `message`. Identical text for every
  401, because the backend returns an identical body by design.
- 422 → field-level errors from the envelope.
- Network failure → a distinct message. Do not present a transport failure as
  bad credentials.

### `/` — authenticated shell

Header with the user's name and a sign-out control. Navigation rendered from the
permission list returned by `/auth/me`. Empty in Phase 0 beyond a placeholder —
domain screens arrive in spec02.

### Session bootstrap

On load, call `GET /auth/me`.

- 200 → render the shell.
- 401 → redirect to `/login`.
- While pending → a loading state, **not** the login screen. Flashing login at a
  signed-in user on every refresh is the most common way this gets built wrong.

### Global 401 handling

Any API call returning 401 clears local user state and redirects to `/login`.
A session can expire mid-visit; the app must not sit in a half-authenticated
state making calls that all fail.

---

## CSRF on the client

Read the `csrf_token` cookie — readable because the backend deliberately does
**not** mark it httpOnly — and send it as `X-CSRF-Token` on every mutating
request.

Centralize this in one fetch wrapper. A mutating call written by hand that
forgets the header produces a 403 whose cause is invisible from the call site.

The `session` cookie is httpOnly and is never read by JavaScript. The module
that touches session state server-side is marked server-only, so importing it
into a client component is a build error.

---

## What is deliberately not here

- No client-side permission enforcement beyond hiding navigation. §6.
- No token in `localStorage`. Sessions are httpOnly cookies.
- No API client generated beyond types — a thin typed `fetch` wrapper is enough.
- No component library decisions yet. Phase 0 is unstyled beyond legibility;
  visual design decisions belong with the domain screens in spec02.

---

## Tests

### Type check and lint

Must pass with the generated schema regenerated from a **running** backend, not
a stale committed copy.

### Component

- Login submit is disabled while in flight and re-enabled on both success and
  failure.
- A 401 response renders the envelope message, not a hardcoded string.
- A transport failure renders a distinct message from a 401.
- The shell renders navigation from the permission list, and renders nothing for
  an empty list.

### Production build — part of the gate

```bash
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

Removing both first is required, not hygiene. The incremental type-check cache
retains deleted generated types as compiler roots and fails the build with
errors about files that no longer exist. And a framework build can fail on
things lint, type check and the test runner all pass — a test file placed inside
the routable app directory, for one, which fails with an error naming neither
the file nor the cause while every other check is green. **The app would not
have deployed.**

Never build while a dev server is running: shared build directory, same
corruption.

### Rendered verification

Drive a real browser and confirm:

- Login succeeds and the session survives a hard refresh.
- Sign-out returns to `/login` and a back-button press does not restore the
  shell.
- Text is legible against its background. Where a change is visual, **measure
  computed styles**, never assert class names.

If a control seems dead locally, delete the build directory and restart **one**
dev server. Two dev processes sharing a build directory corrupt it, and the
client runtime bundle 404s — which silently kills hydration, so the page renders
and nothing responds to clicks.

---

## Blocking open decisions

- **§12.8 — hosting platform and region.** Blocks deployment and the region
  match with the backend.

---

## Definition of done

- [ ] Rewrite configured; **no** public API URL variable anywhere in the repo
- [ ] Build fails fast without `BACKEND_ORIGIN` in production
- [ ] Trailing slash stripped from `BACKEND_ORIGIN`
- [ ] Types generated from the live schema and re-exported, not redefined
- [ ] Fetch wrapper attaches `X-CSRF-Token` on every mutation
- [ ] Session bootstrap shows loading, never a login flash
anyway.
- `AUT-13` — a refusal names the remedy. The UI renders the envelope's
  `message`; it does not substitute its own copy.
- §11 — types are generated from the live OpenAPI schema and **re-exported**,
  never hand-defined.

From `rules.md`:

- §21 — the browser talks only to its own origin; `/api/:path*` rewrites to the
  backend. **No public environment variable for the API URL** — a public base
  overrides the proxy and undoes the same-origin design.
- §23 — the `csrf_token` cookie is deliberately readable by JS for the
  double-submit pair; the `session` cookie is httpOnly and never read by
  JavaScript. **No browser storage for auth, ever.**
- §26 — no Dockerfile in the frontend; the platform builds the framework
  natively.

From `sops.md`:

- §6 — the gates, and the rule that the production build is part of them.
- §7 — never hand-edit the generated file; re-export, never redefine; no test
  files inside the routable app directory.

---

## The proxy rewrite

```text
/api/:path*   →   ${BACKEND_ORIGIN}/:path*
```

`BACKEND_ORIGIN` is **server-side only** and read at **build** time. Changing it
requires a redeploy, not a restart.

Three rules:

1. **The build refuses to start** if `BACKEND_ORIGIN` is unset in production. A
   build that stops is a five-minute fix; one that ships pointing at localhost is
   an afternoon of confusion.
2. **Strip a trailing slash defensively.** A pasted origin carries one, and the
   doubled path 404s in a way that points nowhere near the cause.
3. Set it for **Production and Preview both**. "Works in Production, broken in
   Preview" is this variable, every time.

---

## Type generation

```bash
npm run gen:api      # regenerate from the running backend's OpenAPI schema
```

The shared types module **re-exports** generated types and never redefines a
shape. A backend rename then breaks the type check loudly, at the earliest
possible moment, instead of failing at runtime in front of a user. Expect that
alarm to fire; it is doing its job.

**Never hand-edit the generated file.** It is regenerated; edits vanish and take
the drift alarm with them.

Contract tests for Phase 0 are therefore free — the type check *is* the contract
test.

---

## Screens

### `/login`

Email, password, submit. No registration link — users are created by an admin.

Behaviour:

- Submit control **disabled while a request is in flight**. Network latency makes
  people double-click.
- 200 → redirect to `/`.
- 401 → inline error using the envelope's `message`. Identical text for every
  401, because the backend returns an identical body by design.
- 422 → field-level errors from the envelope.
- Network failure → a distinct message. Do not present a transport failure as
  bad credentials.

### `/` — authenticated shell

Header with the user's name and a sign-out control. Navigation rendered from the
permission list returned by `/auth/me`. Empty in Phase 0 beyond a placeholder —
domain screens arrive in spec02.

### Session bootstrap

On load, call `GET /auth/me`.

- 200 → render the shell.
- 401 → redirect to `/login`.
- While pending → a loading state, **not** the login screen. Flashing login at a
  signed-in user on every refresh is the most common way this gets built wrong.

### Global 401 handling

Any API call returning 401 clears local user state and redirects to `/login`.
A session can expire mid-visit; the app must not sit in a half-authenticated
state making calls that all fail.

---

## CSRF on the client

Read the `csrf_token` cookie — readable because the backend deliberately does
**not** mark it httpOnly — and send it as `X-CSRF-Token` on every mutating
request.

Centralize this in one fetch wrapper. A mutating call written by hand that
forgets the header produces a 403 whose cause is invisible from the call site.

The `session` cookie is httpOnly and is never read by JavaScript. The module
that touches session state server-side is marked server-only, so importing it
into a client component is a build error.

---

## What is deliberately not here

- No client-side permission enforcement beyond hiding navigation. §6.
- No token in `localStorage`. Sessions are httpOnly cookies.
- No API client generated beyond types — a thin typed `fetch` wrapper is enough.
- No component library decisions yet. Phase 0 is unstyled beyond legibility;
  visual design decisions belong with the domain screens in spec02.

---

## Tests

### Type check and lint

Must pass with the generated schema regenerated from a **running** backend, not
a stale committed copy.

### Component

- Login submit is disabled while in flight and re-enabled on both success and
  failure.
- A 401 response renders the envelope message, not a hardcoded string.
- A transport failure renders a distinct message from a 401.
- The shell renders navigation from the permission list, and renders nothing for
  an empty list.

### Production build — part of the gate

```bash
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

Removing both first is required, not hygiene. The incremental type-check cache
retains deleted generated types as compiler roots and fails the build with
errors about files that no longer exist. And a framework build can fail on
things lint, type check and the test runner all pass — a test file placed inside
the routable app directory, for one, which fails with an error naming neither
the file nor the cause while every other check is green. **The app would not
have deployed.**

Never build while a dev server is running: shared build directory, same
corruption.

### Rendered verification

Drive a real browser and confirm:

- Login succeeds and the session survives a hard refresh.
- Sign-out returns to `/login` and a back-button press does not restore the
  shell.
- Text is legible against its background. Where a change is visual, **measure
  computed styles**, never assert class names.

If a control seems dead locally, delete the build directory and restart **one**
dev server. Two dev processes sharing a build directory corrupt it, and the
client runtime bundle 404s — which silently kills hydration, so the page renders
and nothing responds to clicks.

---

## Blocking open decisions

- **§12.8 — hosting platform and region.** Blocks deployment and the region
  match with the backend.

---

## Definition of done

- [ ] Rewrite configured; **no** public API URL variable anywhere in the repo
- [ ] Build fails fast without `BACKEND_ORIGIN` in production
- [ ] Trailing slash stripped from `BACKEND_ORIGIN`
- [ ] Types generated from the live schema and re-exported, not redefined
- [ ] Fetch wrapper attaches `X-CSRF-Token` on every mutation
- [ ] Session bootstrap shows loading, never a login flash
- [ ] Global 401 handling
- [ ] Frontend gate: type check, lint, tests
- [ ] **Clean production build** (`.next` and tsbuildinfo removed first)
- [ ] Rendered check in a real browser, computed styles measured
- [ ] Deployed with `BACKEND_ORIGIN` set for Production **and** Preview
- [ ] `/api/health` returns JSON, not HTML
- [ ] Login works end-to-end in production, session survives refresh

---

## As Built

Recorded at the close of Phase 0's frontend work.

### Gate invocations

```bash
npm run gen:api                # the backend must be RUNNING on :8000
npx tsc --noEmit && npm run lint
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

On PowerShell the last line is
`Remove-Item -Recurse -Force .next, tsconfig.tsbuildinfo -ErrorAction SilentlyContinue`.

There is **no test runner**, so this spec's component tests have nowhere to
live. Recorded as a gap, not a decision — see "Not done" below.

### Divergences from this spec

- **Generated types are `src/lib/schema.d.ts`**, not `lib/api/generated.ts`, and
  the re-export module is `src/lib/types.ts`, not `lib/api/types.ts`. The
  `src/`-rooted layout came from `create-next-app`. The two-file discipline the
  spec requires is intact; only the paths differ.
- **`src/lib/schema.d.ts` is committed.** It has to be, or the project cannot
  type-check without a backend running. "Never hand-edit it" and "commit it" are
  both true.
- **The re-export layer was missing and has been added.** `src/app/page.tsx`
  hand-declared `type User = { id; email; full_name; permissions }` — a
  redefinition of a shape the generated schema already described. That is the
  precise failure `sops.md` §7 exists to prevent: the local copy would have kept
  `tsc` green through a backend rename and failed at runtime in front of a signed
  in user. It now imports `CurrentUser` from `src/lib/types.ts`.
- **The global 401 redirect uses `window.location.href`, deliberately**, against
  an ESLint rule that prefers `useRouter().push()`. `src/lib/api.ts` is not a
  component so hooks are unavailable, but the stronger reason is that a full
  document navigation discards every piece of in-memory user state; a client-side
  push preserves React state belonging to a session that no longer exists. The
  suppression carries that reasoning inline so it is not "fixed" later.
- **`.env.example` and a real `README.md` added.** The README was untouched
  `create-next-app` boilerplate describing none of this project.
- **`.gitattributes` added before the first commit**, so LF normalisation never
  becomes a whole-file diff.
- **`scratch/` is gitignored.** Untracked working material that `git add -A`
  would otherwise sweep into a commit describing none of it (`sops.md` §8).

### Verified

- **The proxy works.** `curl http://localhost:3000/api/health` returns
  `{"status":"ok"}` — JSON, not HTML. HTML here would mean the rewrite never
  applied, which is the failure this phase exists to rule out.
- **A real login round-trip through the proxy returns 200**, with
  `session` marked `HttpOnly; Path=/; SameSite=lax` and `csrf_token` set
  **without** `HttpOnly` so the client can read it for the double-submit pair.
  Cookie expiry lands 7 days out, matching `SESSION_TTL_HOURS=168`.
- The response body carries all six permissions, sorted, resolved through the
  `admin` role.
- `npx tsc --noEmit`, `npm run lint` (0 errors, 0 warnings) and a clean
  production build all pass.

**This verification found a backend bug.** `EmailStr` rejects reserved domains
such as `.local`, but `users.email` is a plain string column, so a bootstrap
admin seeded as `admin@autbiz.local` was created successfully and could never
sign in. Fixed in the backend; recorded in `spec01-backend.md`'s As Built. It was
invisible to every test and surfaced only by driving a real login.

### Not done in this phase

- **No test runner and therefore no component tests.** This spec asks for four
  (submit disabled in flight, 401 renders the envelope message, transport failure
  distinct from 401, navigation from the permission list). They are unwritten.
  Either add a runner or amend this spec; leaving it silent is the option that is
  not acceptable.
- **No rendered browser verification.** Playwright's Windows driver download
  failed (404 for 1.57.0) in this environment, so "measure computed styles, never
  assert class names" has not been done. The proxy and login round-trip were
  verified with `curl` instead, which covers the contract but not the rendering.
- **Not deployed.** No Vercel project, so `BACKEND_ORIGIN` has not been set for
  Production and Preview, and the same-origin design is proven locally only.
- The shell renders a placeholder; navigation is not yet driven by the permission
  list, since Phase 0 has no domain screens to navigate to.
