# Antigravity CLI (agy) as the worker

Verified on Windows 11 with agy 1.3.3 (October 2026). Re-check flags with `agy --help` on newer versions.

## Install and sign in (the user does this)

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

The installer adds `%LOCALAPPDATA%\agy\bin` to the user PATH; an already-open shell won't see it, so call `agy.exe` by full path or restart the terminal. The user runs `agy` once interactively to sign in with Google and trust the project folder. Headless runs reuse that login.

## Settings that make headless runs work

`~/.gemini/antigravity-cli/settings.json` (global for the CLI; the IDE has separate settings):

```json
{
  "toolPermission": "proceed-in-sandbox",
  "enableTerminalSandbox": true,
  "permissions": {
    "allow": [
      "read_file(D:/path/to/repo/.git)",
      "write_file(D:/path/to/repo/.worktrees)",
      "command(node --test)",
      "command(git status)",
      "command(git diff)"
    ],
    "deny": ["command(git push)", "command(git commit)", "command(git reset)", "command(rm)"]
  }
}
```

- The sandbox on Windows uses AppContainer: no Docker or WSL needed.
- `read_file(<repo>/.git)`: a git worktree keeps its metadata in the main repo's `.git`, outside the worktree, so git commands fail in the sandbox without it.
- `write_file(<repo>/.worktrees)`: in sandbox mode, file writes are not auto-approved even inside the workspace.

## Traps

- **Silent deny.** In headless mode, an action that would need approval is skipped, and the run still returns `"status":"SUCCESS"` with an empty response. Always check `denied_actions` in the JSON (the gate script does).
- **Relative paths break the sandbox.** A rule like `write_file(.git/)` makes every sandboxed command fail with "non-absolute file path". Use absolute paths with forward slashes.
- **request-review mode ignores allow rules in headless runs**: commands were denied even when allowed. Use `proceed-in-sandbox`.
- **`--dangerously-skip-permissions`** is blocked by Claude Code's safety classifier (it creates an agent that can run anything on the host, including `git push` with the user's credentials). Don't work around it; use the sandbox.
- **`"error": "The stream was interrupted"`** can appear on a run that actually finished. Judge by the checks, not the error field.
- **CRLF.** agy writes Windows line endings. Add `* text=auto eol=lf` to `.gitattributes`; the gate script also normalizes changed files.
- **Don't edit `~/.gemini/config/config.json`.** It is the IDE's shared config across all the user's projects.
- You can't `git worktree remove` the directory your shell is in; run it from the repo root.

## Useful flags

`-p "<prompt>"` headless; `--output-format json`; `--conversation <id>` continue a run (send review feedback); `--print-timeout 20m` (default waits forever); `--model <slug>` (list with `agy models`); `--effort low|medium|high`.

## Observed quality (Gemini 3.8 Flash, default)

Correct against contract tests, honest summaries, respects "don't edit tests / signatures / don't commit". First drafts are verbose (e.g. 130 lines where 25 do); one feedback round fixes it. About 5 to 10 minutes and 40k to 45k output tokens per small task.
