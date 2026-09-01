# Autbiz — frontend

Next.js App Router UI for the Autbiz operations agent. One of three
repositories; the binding documents live in `../Autbiz-governance/` and outrank
anything written here.

**Read `CLAUDE.md` before changing anything.** It carries the constraints that
are not obvious from the code — why there is no public API URL variable, why
money is never computed client-side, and why a 202 is not a completion.

## Running it

```bash
npm install
cp .env.example .env.local     # BACKEND_ORIGIN points at the running backend
npm run dev                    # :3000
```

The backend must be running on `:8000` for anything past the login screen to
work, and for `npm run gen:api` to have a schema to read.

## Gate

```bash
npm run gen:api                # backend must be running
npx tsc --noEmit && npm run lint
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

Removing `.next` **and** the tsbuildinfo before the build is required, not
hygiene: the incremental cache retains deleted generated types as compiler roots
and fails with errors naming files that no longer exist.

Never build while a dev server is running, and never run two dev servers — they
share a build directory, and the corruption presents as a page that renders but
does not respond to clicks.

## Types are generated

`npm run gen:api` writes `src/lib/schema.d.ts` from the backend's live OpenAPI
schema. It is committed, so the project type-checks without a running backend.

**Never hand-edit it, and never redefine a shape it already describes.**
`src/lib/types.ts` re-exports; import from there. A backend rename should break
the type check — that alarm is the contract test.
