// Pure helpers for agy-task.mjs: parse agy output, gate the result, decide whether Claude must read the code,
// and decide what to do with a task's worktree and branch.
// Contract tests (in the Taiwan-Guidebook repo): tests/core/agy-lib.test.js, agy-uipaths.test.js, agy-finish.test.js

/**
 * @typedef {Object} AgyResult
 * @property {string|null} conversationId
 * @property {string} status        agy status (SUCCESS, ERROR, ...) or "NO_JSON"
 * @property {string} response      the agent's final text ("" if none)
 * @property {string[]} denied      denied_actions[].action, e.g. ["command", "write_file"]
 * @property {{ output: number, total: number }|null} usage   output_tokens and total_tokens
 * @property {string|null} error    agy's error text, or "No JSON result from agy." when nothing parsed
 *
 * @typedef {Object} TestSummary
 * @property {number} pass
 * @property {number} fail
 * @property {string[]} failing     names of failing tests, deduplicated, in order of appearance
 *
 * @typedef {{ file: string, added: number, removed: number }} NumstatRow
 *
 * @typedef {Object} WorktreeEntry
 * @property {string} path            as git prints it, e.g. "D:/repo/.worktrees/agy-t5"
 * @property {string|null} head       commit id
 * @property {string|null} branch     full ref, e.g. "refs/heads/agy/t5"; null when detached
 */

/**
 * Parse agy's stdout from `agy -p ... --output-format json`.
 * stdout can contain other lines before the JSON (log noise, "jetski: ..." notices).
 * Use the LAST line that parses as a JSON object with a "status" field.
 * @param {string} stdout
 * @returns {AgyResult}
 */
export function parseAgyJson(stdout) {
  let parsed = null;
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object' && typeof obj.status === 'string') {
        parsed = obj;
      }
    } catch {}
  }
  if (!parsed) {
    return {
      conversationId: null,
      status: 'NO_JSON',
      response: '',
      denied: [],
      usage: null,
      error: 'No JSON result from agy.',
    };
  }
  return {
    conversationId: parsed.conversation_id ?? parsed.conversationId ?? null,
    status: parsed.status,
    response: parsed.response ?? '',
    denied: (parsed.denied_actions ?? []).map(a => a?.action ?? a),
    usage: parsed.usage ? {
      output: parsed.usage.output_tokens ?? parsed.usage.output,
      total: parsed.usage.total_tokens ?? parsed.usage.total,
    } : null,
    error: parsed.error ?? null,
  };
}

/**
 * Summarize test runner output. Supports both formats:
 * - node --test: "ℹ pass N", "ℹ fail N"; failing tests are lines like "✖ <name> (12.3ms)"
 *   (ignore the "✖ failing tests:" header line; strip the trailing "(...ms)").
 * - python unittest: "Ran N tests"; "OK" or "FAILED (failures=a, errors=b)";
 *   failing tests are lines "FAIL: <name> (...)" or "ERROR: <name> (...)" → name only.
 *   pass = N - a - b, fail = a + b.
 * Output with neither format → { pass: 0, fail: 1, failing: ["(could not read test output)"] }.
 * @param {string} output
 * @returns {TestSummary}
 */
export function summarizeTests(output) {
  const nodePass = output.match(/ℹ pass (\d+)/);
  const nodeFail = output.match(/ℹ fail (\d+)/);
  if (nodePass && nodeFail) {
    const pass = Number(nodePass[1]);
    const fail = Number(nodeFail[1]);
    const failing = [];
    for (const line of output.split('\n')) {
      const m = line.match(/^\s*✖\s+(.+)$/);
      if (m && !m[1].startsWith('failing tests')) {
        const name = m[1].replace(/\s+\([^)]+\)\s*$/, '').trim();
        if (!failing.includes(name)) failing.push(name);
      }
    }
    return { pass, fail, failing };
  }

  const pyRan = output.match(/Ran (\d+) tests?/);
  if (pyRan) {
    const n = Number(pyRan[1]);
    const failures = Number(output.match(/failures=(\d+)/)?.[1] || 0);
    const errors = Number(output.match(/errors=(\d+)/)?.[1] || 0);
    const fail = failures + errors;
    const pass = n - fail;
    const failing = [];
    for (const line of output.split('\n')) {
      const m = line.match(/^(?:FAIL|ERROR):\s+(.+?)(?:\s+\(|$)/);
      if (m && !failing.includes(m[1])) failing.push(m[1]);
    }
    return { pass, fail, failing };
  }

  return { pass: 0, fail: 1, failing: ['(could not read test output)'] };
}

