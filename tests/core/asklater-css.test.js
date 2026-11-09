// app/app.css rules the Ask later list and the Ask AI tab's dot rely on (no browser in `npm test`: the stylesheet
// is read as text).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../app/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The declarations of the top-level rule with exactly this selector.
 * @param {string} selector
 * @returns {Record<string, string>}
 */
function rule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `app.css has no rule for "${selector}"`);
  return Object.fromEntries(m[1].split(';').map(d => d.split(/:(.*)/s).map(s => s.trim())).filter(([k]) => k));
}

test('Ask later: the Copy and Delete buttons do not shrink (overflow-wrap: anywhere broke "Copy" in two)', () => {
  assert.equal(rule('.later-item .row').flex, 'none');
  assert.equal(rule('.later-item .row')['flex-wrap'], 'nowrap');
  assert.equal(rule('.later-item > div:first-child')['min-width'], '0', 'the label column shrinks and wraps instead');
});

test('the Ask AI tab\'s dot: a --warm fill placed on the icon, ringed in the tab bar\'s colour', () => {
  assert.equal(rule('.tabbar a .ico').position, 'relative');
  const dot = rule('.tabbar a.has-dot .ico::after');
  assert.equal(dot.position, 'absolute');
  assert.equal(dot.background, 'var(--warm)');
  assert.match(dot['box-shadow'], /var\(--surface\)/);
  assert.equal(dot['border-radius'], '50%');
});
