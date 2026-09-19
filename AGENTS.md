# arhen pi-extensions (fork checkout) — Map

## Scope

This working tree is **loaded live by pi**. `pi list` registers
`packages/core/pi-core-subagent` by path, so pi reads these source files directly — not a git
ref, tarball, or build output. Whatever is checked out here is what every running agent executes.
An edit takes effect on the next pi start; there is no build or install step.

`README.fork.md` owns why the fork exists, the remotes, the branch table, and the `4c946db` steer
fix this checkout must keep. Read it before switching branches.

## Pushing: use `README.fork.md`'s remote table, but not `git fetch`

`origin` is upstream and `nqh-packages` is the fork; `README.fork.md` owns which is which.
The one trap worth repeating here because it silently misleads:

**A plain `git fetch` refreshes `origin` (upstream), not the fork.** `origin/main` therefore lags
the fork by design, and checking it right after a push looks like a failed push. Verify against the
fork you pushed to with `git ls-remote nqh-packages main`.

## Where truth lives

- `README.md` (root) — the packages, the monorepo layout, publication.
- `README.fork.md` — fork rationale, remotes, branches, the required `4c946db` fix.
- `packages/core/pi-core-subagent/README.md` — that extension's full behavior and tool contract.
- `.github/workflows/<package>.yml` — the CI lane per package; each triggers on its own
  `packages/<...>/<package>/**` path and runs that package's `check` script.

## Local gotchas

- **Only `pi-core-subagent` is installed.** The other 11 packages are on disk but never load. Do
  not run `@arhen/pi-toolset` unless the extra extensions are genuinely wanted.
- **`main` must contain `4c946db`.** Without it, child-to-leader messages revert to queueing as
  follow-ups. It fails silently: nothing errors and the only symptom is a growing queue.
- Do not `git add -A` here. Stage explicit paths.
