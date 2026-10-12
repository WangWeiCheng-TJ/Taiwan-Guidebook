// Contract: worktree reuse and `finish` decisions in .claude/skills/delegate-and-gate/scripts/lib.mjs.
// Pure functions only; no git runs here. Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validTask, parseWorktrees, pathKey, isInside, worktreeAction, planFinish,
} from '../../.claude/skills/delegate-and-gate/scripts/lib.mjs';

test('validTask accepts branch- and folder-safe names only', () => {
  for (const t of ['t5', 't4a', 'must-see', 'A_1.2']) assert.equal(validTask(t), true, t);
  for (const t of ['', '../x', 'a/b', 'a\\b', '.hidden', '-x', 'a b', 'a..b', 't5.', 'x.lock', true, undefined]) {
    assert.equal(validTask(t), false, String(t));
  }
});

test('parseWorktrees reads path, HEAD and branch per block', () => {
  const porcelain = [
    'worktree D:/repo', 'HEAD aaa', 'branch refs/heads/feat/pwa-poc', '',
    'worktree D:/repo/.worktrees/agy-t5', 'HEAD bbb', 'branch refs/heads/agy/t5', 'prunable gitdir file points to non-existent location', '',
    'worktree D:/My Repo/.worktrees/agy-x', 'HEAD ccc', 'detached', '',
  ].join('\r\n');
  assert.deepEqual(parseWorktrees(porcelain), [
    { path: 'D:/repo', head: 'aaa', branch: 'refs/heads/feat/pwa-poc' },
    { path: 'D:/repo/.worktrees/agy-t5', head: 'bbb', branch: 'refs/heads/agy/t5' },
    { path: 'D:/My Repo/.worktrees/agy-x', head: 'ccc', branch: null },
  ]);
  assert.deepEqual(parseWorktrees(''), []);
});

test('pathKey and isInside ignore separator style, trailing slash and case', () => {
  assert.equal(pathKey('D:\\Repo\\.worktrees\\agy-t5\\'), 'd:/repo/.worktrees/agy-t5');
  assert.equal(pathKey('D:/repo/.worktrees/agy-t5'), pathKey('d:\\REPO\\.worktrees\\agy-t5'));
  assert.equal(isInside('D:\\repo\\.worktrees\\agy-t5', 'D:/repo/.worktrees/agy-t5'), true);
  assert.equal(isInside('D:\\repo\\.worktrees\\agy-t5\\app\\js', 'D:/repo/.worktrees/agy-t5'), true);
  assert.equal(isInside('D:/repo/.worktrees/agy-t55', 'D:/repo/.worktrees/agy-t5'), false);
  assert.equal(isInside('D:/repo', 'D:/repo/.worktrees/agy-t5'), false);
});

const names = { dir: '.worktrees/agy-t5', branch: 'agy/t5', finish: 'npm run agy -- finish --task t5' };
const none = { registered: false, dirExists: false, branchExists: false };

test('worktreeAction reuses only a registered worktree that is on disk and on the task branch', () => {
  const ok = { registered: true, onBranch: true, dirExists: true, branchExists: true };
  assert.deepEqual(worktreeAction({ ...ok, create: true }, names), { action: 'reuse' });
  assert.deepEqual(worktreeAction({ ...ok, create: false }, names), { action: 'reuse' });
  const detached = worktreeAction({ ...ok, onBranch: false, create: false }, names);
  assert.equal(detached.action, 'stop');
  assert.equal(detached.reason, '.worktrees/agy-t5 is not on agy/t5 (detached HEAD or another branch). '
    + 'Check it by hand: its commits may not be on agy/t5.');
});

test('worktreeAction creates only for run and only when nothing is in the way', () => {
  assert.deepEqual(worktreeAction({ ...none, create: true }, names), { action: 'create' });
  const gate = worktreeAction({ ...none, create: false }, names);
  assert.equal(gate.action, 'stop');
  assert.equal(gate.reason, 'No worktree at .worktrees/agy-t5. Start the task with run.');
});

test('worktreeAction stops with a fix for each leftover', () => {
  const unregistered = worktreeAction({ ...none, dirExists: true, branchExists: true, create: true }, names);
  assert.equal(unregistered.action, 'stop');
  assert.equal(unregistered.reason, '.worktrees/agy-t5 exists but is not a registered git worktree. '
    + 'Remove it (or run "npm run agy -- finish --task t5" if agy/t5 is merged), then try again.');

  const branchOnly = worktreeAction({ ...none, branchExists: true, create: true }, names);
  assert.equal(branchOnly.action, 'stop');
  assert.equal(branchOnly.reason, 'Branch agy/t5 exists but has no worktree. If it is merged, run '
    + '"npm run agy -- finish --task t5"; if not, reattach it with "git worktree add .worktrees/agy-t5 agy/t5".');

  const missing = worktreeAction({ registered: true, dirExists: false, branchExists: true, create: true }, names);
  assert.equal(missing.action, 'stop');
  assert.match(missing.reason, /^\.worktrees\/agy-t5 is registered but missing on disk\. /);
  assert.match(missing.reason, /git worktree prune/);
});

const merged = {
  branchExists: true, merged: true, cwdInside: false,
  registered: true, onBranch: true, dirExists: true, dirEmpty: false, reportExists: true,
};

test('planFinish: full cleanup of a merged task', () => {
  assert.deepEqual(planFinish(merged, names), { ok: true, steps: ['remove-worktree', 'delete-branch', 'delete-report'] });
});

test('planFinish: partial leftovers', () => {
  const noDir = { ...merged, registered: false, onBranch: false, dirExists: false, reportExists: false };
  assert.deepEqual(planFinish(noDir, names), { ok: true, steps: ['delete-branch'] });
  const emptyDir = { ...merged, registered: false, onBranch: false, dirEmpty: true };
  assert.deepEqual(planFinish(emptyDir, names), { ok: true, steps: ['remove-empty-dir', 'delete-branch', 'delete-report'] });
  const registeredButGone = { ...merged, dirExists: false, reportExists: false };
  assert.deepEqual(planFinish(registeredButGone, names), { ok: true, steps: ['remove-worktree', 'delete-branch'] });
});

test('planFinish refuses, in order, with the reason', () => {
  assert.deepEqual(planFinish({ ...merged, branchExists: false, merged: false }, names),
    { ok: false, reason: 'Branch agy/t5 does not exist.' });
  assert.deepEqual(planFinish({ ...merged, merged: false, cwdInside: true }, names),
    { ok: false, reason: 'Branch agy/t5 is not merged into HEAD. Merge it first.' });
  assert.deepEqual(planFinish({ ...merged, cwdInside: true }, names),
    { ok: false, reason: 'The current directory is inside .worktrees/agy-t5. Run finish from outside it.' });
  assert.deepEqual(planFinish({ ...merged, onBranch: false }, names), { ok: false, reason: '.worktrees/agy-t5 is not on agy/t5 '
    + '(detached HEAD or another branch), so removing it could lose commits. Check it by hand.' });
  assert.deepEqual(planFinish({ ...merged, registered: false, onBranch: false, dirEmpty: false }, names),
    { ok: false, reason: '.worktrees/agy-t5 is not a registered git worktree and is not empty. Check it and remove it by hand.' });
});
