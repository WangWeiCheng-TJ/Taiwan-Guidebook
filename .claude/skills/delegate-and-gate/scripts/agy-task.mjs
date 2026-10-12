#!/usr/bin/env node
// Delegate a task to Antigravity CLI (agy) and gate the result, so Claude only reads code when it must.
//
//   node agy-task.mjs run --task t5 --allow app/js/foo.js,scripts/ --test "node --test tests/tasks/foo.test.js" \
//        --prompt "Implement ..." [--prompt-file f.md] [--base feat/pwa-poc] [--retries 2] [--timeout 20m] [--model slug]
//   node agy-task.mjs gate --task t5 --allow ... --test ...     (re-check an existing worktree, no agy call)
//   node agy-task.mjs finish --task t5                           (after the merge: remove worktree, branch, report)
//   node agy-task.mjs queue                                      (deferred reviews, grouped by file)
//   node agy-task.mjs queue --clear <file>... | --clear-all
//
// Each run works in .worktrees/agy-<task> on branch agy/<task>, never commits, and prints one compact report.
// Verdicts: accept | accept, review queued (low-risk flags deferred) | review now | reject.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAgyJson, summarizeTests, checkScope, reviewFlags, decide, retryPrompt,
  validTask, parseWorktrees, pathKey, isInside, worktreeAction, planFinish,
} from './lib.mjs';

// Project settings live in .agy/config.json (all optional):
//   { "coreTest", "nowFiles" (regex), "maxAdded", "uiPaths" (paths or dir/ prefixes), "agy" }
// ROOT is the main worktree (git lists it first), also when called from inside .worktrees/.
const ROOT = parseWorktrees(git(process.cwd(), 'worktree', 'list', '--porcelain'))[0].path;
const CONFIG_FILE = join(ROOT, '.agy', 'config.json');
const CONFIG = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {};
const QUEUE = join(ROOT, '.agy', 'review-queue.json');
const AGY = process.env.AGY || CONFIG.agy || join(process.env.LOCALAPPDATA || '', 'agy', 'bin', 'agy.exe');
const CORE_TEST = CONFIG.coreTest || 'npm test';
// How to call this script again, for hints in messages: "npm run agy --" under npm, else "node <path>".
const SELF = process.env.npm_lifecycle_script?.includes('agy-task.mjs')
  ? `npm run ${process.env.npm_lifecycle_event} --`
  : `node ${relative(process.cwd(), fileURLToPath(import.meta.url)).replaceAll('\\', '/')}`;

// Flags that must not wait for a batch review: security, or things other code builds on.
const NOW_FLAG = /innerHTML|eval/;
const NOW_FILE = new RegExp(CONFIG.nowFiles || '^(docs/SPEC\\.md|schema/|.*types\\.(js|ts)$)');

const PREAMBLE = `Ground rules (from docs/SPEC.md): do not change any exported name, parameter or return shape;
do not edit or delete any test file; no new dependencies; do not commit, push or run git commands that change history;
only change the files you are told to. Keep code short and readable. Text shown to users is a key in app/js/lang.js
with both en and zh_TW strings (tests/core/lang.test.js checks both exist), written as plain sentences.
Finish with a short summary of what you changed and the pass/fail counts of the checks you ran.`;

function args(argv) {
  const out = { _: [], test: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    if (key === 'test') out.test.push(val);
    else if (key === 'clear') (out.clear ||= []).push(val);
    else out[key] = val;
  }
  return out;
}

function sh(cmd, cwd) {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function git(cwd, ...a) {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr.trim()}`);
  return r.stdout;
}

/** True when the git command exits 0 (for yes/no questions; output discarded). */
function gitOk(cwd, ...a) {
  return spawnSync('git', a, { cwd, stdio: 'ignore' }).status === 0;
}

/** Paths and names for a task; refuses names that could leave .worktrees/. */
function taskPaths(task) {
  if (!validTask(task)) throw new Error('--task is required: letters, digits, ".", "_" or "-", starting with a letter or digit');
  const rel = `.worktrees/agy-${task}`;
  return { dir: join(ROOT, rel), rel, branch: `agy/${task}`, finish: `${SELF} finish --task ${task}` };
}

const branchExists = branch => gitOk(ROOT, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`);
const findWorktree = dir => parseWorktrees(git(ROOT, 'worktree', 'list', '--porcelain')).find(w => pathKey(w.path) === pathKey(dir));

// Reuse only a worktree git knows about; create one only for `run` and only when nothing is in the way.
function worktree(task, base, create) {
  const { dir, rel, branch, finish } = taskPaths(task);
  const w = findWorktree(dir);
  const s = { registered: !!w, onBranch: w?.branch === `refs/heads/${branch}`, dirExists: existsSync(dir), branchExists: branchExists(branch), create };
  const a = worktreeAction(s, { dir: rel, branch, finish });
  if (a.action === 'stop') throw new Error(a.reason);
  if (a.action === 'create') git(ROOT, 'worktree', 'add', '-q', dir, '-b', branch, base);
  return dir;
}