/**
 * Check which changed files are allowed.
 * `allow` entries are repo-relative paths; an entry ending in "/" allows everything under it.
 * Backslashes in either list are treated as "/".
 * @param {string[]} changed   repo-relative paths from git status
 * @param {string[]} allow
 * @returns {{ outside: string[], testsTouched: string[] }}  outside = not allowed; testsTouched = under "tests/" (even if allowed)
 */
export function checkScope(changed, allow) {
  const normAllow = allow.map(a => a.replaceAll('\\', '/'));
  const outside = [];
  const testsTouched = [];
  for (const file of changed) {
    const norm = file.replaceAll('\\', '/');
    const isAllowed = normAllow.some(a => a.endsWith('/') ? norm.startsWith(a) : norm === a);
    if (!isAllowed) outside.push(norm);
    if (norm.startsWith('tests/')) testsTouched.push(norm);
  }
  return { outside, testsTouched };
}

export const DEFAULT_UI_PATHS = ['app/js/views/', 'app/sw.js', 'app/index.html', 'app/app.css'];

/**
 * Risk flags that mean "Claude should read the code even though checks passed".
 * Only ADDED diff lines (starting with "+" but not "+++") are inspected for content flags.
 * Flags, in this order, each at most once:
 * - total added lines > opts.maxAdded (default 150)      → "Large change: <n> lines added."
 * - a file matching opts.uiPaths                         → "Touches UI or offline code: <file>" (one flag per file)
 *   uiPaths entries are exact repo-relative paths, or directory prefixes ending in "/".
 *   Default (when opts.uiPaths is undefined): DEFAULT_UI_PATHS. An empty array disables this flag.
 * - an added line contains "innerHTML"                   → "Uses innerHTML: check escaping."
 * - an added line contains "eval(" or "new Function("    → "Uses eval or new Function."
 * - an added line contains "TODO" or "FIXME"             → "Leaves a TODO or FIXME."
 * @param {NumstatRow[]} numstat
 * @param {string} diff   unified diff text
 * @param {{ maxAdded?: number, uiPaths?: string[] }} [opts]
 * @returns {string[]}
 */
export function reviewFlags(numstat, diff, opts = {}) {
  const flags = [];
  const maxAdded = opts.maxAdded ?? 150;
  const totalAdded = numstat.reduce((sum, r) => sum + (r.added || 0), 0);
  if (totalAdded > maxAdded) flags.push(`Large change: ${totalAdded} lines added.`);

  const uiPaths = (opts.uiPaths ?? DEFAULT_UI_PATHS).map(p => p.replaceAll('\\', '/'));
  const seenFiles = new Set();
  for (const { file } of numstat) {
    const norm = file.replaceAll('\\', '/');
    const isUi = uiPaths.some(p => p.endsWith('/') ? norm.startsWith(p) : norm === p);
    if (isUi && !seenFiles.has(norm)) {
      seenFiles.add(norm);
      flags.push(`Touches UI or offline code: ${norm}`);
    }
  }

  const addedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
  if (addedLines.some(l => l.includes('innerHTML'))) flags.push('Uses innerHTML: check escaping.');
  if (addedLines.some(l => l.includes('eval(') || l.includes('new Function('))) flags.push('Uses eval or new Function.');
  if (addedLines.some(l => l.includes('TODO') || l.includes('FIXME'))) flags.push('Leaves a TODO or FIXME.');

  return flags;
}

/**
 * Final verdict.
 * - any problem → "reject" (checks failed: Claude or a retry must deal with it)
 * - no problems but flags → "review" (Claude reads the diff)
 * - neither → "accept"
 * @param {string[]} problems
 * @param {string[]} flags
 * @returns {'accept'|'review'|'reject'}
 */
