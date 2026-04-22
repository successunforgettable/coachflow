# Hardening backlog

Items captured during sprint handovers that are outside the current sprint's
scope. Each item lists the trigger that surfaced it, the proposed fix, and
the rough cost/benefit so future sprints can prioritise without re-deriving
the context.

## R2.1 — TypeScript strict-check in build pipeline

**Trigger:** W5 Phase 2 shipped a Drizzle enum mismatch (complianceRewrites.contentType) that `tsc --noEmit` would have caught at compile time but esbuild / Vite don't run. Phase 1 only worked because `'headline'` happened to overlap both enums; Phase 2's `'body'` and `'link'` hit MySQL `"Data truncated for column 'contentType'"` at runtime. Caught in production QA, not in CI.

**Fix:** Wire `npm run check` (`tsc --noEmit`, already defined in package.json scripts) into two gates:
1. A pre-push git hook (via husky or a plain `.git/hooks/pre-push`) so no branch pushes with type errors.
2. A Railway build step that fails the deploy on type errors (e.g., `"build": "npm run check && vite build && esbuild ..."`).

**Cost:** ~5 lines across package.json and a git hook. One-time setup.

**Benefit:** Prevents recurrence of the W5 Phase 2 schema-drift class of bug — Drizzle type inference → DB enum mismatch, tRPC input narrowing mismatches, stale imports, and any other `tsc`-detectable issue that currently slips through because the transpiler doesn't enforce types.

**Priority:** Medium. Ship before Phase 3 so the Phase 3 landing-page content-type expansion doesn't replay the same class of bug in a different shape.