function agy(dir, prompt, opts, conversation) {
  const a = ['-p', prompt, '--output-format', 'json', '--print-timeout', opts.timeout || '20m'];
  if (conversation) a.push('--conversation', conversation);
  if (opts.model) a.push('--model', opts.model);
  const r = spawnSync(AGY, a, { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20 });
  return parseAgyJson(r.stdout || '');
}

function changedFiles(dir) {
  return git(dir, 'status', '--porcelain', '-uall').split('\n').filter(Boolean)
    .map(l => l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''));
}

// agy writes CRLF on Windows; normalize so diffs and exact-match edits stay clean.
function toLF(dir, files) {
  for (const f of files) {
    const p = join(dir, f);
    if (!existsSync(p) || /\.(png|jpg|ico)$/i.test(f)) continue;
    const s = readFileSync(p, 'utf8');
    if (s.includes('\r\n')) writeFileSync(p, s.replace(/\r\n/g, '\n'));
  }
}

function check(dir, opts) {
  const files = changedFiles(dir);
  toLF(dir, files);
  const problems = [];
  const { outside, testsTouched } = checkScope(files, opts.allow);
  if (outside.length) problems.push(`Changed files outside --allow: ${outside.join(', ')}`);
  if (testsTouched.length) problems.push(`Touched tests: ${testsTouched.join(', ')}`);
  if (!files.length) problems.push('No files changed.');
  const failures = [];
  const tests = [...opts.test, CORE_TEST].map(cmd => {
    const r = sh(cmd, dir);
    const s = summarizeTests(r.out);
    if (s.fail || r.code) failures.push({ command: cmd, output: r.out });
    return { cmd, ...s };
  });
  if (failures.length) problems.push(`Checks failed: ${failures.map(f => f.command).join('; ')}`);
  return { files, problems, failures, tests };
}

function flagsFor(dir, files, opts) {
  git(dir, 'add', '-N', '--', ...files); // include new files in the diff
  const numstat = git(dir, 'diff', '--numstat').split('\n').filter(Boolean).map(l => {
    const [a, r, file] = l.split('\t');
    return { file, added: +a || 0, removed: +r || 0 };
  });
  const flags = reviewFlags(numstat, git(dir, 'diff'), { maxAdded: +opts['max-added'] || CONFIG.maxAdded || 150, uiPaths: CONFIG.uiPaths });
  const now = flags.some(f => NOW_FLAG.test(f)) || files.some(f => NOW_FILE.test(f));
  return { numstat, flags, now };
}

function readQueue() {
  return existsSync(QUEUE) ? JSON.parse(readFileSync(QUEUE, 'utf8')) : [];
}

function enqueue(entry) {
  mkdirSync(join(ROOT, '.agy'), { recursive: true });
  writeFileSync(QUEUE, JSON.stringify([...readQueue(), entry], null, 2) + '\n');
}

function report(r) {
  const lines = [
    `task ${r.task}  verdict: ${r.verdict}  rounds: ${r.rounds}  agy: ${r.agy.status}${r.agy.usage ? `, ${r.agy.usage.output} out tokens` : ''}`,
    `worktree ${r.dir}  conversation ${r.agy.conversationId || '-'}`,
    `files: ${r.numstat.map(n => `${n.file} (+${n.added}/-${n.removed})`).join(', ') || '(none)'}`,
    `tests: ${r.tests.map(t => `${t.cmd} ${t.pass}/${t.pass + t.fail}${t.failing.length ? ` failing: ${t.failing.slice(0, 5).join(', ')}` : ''}`).join(' | ')}`,
  ];
  if (r.agy.denied.length) lines.push(`denied by agy permissions: ${r.agy.denied.join(', ')}`);
  for (const p of r.problems) lines.push(`problem: ${p}`);
  for (const f of r.flags) lines.push(`flag: ${f}`);
  return lines.join('\n');
}

