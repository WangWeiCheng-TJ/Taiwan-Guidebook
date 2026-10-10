# Gate script

`scripts/agy-task.mjs` (with `scripts/lib.mjs`) in this skill folder. Node 20.11+, no dependencies. Run from anywhere inside the target git repo.

## Setup per project

1. `.gitignore`: add `.worktrees/`.
2. `.gitattributes`: `* text=auto eol=lf`.
3. Optional `.agy/config.json`:

```json
{
  "coreTest": "npm run -s test:core",
  "nowFiles": "^(src/types\\.ts|docs/SPEC\\.md|schema/)",
  "maxAdded": 150,
  "agy": "C:/Users/<you>/AppData/Local/agy/bin/agy.exe"
}
```

- `coreTest`: the suite that must stay green after every task (default `npm test`).
- `nowFiles`: regex of paths whose changes always need review before merging (shared types, specs, schemas).
- `maxAdded`: added lines above this raise a "Large change" flag.
- `agy`: worker binary; also `AGY` env var.

4. Commit `.agy/review-queue.json` when it appears, so the queue survives across sessions and machines.

## Commands

```bash
node <skill>/scripts/agy-task.mjs run --task t5 --allow src/foo.js,scripts/ --test "node --test tests/tasks/foo.test.js" --prompt "Implement the bodies in src/foo.js; the JSDoc is the spec."
```

- `--allow`: comma-separated files, or directories ending in `/`. Anything else changed is a `reject`.
- `--test`: repeatable; `coreTest` is always added.
- `--prompt` or `--prompt-file`; the script prepends the ground rules and the allowlist.
- `--base` (default `HEAD`), `--retries` (default 2), `--timeout` (default `20m`), `--model`, `--max-added`.

```bash
node <skill>/scripts/agy-task.mjs gate --task t5 --allow ... --test ...
```

Re-check an existing worktree without calling the worker (after a manual fix, or to re-run).

```bash
node <skill>/scripts/agy-task.mjs queue
node <skill>/scripts/agy-task.mjs queue --clear src/foo.js
node <skill>/scripts/agy-task.mjs queue --clear-all
```

## What a run does

1. Creates `.worktrees/agy-<task>` on branch `agy/<task>` (reuses it if present).
2. Calls the worker with the ground rules + allowlist + checks + task.
3. Normalizes CRLF in changed files, checks scope, runs the tests.
4. If only tests failed, sends the last 40 lines of each failure back into the same conversation, up to `--retries` times.
5. Computes risk flags from the diff and prints a report; writes the full report to `.worktrees/agy-<task>.report.json`.

It never commits. Claude commits on the task branch, then merges (rebase first if the base moved).

## Example report

```
task t4a  verdict: accept  rounds: 1  agy: SUCCESS, 45421 out tokens
worktree D:\repo\.worktrees\agy-t4a  conversation f9d4e522-...
files: app/js/i18n.js (+29/-3), scripts/migrate_i18n.py (+106/-3)
tests: node --test tests/tasks/i18n.test.js 3/3 | npm run -s test:core 29/29
```