export function decide(problems, flags) {
  if (problems.length) return 'reject';
  if (flags.length) return 'review';
  return 'accept';
}

/**
 * Prompt sent back to the same agy conversation when checks fail.
 * Starts with: "These checks failed. Fix the implementation, not the tests, then run them again."
 * Then, per failure: a blank line, "$ <command>", and the LAST `maxLines` lines of its output (default 40).
 * @param {{ command: string, output: string }[]} failures
 * @param {number} [maxLines]
 * @returns {string}
 */
export function retryPrompt(failures, maxLines = 40) {
  const parts = ['These checks failed. Fix the implementation, not the tests, then run them again.'];
  for (const { command, output } of failures) {
    parts.push('', `$ ${command}`);
    const lines = output ? output.split(/\r?\n/) : [];
    parts.push(...(maxLines > 0 ? lines.slice(-maxLines) : []));
  }
  return parts.join('\n');
}

/**
 * A task name that is safe both as a branch (agy/<task>) and as a directory (.worktrees/agy-<task>):
 * letters, digits, ".", "_" and "-", starting with a letter or digit. No "/" or "\", so it can't leave .worktrees/.
 * Also no "..", trailing "." or ".lock", which git refuses as branch names (and Windows drops a trailing dot).
 * @param {unknown} task
 * @returns {boolean}
 */
export function validTask(task) {
  return typeof task === 'string' && /^[A-Za-z0-9][\w.-]*$/.test(task) && !/\.\.|\.$|\.lock$/i.test(task);
}

/**
 * Parse `git worktree list --porcelain`: one block per worktree, each starting with "worktree <path>".
 * Reads the "HEAD <id>" and "branch <ref>" lines; ignores the rest ("detached", "locked", "prunable ...").
 * @param {string} porcelain
 * @returns {WorktreeEntry[]}   in git's order, so the main worktree comes first
 */
export function parseWorktrees(porcelain) {
  const list = [];
  for (const line of porcelain.split(/\r?\n/)) {
    const i = line.indexOf(' ');
    if (i < 0) continue;
    const key = line.slice(0, i), val = line.slice(i + 1);
    if (key === 'worktree') list.push({ path: val, head: null, branch: null });
    else if (key === 'HEAD' && list.length) list.at(-1).head = val;
    else if (key === 'branch' && list.length) list.at(-1).branch = val;
  }
  return list;
}

/**
 * Key for comparing paths: "/" separators, no trailing "/", lower case.
 * git prints "D:/repo", Node's join gives "D:\repo", and Windows paths ignore case.
 * @param {string} p
 * @returns {string}
 */
