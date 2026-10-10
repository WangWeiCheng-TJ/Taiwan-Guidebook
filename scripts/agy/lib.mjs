// Pure helpers for scripts/agy-task.mjs: parse agy output, gate the result, decide whether Claude must read the code.
// TASK (delegated): implement the bodies; do not change names, parameters or return shapes.
// Contract tests: tests/tasks/agy-lib.test.js

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
 */

/**
 * Parse agy's stdout from `agy -p ... --output-format json`.
 * stdout can contain other lines before the JSON (log noise, "jetski: ..." notices).
 * Use the LAST line that parses as a JSON object with a "status" field.
 * @param {string} stdout
 * @returns {AgyResult}
 */
export function parseAgyJson(stdout) {
  throw new Error('TODO: parseAgyJson');
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
  throw new Error('TODO: summarizeTests');
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
  throw new Error('TODO: checkScope');
}

/**
 * Risk flags that mean "Claude should read the code even though checks passed".
 * Only ADDED diff lines (starting with "+" but not "+++") are inspected for content flags.
 * Flags, in this order, each at most once:
 * - total added lines > opts.maxAdded (default 150)      → "Large change: <n> lines added."
 * - a file under app/js/views/, or app/sw.js, app/index.html, app/app.css
 *                                                        → "Touches UI or offline code: <file>" (one flag per file)
 * - an added line contains "innerHTML"                   → "Uses innerHTML: check escaping."
 * - an added line contains "eval(" or "new Function("    → "Uses eval or new Function."
 * - an added line contains "TODO" or "FIXME"             → "Leaves a TODO or FIXME."
 * @param {NumstatRow[]} numstat
 * @param {string} diff   unified diff text
 * @param {{ maxAdded?: number }} [opts]
 * @returns {string[]}
 */
export function reviewFlags(numstat, diff, opts = {}) {
  throw new Error('TODO: reviewFlags');
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
  throw new Error('TODO: decide');
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
  throw new Error('TODO: retryPrompt');
}
