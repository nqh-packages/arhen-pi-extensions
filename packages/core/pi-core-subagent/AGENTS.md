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

## Lint config

`biome.jsonc` extends `ultracite/biome/core`. Three formatter settings are pinned to the repo's own
style (tabs, 120 cols, `trailingCommas: "all"` in call arguments) so adopting the preset does not
reformat existing source — without them `biome check --write` rewrites every file.

Thirty rules carry an `"off"` with its reason inline. Before adding another, check it is not a false
positive against this code: tool `execute` handlers must be `async` by the SDK, and flow analysis
cannot see across async or timer boundaries. If the rule fights deliberate style rather than
correctness, disable it here and say why. Keep the file `.jsonc` — the comments are the record.

## Where truth lives

- `README.md` — tool contract, model-resolution order, the tool table, examples.
- `src/schemas.ts` — the tool's accepted input vocabulary (task fields, thinking levels).
- `src/types.ts` — shared constants (`DEFAULT_CONCURRENCY`, `MAX_CONCURRENCY`, `MAX_TASKS`) and
  snapshot shapes. **Leaf module: it imports nothing local**, which is what keeps the graph acyclic.
- `src/modelconfig.ts` — optional user-owned catalog advice; it can annotate a resolved catalog but
  never choose a task model or alter Pi's model scope.
- `test/` — one file per concern; `manager.test.ts` covers spawn/resume/cancel and the model
  contract.

## Local gotchas

- `src/types.ts` must stay import-free. Move shared constants there, not into `manager.ts`, or
  `manager → schemas → manager` cycles appear and break every test at module load.
- Model display has one owner: `modelTag()` in `format.ts`. Do not interpolate the model a second
  time in a render path.
- Spawn model precedence has one owner: `chooseModel()` in `manager.ts`. Resume uses the recorded
  provider/model (or an explicit override), not a changed agent file or the leader's model.
- Tool-allowance precedence has one owner: `chooseToolAllowance()` in `manager.ts`. Both the
  createRun gate and `resolveToolset()` read it, so the toolset a child receives cannot disagree
  with the allowance that was checked. A new entry point must call it, not re-derive it.
- Whether a task earns a worktree has one owner: `earnsIsolation()` in `manager.ts`, read by the
  spawn path. It takes the *resolved* toolset, so the allowance decision and the isolation decision
  cannot drift apart — the earlier inline `baseTools.some(...)` had no test on either side.
- Thinking levels come from pi's `getSupportedThinkingLevels` (`@earendil-works/pi-ai/compat`),
  never a local list. `THINKING_LEVELS` in `schemas.ts` is the accepted *input* vocabulary and is
  typed `satisfies readonly ModelThinkingLevel[]` so upstream drift is a compile error.
- A tool that must report failure has to **throw**: the tool loop returns
  `{ isError: false }` for any `execute` that does not throw, discarding a returned `isError: true`.
- `SessionManager.open()` creates a new session from an empty JSONL and skips malformed lines;
  continuation checks the JSONL, session ID, and parent before prompting.
- Every subagent task must name a `model`; there is no default. The error names passable
  references. Keep it that way — an inherited session model makes "which model ran" unknowable.
- Every subagent task must also **state its tool allowance** — `write: true`, `write: false`, or
  `tools: [...]` (or a matched agent file's `tools` frontmatter). There is no default toolset. One
  owner: `chooseToolAllowance()` in `manager.ts`, read by the spawn gate and by `resolveToolset()`.
  An empty `tools: []` counts as unstated. The gate runs **after** the model checks so the model
  contract keeps reporting first, and both checks **collect every offender** before throwing — one
  call reports every unfixed task, not just the first. `resumeTask()` separately validates saved
  tools and worktree isolation before continuing; see `README.md` under "Continuing a child".
- Refusal message shape has one owner: `describeProblems()` in `manager.ts`. One offender renders in
  the single-task form followed by a space; several render as a numbered block followed by a newline.
  Both forms end ready for a caller to concatenate a shared tail, which is what keeps the
  single-task and multi-task messages from producing a doubled space.
- `subagent_models` is scoped to `ctx.scopedModels` (pi's resolution of `enabledModels` and
  `--models`), falling back to all available only when nothing is scoped; each entry carries pi's
  own per-Mtok cost. Apply user catalog advice only after this list is resolved. Do not widen it to
  `getAvailable()` — that offers models the session cannot use.
- **This extension is loaded into the running pi session, so edits here do not affect the session
  that made them.** An in-session `subagent_models` call returns the copy loaded at startup. Verify
  a change in a NEW process (`pi -t subagent_models --print ...`), or it will look like the edit did
  nothing.
