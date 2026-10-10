// Pure helpers for agy-task.mjs: parse agy output, gate the result, decide whether Claude must read the code.
// Contract tests: tests/core/agy-lib.test.js (in the Taiwan-Guidebook repo)

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

  const uiFiles = new Set(['app/sw.js', 'app/index.html', 'app/app.css']);
  const seenFiles = new Set();
  for (const { file } of numstat) {
    const norm = file.replaceAll('\\', '/');
    if ((norm.startsWith('app/js/views/') || uiFiles.has(norm)) && !seenFiles.has(norm)) {
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
