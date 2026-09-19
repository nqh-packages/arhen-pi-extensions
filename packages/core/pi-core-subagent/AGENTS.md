# pi-core-subagent — Map

## Scope

A pi extension shipped as source (`pi.extensions` → `./src/index.ts`) and loaded directly by pi
from this checkout. It provides the `subagent`, `subagent_models`, and `subagent_*` control tools.
Behavior and the full tool contract are documented in `README.md`; this file is the working map.

## Canonical commands

Run from this directory. `check` is typecheck → lint → test and is what CI runs.

```sh
bun run check      # typecheck + lint + bun test — the gate
bun test           # tests only
bun run typecheck  # tsc --noEmit
bun run lint       # biome check .
npx biome check --write .   # format/import-order fixes
```

This is the **only** package under `packages/core/` with a `check` script; siblings define no
`scripts` at all, use `bun test`, or use `node --experimental-strip-types`. Do not assume a shared
command across the monorepo.

## Where truth lives

- `README.md` — tool contract, model-resolution order, the tool table, examples.
- `src/schemas.ts` — the tool's accepted input vocabulary (task fields, thinking levels).
- `src/types.ts` — shared constants (`DEFAULT_CONCURRENCY`, `MAX_CONCURRENCY`, `MAX_TASKS`) and
  snapshot shapes. **Leaf module: it imports nothing local**, which is what keeps the graph acyclic.
- `test/` — one file per concern; `manager.test.ts` covers spawn/resume/cancel and the model
  contract.

## Local gotchas

- `src/types.ts` must stay import-free. Move shared constants there, not into `manager.ts`, or
  `manager → schemas → manager` cycles appear and break every test at module load.
- Model display has one owner: `modelTag()` in `format.ts`. Do not interpolate the model a second
  time in a render path.
- Model precedence has one owner: `chooseModel()` in `manager.ts`. Spawn and resume both route
  through it; re-deriving the rule is how resume once bypassed the required-model guard.
- Thinking levels come from pi's `getSupportedThinkingLevels` (`@earendil-works/pi-ai/compat`),
  never a local list. `THINKING_LEVELS` in `schemas.ts` is the accepted *input* vocabulary and is
  typed `satisfies readonly ModelThinkingLevel[]` so upstream drift is a compile error.
- A tool that must report failure has to **throw**: the tool loop returns
  `{ isError: false }` for any `execute` that does not throw, discarding a returned `isError: true`.
- Every subagent task must name a `model`; there is no default. The error names passable
  references. Keep it that way — an inherited session model makes "which model ran" unknowable.
