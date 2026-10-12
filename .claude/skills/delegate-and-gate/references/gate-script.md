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
  "uiPaths": ["src/components/", "public/sw.js"],
  "agy": "C:/Users/<you>/AppData/Local/agy/bin/agy.exe"
}
```

- `coreTest`: the suite that must stay green after every task (default `npm test`).
- `nowFiles`: regex of paths whose changes always need review before merging (shared types, specs, schemas).
- `maxAdded`: added lines above this raise a "Large change" flag.
- `uiPaths`: files whose changes raise a "Touches UI or offline code" flag (tests can't see layout). Exact repo-relative paths, or directory prefixes ending in `/`. Default: `app/js/views/`, `app/sw.js`, `app/index.html`, `app/app.css` (`DEFAULT_UI_PATHS` in `lib.mjs`); `[]` turns the flag off.
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

Re-check an existing worktree without calling the worker (after a manual fix, or to re-run). It never creates one.

```bash
node <skill>/scripts/agy-task.mjs finish --task t5
```

Clean up after the task branch is merged. Run it from anywhere in the repo except inside `.worktrees/agy-t5`.
- Refuses, touching nothing, when `agy/t5` doesn't exist or isn't merged into `HEAD`, when the worktree is detached or on another branch (its commits could be lost), or when `.worktrees/agy-t5` is a folder git doesn't list and isn't empty.
- Otherwise, in order: `git worktree remove` (no `--force`, so git refuses if anything is uncommitted), or remove the folder if git doesn't list it and it is empty; `git branch -d agy/t5` (never `-D`); delete `.worktrees/agy-t5.report.json`.
- Prints one line: `finish t5: removed worktree .worktrees/agy-t5, deleted branch agy/t5 (was 1a2b3c4), deleted .worktrees/agy-t5.report.json.`
- Touches nothing outside `.worktrees/` and that branch.

```bash
node <skill>/scripts/agy-task.mjs queue
node <skill>/scripts/agy-task.mjs queue --clear src/foo.js
node <skill>/scripts/agy-task.mjs queue --clear-all
```

## What a run does

1. Creates `.worktrees/agy-<task>` on branch `agy/<task>`, or reuses it if `git worktree list` has it on that branch. It stops, with the fix, when something is in the way: a folder git doesn't list, a listed worktree that is detached or on another branch, or the branch without its worktree (usually a merged task that wasn't finished).
2. Calls the worker with the ground rules + allowlist + checks + task.
3. Normalizes CRLF in changed files, checks scope, runs the tests.
4. If only tests failed, sends the last 40 lines of each failure back into the same conversation, up to `--retries` times.
5. Computes risk flags from the diff and prints a report; writes the full report to `.worktrees/agy-<task>.report.json`.

It never commits. Claude commits on the task branch, then merges (rebase first if the base moved), then runs `finish`, which also deletes the report.

## Example report

```
task t4a  verdict: accept  rounds: 1  agy: SUCCESS, 45421 out tokens
worktree D:\repo\.worktrees\agy-t4a  conversation f9d4e522-...
files: app/js/i18n.js (+29/-3), scripts/migrate_i18n.py (+106/-3)
tests: node --test tests/tasks/i18n.test.js 3/3 | npm run -s test:core 29/29
```