export function pathKey(p) {
  return p.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * True when path `p` is `dir` itself or anything below it (compared by pathKey).
 * @param {string} p
 * @param {string} dir
 * @returns {boolean}
 */
export function isInside(p, dir) {
  const a = pathKey(p), d = pathKey(dir);
  return a === d || a.startsWith(`${d}/`);
}

/**
 * How `run` and `gate` get a task's worktree. Checked in this order:
 * - registered (listed by git worktree list), on disk, on the task branch → { action: 'reuse' }
 * - registered and on disk but detached or on another branch → stop: "<dir> is not on <branch> (detached HEAD
 *   or another branch). Check it by hand: its commits may not be on <branch>.
 * - registered but not on disk → stop: "<dir> is registered but missing on disk. If <branch> is merged,
 *   run "<finish>"; if not, run "git worktree prune", then "git worktree add <dir> <branch>"."
 * - on disk but not registered → stop: "<dir> exists but is not a registered git worktree.
 *   Remove it (or run "<finish>" if <branch> is merged), then try again."
 * - branch exists without a worktree → stop: "Branch <branch> exists but has no worktree.
 *   If it is merged, run "<finish>"; if not, reattach it with "git worktree add <dir> <branch>"."
 * - none of these and s.create → { action: 'create' }
 * - none of these, no create (gate) → stop: "No worktree at <dir>. Start the task with run."
 * @param {{ registered: boolean, onBranch: boolean, dirExists: boolean, branchExists: boolean, create: boolean }} s
 *   onBranch = the registered worktree has the task branch checked out
 * @param {{ dir: string, branch: string, finish: string }} names   finish = the finish command to suggest
 * @returns {{ action: 'reuse'|'create'|'stop', reason?: string }}
 */
export function worktreeAction(s, { dir, branch, finish }) {
  const stop = reason => ({ action: 'stop', reason });
  if (s.registered && s.dirExists) {
    return s.onBranch ? { action: 'reuse' }
      : stop(`${dir} is not on ${branch} (detached HEAD or another branch). Check it by hand: its commits may not be on ${branch}.`);
  }
  if (s.registered) {
    return stop(`${dir} is registered but missing on disk. If ${branch} is merged, run "${finish}"; `
      + `if not, run "git worktree prune", then "git worktree add ${dir} ${branch}".`);
  }
  if (s.dirExists) {
    return stop(`${dir} exists but is not a registered git worktree. `
      + `Remove it (or run "${finish}" if ${branch} is merged), then try again.`);
  }
  if (s.branchExists) {
    return stop(`Branch ${branch} exists but has no worktree. `
      + `If it is merged, run "${finish}"; if not, reattach it with "git worktree add ${dir} ${branch}".`);
  }
  return s.create ? { action: 'create' } : stop(`No worktree at ${dir}. Start the task with run.`);
}

/**
 * @typedef {Object} FinishState     facts about one task, gathered by the caller with git and fs
 * @property {boolean} branchExists   the task branch exists
 * @property {boolean} merged         the task branch is an ancestor of HEAD
 * @property {boolean} cwdInside      the current directory is inside the worktree dir
 * @property {boolean} registered     the worktree dir is listed by git worktree list (on disk or not)
 * @property {boolean} onBranch       that listed worktree has the task branch checked out
 * @property {boolean} dirExists      the worktree dir exists on disk
 * @property {boolean} dirEmpty       it exists and has no entries
 * @property {boolean} reportExists   <dir>.report.json exists
 *
 * @typedef {'remove-worktree'|'remove-empty-dir'|'delete-branch'|'delete-report'} FinishStep
 */

/**
 * Plan `finish`: clean up a task after its branch was merged. Refusals, checked in this order:
 * - !branchExists → "Branch <branch> does not exist."
 * - !merged       → "Branch <branch> is not merged into HEAD. Merge it first."
 * - cwdInside     → "The current directory is inside <dir>. Run finish from outside it."
 * - registered, !onBranch → "<dir> is not on <branch> (detached HEAD or another branch), so removing it could lose commits. Check it by hand."
 * - dirExists, not registered, not empty → "<dir> is not a registered git worktree and is not empty. Check it and remove it by hand."
 * Otherwise these steps, in this order, each only when it applies:
 * "remove-worktree" (registered), "remove-empty-dir" (on disk, not registered), "delete-branch" (always),
 * "delete-report" (reportExists).
 * @param {FinishState} s
 * @param {{ dir: string, branch: string }} names
 * @returns {{ ok: false, reason: string } | { ok: true, steps: FinishStep[] }}
 */
export function planFinish(s, { dir, branch }) {
  const refuse = reason => ({ ok: false, reason });
  if (!s.branchExists) return refuse(`Branch ${branch} does not exist.`);
  if (!s.merged) return refuse(`Branch ${branch} is not merged into HEAD. Merge it first.`);
  if (s.cwdInside) return refuse(`The current directory is inside ${dir}. Run finish from outside it.`);
  if (s.registered && !s.onBranch) {
    return refuse(`${dir} is not on ${branch} (detached HEAD or another branch), so removing it could lose commits. Check it by hand.`);
  }
  if (s.dirExists && !s.registered && !s.dirEmpty) {
    return refuse(`${dir} is not a registered git worktree and is not empty. Check it and remove it by hand.`);
  }
  /** @type {FinishStep[]} */
  const steps = [];
  if (s.registered) steps.push('remove-worktree');
  else if (s.dirExists) steps.push('remove-empty-dir');
  steps.push('delete-branch');
  if (s.reportExists) steps.push('delete-report');
  return { ok: true, steps };
}
