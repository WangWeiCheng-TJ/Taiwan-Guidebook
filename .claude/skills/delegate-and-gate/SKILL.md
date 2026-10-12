---
name: delegate-and-gate
description: Delegate implementation work to another coding agent (Antigravity CLI, Gemini CLI, Codex CLI, or a cheaper model) while Claude writes the contract and gates the result, reading code only when a check or risk flag says so. Use when the user wants to save Claude usage by having another agent write code, asks to "hand this to agy/Gemini/Antigravity", or wants a review queue for delegated work.
---

# Delegate and gate

Claude is the expensive, careful reviewer; the worker agent is the cheap producer. Output tokens cost more than reading, so Claude writes small contracts and checks results mechanically, and reads code only when it has to.

## Roles

| Who | Does | Never does |
|---|---|---|
| Claude | splits work, writes the contract (stub + tests), runs the gate, reads flagged diffs, commits and merges | writes the implementation of a delegated task |
| Worker agent | implements the stub until the tests pass | edits tests, changes signatures, commits, touches files outside its allowlist |
| Gate script | runs checks, retries the worker on failures, flags risk, prints one verdict | decides design questions |

## What to delegate

Examples are from the Taiwan-Guidebook repo, where this skill started.

**Delegate:**
- Pure logic with contract tests: parsers, validators, formatters, transforms, CLI helpers. (T1, T2, T4a, zhuyin and tones all went through cleanly.)
- Mechanical data transforms and migrations, with a test on the result.
- Bulk mechanical edits across many files, when a test can check the rule.
- Content drafted only from facts already in the repo, with a test on its shape and that nothing else changed; Claude then traces each claim back to its source, which is quick because the source is in the same file. (Must-see reasons, commit `9273e74`.)
- Helper scripts whose logic is pure even if the script fetches (e.g. a source-quote checker): the contract covers the pure part.

**Keep in Claude:**
- Web fact research, or anything that introduces new facts. The worker invents: one research draft had made-up dates, an award and a source that returned 404, and Claude rewrote both places from the sources (commit `7c77da6`), so nothing was saved.
- UI, layout and browser checks (tests can't see layout; the review is not cheaper).
- Design, specs, shared types, schemas: anything other code builds on.
- Tiny edits (the worker's 5 to 10 minute turnaround is not worth it).
- Work that is already mostly done (the handoff prompt costs more than finishing).
- Changes to the gate script itself: it would gate its own replacement. If its pure helpers are delegated anyway, Claude reads the whole diff.

## Workflow

1. **Contract.** Write the module with exported functions as stubs (`throw new Error('TODO')`) and JSDoc/docstrings stating inputs, outputs and edge cases. Write tests in `tests/tasks/`. Then prove the tests are passable: implement a throwaway reference version in the scratchpad, run the tests, restore the stub. A wrong test makes the worker "fix" the test or loop.
2. **Commit the contract** so the worker's worktree starts from it.
3. **Run the gate script** (`scripts/agy-task.mjs run ...`, see `references/gate-script.md`). Run it in the background and do Claude-only work meanwhile.
4. **Act on the verdict:**

| Verdict | Meaning | Claude does |
|---|---|---|
| `accept` | checks pass, no risk flags | smoke-test anything the tests don't cover (e.g. a CLI entry point), then commit and merge without reading the code |
| `accept, review queued` | checks pass, only low-risk flags (size, UI files) | merge; the files wait in the review queue |
| `review now` | a flag that can't wait | read the diff before merging |
| `reject` | checks still failing after retries, files outside the allowlist, tests touched, or nothing changed | read the report; fix the prompt, the contract, or permissions |

5. **Promote** the task's tests from `tests/tasks/` to `tests/core/` once merged, so every later gate re-checks them.
6. **Clean up** (not from inside the task worktree): `node <skill>/scripts/agy-task.mjs finish --task X` (in Taiwan-Guidebook: `npm run agy -- finish --task X`). It removes `.worktrees/agy-X`, deletes branch `agy/X` with `git branch -d` and deletes the report. It refuses if the branch isn't merged, the worktree has uncommitted changes, or the worktree isn't on `agy/X` (detached commits would be lost). Skipping it has a cost: a leftover registered worktree is silently reused, with its old state, by the next `run` with that name; a leftover branch or unlisted folder makes `run` stop.

## Never defer these to the batch review

- Security-sensitive code: `innerHTML`, `eval`, `new Function`, shell commands, auth, anything handling secrets.
- Things other code builds on: shared types, specs, schemas, public interfaces. A spec gap found late gets built on (in the first project, reading a delegated parser revealed the prompt never exposed the ids the parser needed).
- Anything going public: the review queue must be empty before a release.

## Batch review

Low-risk flags go to `.agy/review-queue.json` instead of interrupting work. Code under development changes several times; reviewing each round wastes effort. When the user has spare quota (e.g. at night), run `node <skill>/scripts/agy-task.mjs queue` (in Taiwan-Guidebook: `npm run agy -- queue`): each file appears once with a `git diff <first base> HEAD -- <file>` covering all rounds, so it is read once, in its latest form. Clear reviewed files with `--clear <file>`.

## Passing tests is not the same as good code

Tests catch only what they assert. Things that slipped past green tests in practice: 130-line functions for a 25-line job, technical error messages shown to end users, a spec gap. Mitigations, cheapest first:
- Put the expectation in the contract: "keep it under N lines", "user-facing messages are plain sentences", exact message strings in tests.
- Mechanical flags in the gate (size, risky APIs, UI files).
- The batch review.

## Cost notes

- The worker's first draft is usually verbose; one review round via the same conversation (`--conversation <id>`) fixes most of it.
- Expect 5 to 10 minutes per task. Parallelize: worker in the background, Claude on design/UI.
- Claude's cost is in tool calls and reading. The gate script exists to turn 5 to 8 tool calls per task into one with a compact report.

## Worker-specific setup

- Antigravity CLI (`agy`): `references/agy-setup.md` (sandbox mode, absolute permission paths, the silent-deny trap).
- Another CLI agent: it needs a headless mode that takes a prompt, edits files in a working directory, and returns machine-readable output with a conversation id for follow-ups. Adapt `agy()` and `parseAgyJson()` in the gate script.