function run(o, callAgy) {
  if (!o.task || !o.allow) throw new Error('--task and --allow are required');
  const opts = { ...o, allow: String(o.allow).split(',') };
  const dir = worktree(o.task, o.base || 'HEAD', callAgy);
  const base = git(ROOT, 'merge-base', 'HEAD', `refs/heads/agy/${o.task}`).trim();
  let res = { conversationId: null, status: 'SKIPPED', denied: [], usage: null };
  let rounds = 0;
  let c = callAgy ? null : check(dir, opts);
  if (callAgy) {
    const task = o['prompt-file'] ? readFileSync(o['prompt-file'], 'utf8') : o.prompt;
    if (!task) throw new Error('--prompt or --prompt-file is required');
    const checks = [...opts.test, CORE_TEST].map(t => `'${t}'`).join(', ');
    let prompt = `${PREAMBLE}\nYou may change only: ${opts.allow.join(', ')}.\nDone means these pass: ${checks}.\n\n${task}`;
    const retries = o.retries === undefined ? 2 : +o.retries;
    do {
      res = agy(dir, prompt, opts, res.conversationId);
      rounds++;
      c = check(dir, opts);
      const scopeOk = !c.problems.some(p => !p.startsWith('Checks failed'));
      if (!c.failures.length || !scopeOk || !res.conversationId) break;
      prompt = retryPrompt(c.failures);
    } while (rounds <= retries);
  }
  const { numstat, flags, now } = c.files.length ? flagsFor(dir, c.files, opts) : { numstat: [], flags: [], now: false };
  let verdict = decide(c.problems, flags);
  if (verdict === 'review') {
    if (now) verdict = 'review now';
    else {
      enqueue({ task: o.task, branch: `agy/${o.task}`, base, files: c.files, flags, queuedAt: new Date().toISOString() });
      verdict = 'accept, review queued';
    }
  }
  const r = { task: o.task, dir, verdict, rounds, agy: res, numstat, flags, ...c };
  writeFileSync(`${dir}.report.json`, JSON.stringify(r, null, 2));
  console.log(report(r));
  return verdict.startsWith('accept') ? 0 : 1;
}

function queue(o) {
  let q = readQueue();
  if (o['clear-all'] || o.clear) {
    const drop = new Set(o.clear || []);
    q = o['clear-all'] ? [] : q.map(e => ({ ...e, files: e.files.filter(f => !drop.has(f)) })).filter(e => e.files.length);
    mkdirSync(join(ROOT, '.agy'), { recursive: true });
    writeFileSync(QUEUE, JSON.stringify(q, null, 2) + '\n');
  }
  // One line per file: review its total change since the earliest queued base, i.e. only the latest version.
  const byFile = new Map();
  for (const e of q) for (const f of e.files) {
    const cur = byFile.get(f) || { base: e.base, tasks: [], flags: new Set() };
    cur.tasks.push(e.task);
    e.flags.forEach(x => cur.flags.add(x));
    byFile.set(f, cur);
  }
  if (!byFile.size) return console.log('Review queue is empty.'), 0;
  for (const [f, v] of byFile) {
    console.log(`${f}  [${v.tasks.join(', ')}]  ${[...v.flags].join(' ')}\n  git diff ${v.base.slice(0, 9)} HEAD -- ${f}`);
  }
  return 0;
}

// After the task branch is merged: remove its worktree, branch (-d only) and report. Touches nothing else.
function finish(o) {
  const { dir, rel, branch } = taskPaths(o.task);
  const report = `${dir}.report.json`;
  const exists = branchExists(branch);
  const dirExists = existsSync(dir);
  const w = findWorktree(dir);
  const plan = planFinish({
    branchExists: exists,
    merged: exists && gitOk(ROOT, 'merge-base', '--is-ancestor', `refs/heads/${branch}`, 'HEAD'),
    cwdInside: isInside(process.cwd(), dir),
    registered: !!w,
    onBranch: w?.branch === `refs/heads/${branch}`,
    dirExists,
    dirEmpty: dirExists && readdirSync(dir).length === 0,
    reportExists: existsSync(report),
  }, { dir: rel, branch });
  if (!plan.ok) throw new Error(`finish refused: ${plan.reason}`);
  const sha = git(ROOT, 'rev-parse', '--short', `refs/heads/${branch}`).trim();
  const steps = {
    'remove-worktree': () => (git(ROOT, 'worktree', 'remove', dir), `removed worktree ${rel}`),
    'remove-empty-dir': () => (rmdirSync(dir), `removed empty ${rel}`),
    'delete-branch': () => (git(ROOT, 'branch', '-d', branch), `deleted branch ${branch} (was ${sha})`),
    'delete-report': () => (unlinkSync(report), `deleted ${rel}.report.json`),
  };
  const done = [];
  try {
    for (const step of plan.steps) done.push(steps[step]());
  } finally {
    if (done.length) console.log(`finish ${o.task}: ${done.join(', ')}.`);
  }
  return 0;
}

function usage(code) {
  const lines = readFileSync(new URL(import.meta.url), 'utf8').split(/\r?\n/).slice(1);
  console.log(lines.slice(0, lines.findIndex(l => !l.startsWith('//'))).join('\n'));
  return code;
}

const COMMANDS = { run: o => run(o, true), gate: o => run(o, false), finish, queue };
const o = args(process.argv.slice(2));
const cmd = o._[0];
try {
  process.exitCode = Object.hasOwn(COMMANDS, cmd) ? COMMANDS[cmd](o) : usage(o.help ? 0 : 2);
} catch (e) {
  console.error(`agy-task: ${e.message}`);
  process.exitCode = 2;
}
