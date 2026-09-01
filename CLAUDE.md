# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

## This repo is one of three, and it does not hold the rules

```
F:\project\Autbiz\            <- NOT a git repository. Never run git here.
├── Autbiz-governance\        <- the binding documents
├── Autbiz-backend\           <- FastAPI + PostgreSQL
└── Autbiz-frontend\          <- this repo
```

**Read `../Autbiz-governance/` before the first edit.** In order:

| Document | Why it binds this repo |
|---|---|
| `ARCHITECTURE.md` | §3 is the `AUT-1`..`AUT-21` invariant register. §12 lists open decisions — **anything still open must not be guessed.** |
| `rules.md` | §21 proxy pattern, §23 CSRF cookies, §26 no Dockerfile here. |
| `sops.md` | §6 gates, §7 generated-types discipline, §8 commit order. |
| `SPEC/spec0N-frontend.md` | The authoritative contract for the phase. Where it and this file disagree, **it wins.** |

Commit order across repos is **governance → backend → frontend**. Frontend types
are generated from the backend's OpenAPI schema, so a frontend change depending
on a new endpoint is unbuildable until the backend is live. Stage explicit paths;
never `git add -A`.

## Commands

```bash
npm run dev                 # :3000
npm run gen:api             # regenerate types — BACKEND MUST BE RUNNING on :8000
npx tsc --noEmit            # the type check
npm run lint                # eslint
npm run build               # production build

rm -rf .next tsconfig.tsbuildinfo && npm run build   # the gate's build step
```

**Removing `.next` *and* the tsbuildinfo before a gate build is required, not
hygiene.** The incremental type-check cache retains deleted generated types as
compiler roots and fails the build with errors naming files that no longer exist.

**Never build while a dev server is running, and never run two dev servers.**
Shared build directory, corruption. The symptom is that the page renders and
nothing responds to clicks, because the client runtime bundle 404'd and
hydration died silently.

```bash
npm test                    # vitest run
npm run test:watch
```

**Tests live in `tests/`, never in `src/app/`.** A test file inside the routable
app directory fails `next build` with an error naming neither the file nor the
cause, while lint, type check and the runner all stay green.

## Architecture

### The browser only ever talks to its own origin

`next.config.ts` rewrites `/api/:path*` to `${BACKEND_ORIGIN}/:path*`.
`BACKEND_ORIGIN` is **server-side only and read at build time** — changing it
requires a redeploy, not a restart. The config throws if it is unset in
production and strips a trailing slash defensively.

**Never introduce `NEXT_PUBLIC_API_BASE_URL` or any public API-URL variable.**
It overrides the proxy, re-introduces cross-origin, `SameSite=None` and
preflight, and undoes the entire same-origin design. This has already caused a
production outage on a sibling project.

### Cookies: one readable, one not

The backend sets `session` (httpOnly — script must never read it) and
`csrf_token` (deliberately **not** httpOnly). Read `csrf_token` and send it as
the `X-CSRF-Token` header on every mutating request. Centralize that in the one
fetch wrapper in `src/lib/api.ts` — a hand-written mutating call that forgets the
header produces a 403 whose cause is invisible from the call site.

**No auth token in `localStorage`, ever.** Sessions are httpOnly cookies.

### Types are generated, never authored

`npm run gen:api` writes `src/lib/schema.d.ts` from the running backend's
OpenAPI schema. **Never hand-edit it** — it is regenerated, and edits vanish
along with the drift alarm they were hiding. Re-export generated types; never
redefine a shape, because that turns a compile-time contract break into a runtime
failure in front of a user. A backend rename *should* break the type check; that
alarm is doing its job.

### Guards here are UX, never security

Route guards and permission-driven navigation only hide controls the backend
would refuse anyway (`AUT-7`). Never move an authorization decision into this
repo.

### Money is never computed here

Render the server's figure. **No client-side arithmetic on any monetary value** —
not a subtotal, not a line total, not a sum of items. Once a number the user sees
is produced by the client, "the figure on screen" and "the figure the backend
will act on" become two values that can disagree, which is the whole thing the
architecture exists to prevent. If a total is needed, the API provides it.

### A 202 is not a completion

From Phase 2 onward, `POST /credits` and cancellation return **202
`APPROVAL_REQUIRED`**. That is a *successful* result meaning a proposal was
recorded and **nothing was applied**. Rendering it as success is the single most
likely defect in this codebase: it looks correct in every screenshot and is
discovered by a customer who was told they were credited and was not.

## Current state (Phase 0)

Scaffolded with `create-next-app`: Next.js 16 App Router, React 19, Tailwind v4,
TypeScript, ESLint. Screens so far are `src/app/login/page.tsx` and
`src/app/page.tsx`; the fetch wrapper is `src/lib/api.ts`.

Component tests are in `tests/login.test.tsx`. `scratch/` is gitignored working
material — do not commit it.

**The one outstanding gap:** no rendered browser verification. Playwright's
Windows driver download 404'd here, so "measure computed styles, never assert
class names" has not been done. That is an environment problem, not a reason to
skip the check — it catches the invisible-text class of defect, and Phase 1
inherits it otherwise.
