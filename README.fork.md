# Fork notes

This file is tracked. It documents why this fork exists and how it is used.

## This checkout is loaded by pi at runtime

`pi list` registers this directory as the source for `@arhen/pi-core-subagent`:

```
../extensions/arhen/packages/core/pi-core-subagent
  -> /Users/nqh/.pi/extensions/arhen/packages/core/pi-core-subagent
```

Pi reads the files in this working tree directly. It does not read a git ref, a
tarball, or a build output. Whatever branch is checked out here is what every
running agent executes.

## Names

| Thing | Name |
|---|---|
| Local directory | `~/.pi/extensions/arhen` |
| GitHub fork | `nqh-packages/arhen-pi-extensions` |
| Upstream | `arhen/pi-extensions` |
| Dev clone | `~/Desktop/CODES/arhen-pi-extensions-dev` |

The fork's `main` contains the fix, so a fresh clone is usable as-is.

Named after the upstream owner (`arhen`) because that is whose code this is. The
directory sits in a shared `~/.pi/extensions/` namespace, so a bare
`pi-extensions` would read as if it were the only one.

## Only one package is installed

The repo is a monorepo with 12 packages under `packages/core/` and
`packages/add/`. Exactly one is registered with pi:

    packages/core/pi-core-subagent

The rest (`pi-core-vision`, `pi-core-todo`, `pi-add-9router`, ...) are present
on disk but not installed, so they never load. Pi installs per `package.json`
path, not per clone. The `@arhen/pi-toolset` CLI can install the whole set, but
only if it is run deliberately. Do not run it unless the extra extensions are
actually wanted.

## Keep a branch that contains the fix checked out here

The reason this fork exists is one change: child-to-leader messages are delivered
with `deliverAs: "steer"` instead of `"followUp"`.

    branch: main  (or fix/steer-all-child-leader-messages, same commit)
    commit: 4c946db

Any branch without that commit reverts the change, and subagent notices go
back to queueing as follow-ups. It is silent when it happens: nothing errors, the
extension still loads, and the only symptom is a growing Follow-up queue you may
not notice for a while.

A `post-checkout` hook warns when the checked-out code loses the fix. The hook
lives in `.git/hooks/` and is not tracked by git, so it must be re-created after a
fresh clone.

Verify at any time (expect 4 lines):

```sh
grep -n 'deliverAs: "steer"' \
  packages/core/pi-core-subagent/src/manager.ts
```

## Do development somewhere else

The dev clone is safe to check out anything:

    ~/Desktop/CODES/arhen-pi-extensions-dev

## Remotes

Both remotes are configured in **this checkout and the dev clone**:

| Remote | Repository | Role |
|---|---|---|
| `origin` | `arhen/pi-extensions` | upstream — read-only from here |
| `nqh-packages` | `nqh-packages/arhen-pi-extensions` | the fork |

`main` tracks **`nqh-packages/main`**, so `git push` publishes to the fork and never to upstream.
Contributing upstream is a separate, deliberate step.

A plain `git fetch` refreshes `origin` (upstream), not the fork, so `origin/main` lags by design and
looking at it right after a push reads as a failed push. Check the remote you actually pushed to:

```sh
git ls-remote nqh-packages main   # what the fork has
git ls-remote origin main         # what upstream has
```

## Branches

| Branch | Purpose |
|---|---|
| `main` | Contains the fix. **Keep checked out here.** Tracks `nqh-packages/main`. |
| `fix/steer-all-child-leader-messages` | The PR head. Same commit as `main` now; kept so PR #4 keeps pointing at it. |
| `evidence-host/pr-4` | Throwaway Worker that hosts the PR screenshot. Branched before the fix, so it lacks it. |

Note: `evidence-host/pr-4` does not contain the fix. Checking it out here will
revert the running extension until you switch back.

## Related

- Upstream PR: https://github.com/arhen/pi-extensions/pull/4
- Evidence host: https://arhen-pi-pr-4-evidence.uxheavy2-89f.workers.dev
  (expires 2026-11-16, then returns 410)
- The earlier npm install of `@arhen/pi-core-subagent` was removed, so no second
  copy shadows this one.
