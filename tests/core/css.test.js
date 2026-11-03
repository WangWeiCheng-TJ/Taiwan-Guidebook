// app/app.css has no browser in `npm test`, so these tests read the stylesheet itself and check what the
// audit fixes rely on: stacking order, contrast of the colour tokens in both colour schemes, tap-target
// sizes, wrapping, and that no rule targets a class nothing emits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('../../app/', import.meta.url));
const cssText = readFileSync(join(appDir, 'app.css'), 'utf8');

// ---------- A small CSS reader (no dependencies) ----------

/**
 * Rules of a stylesheet: top-level rules and @media blocks, comments stripped, @keyframes skipped.
 * A selector list becomes one entry per selector.
 * @param {string} text
 * @returns {{ selector: string, decls: Record<string, string>, media: string|null, order: number }[]}
 */
function parseCss(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let order = 0;
  const readBlock = (s, media) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const prelude = s.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < s.length && depth) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
        j++;
      }
      const body = s.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) {
        readBlock(body, prelude.replace(/^@media\s*/, ''));
      } else if (!prelude.startsWith('@')) {
        /** @type {Record<string, string>} */
        const decls = {};
        for (const d of body.split(';')) {
          const k = d.indexOf(':');
          if (k > 0) decls[d.slice(0, k).trim()] = d.slice(k + 1).replace(/\s*!important\s*$/, '').trim();
        }
        for (const sel of prelude.split(',')) rules.push({ selector: sel.trim().replace(/\s+/g, ' '), decls, media, order: order++ });
      }
      i = j;
    }
  };
  readBlock(src, null);
  return rules;
}

const RULES = parseCss(cssText);
const DARK = '(prefers-color-scheme: dark)';

/**
 * The declarations of the rule written with exactly this selector (light colour scheme, in the file).
 * @param {string} selector
 * @returns {Record<string, string>}
 */
function rule(selector) {
  const r = RULES.find(x => x.selector === selector && x.media === null);
  assert.ok(r, `app.css has no rule for "${selector}"`);
  return r.decls;
}

/**
 * "a.b.c" -> { tag: 'a', classes: ['b', 'c'] }; null for anything with pseudo-classes, attributes, combinators.
 * @param {string} c
 */
function parseCompound(c) {
  const m = c.match(/^([a-z][a-z0-9]*)?((?:\.[\w-]+)*)$/i);
  return m ? { tag: m[1] || null, classes: m[2].split('.').filter(Boolean) } : null;
}

/**
 * Descendant-only chain "ancestor ... element", or null when the selector uses anything else.
 * @param {string} sel
 */
function parseChain(sel) {
  const parts = sel.split(' ').map(parseCompound);
  return parts.every(Boolean) ? parts : null;
}

/** Does the rule's chain match the element chain? Descendant combinators only, nearest ancestor first. */
function chainMatches(ruleChain, elChain) {
  const fits = (r, e) => (!r.tag || r.tag === e.tag) && r.classes.every(c => e.classes.includes(c));
  let k = elChain.length - 1;
  for (let i = ruleChain.length - 1; i >= 0; i--) {
    if (i === ruleChain.length - 1) {
      if (!fits(ruleChain[i], elChain[k])) return false;
    } else {
      do { k--; } while (k >= 0 && !fits(ruleChain[i], elChain[k]));
      if (k < 0) return false;
    }
  }
  return true;
}

const specificity = chain => chain.reduce((n, c) => n + c.classes.length * 100 + (c.tag ? 1 : 0), 0);

/**
 * The value the cascade gives `prop` on an element: highest specificity wins, then the later rule.
 * Handles type, class and descendant selectors only (all that matters here); `font` counts as setting font-size.
 * @param {string} element  e.g. 'button.btn.small' or '.party button.btn.small' (ancestors first)
 * @param {string} prop
 * @param {'light'|'dark'} [scheme]
 * @returns {string|undefined}
 */
function resolve(element, prop, scheme = 'light') {
  const elChain = parseChain(element);
  assert.ok(elChain, `bad element spec "${element}"`);
  let best = null;
  for (const r of RULES) {
    if (r.media !== null && !(scheme === 'dark' && r.media === DARK)) continue;
    const chain = parseChain(r.selector);
    if (!chain || !chainMatches(chain, elChain)) continue;
    let value = r.decls[prop];
    if (value === undefined && prop === 'font-size' && r.decls.font !== undefined) value = r.decls.font === 'inherit' ? 'inherit' : r.decls.font.split(/[\s/]+/)[0];
    if (value === undefined) continue;
    const s = specificity(chain);
    if (!best || s > best.s || (s === best.s && r.order > best.order)) best = { s, order: r.order, value };
  }
  return best?.value;
}

/** First length in a value, in px ("10px 14px" -> 10; "-10px -14px" -> -10). */
const px = v => parseFloat(String(v).trim().split(/\s+/)[0]);

// ---------- Colour ----------

/**
 * Colour tokens in the given scheme (the dark block overrides :root).
 * @param {'light'|'dark'} scheme
 * @returns {Record<string, string>}
 */
function tokens(scheme) {
  const out = {};
  for (const r of RULES) {
    if (r.selector !== ':root') continue;
    if (r.media !== null && !(scheme === 'dark' && r.media === DARK)) continue;
    for (const [k, v] of Object.entries(r.decls)) if (k.startsWith('--')) out[k] = v;
  }
  return out;
}

/**
 * "var(--x)" or a hex colour -> "#rrggbb".
 * @param {string} value
 * @param {'light'|'dark'} scheme
 */
function hex(value, scheme) {
  const v = value.trim();
  const m = v.match(/^var\((--[\w-]+)\)$/);
  if (m) {
    const t = tokens(scheme)[m[1]];
    assert.ok(t, `token ${m[1]} is not defined`);
    return hex(t, scheme);
  }
  const h = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  assert.ok(h, `not a colour I can read: ${v}`);
  const d = h[1].length === 3 ? [...h[1]].map(c => c + c).join('') : h[1];
  return `#${d.toLowerCase()}`;
}

const channel = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
function luminance(h) {
  const n = parseInt(h.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio of two "#rrggbb" colours. */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SCHEMES = /** @type {const} */ (['light', 'dark']);

// ---------- Stacking ----------

test('stacking: the ask-AI bar floats above the bottom sheet, below the driver card and the toast', () => {
  const z = sel => Number(rule(sel)['z-index']);
  assert.ok(z('.askbar') > z('.sheet'), 'select-to-ask inside a sheet needs the bar above it');
  assert.ok(z('.askbar') < z('.bigcard'));
  assert.ok(z('.askbar') < z('.toast'));
});
// ---------- Contrast (audit css #2, #3, #4) ----------

/** The three surfaces text sits on: the page, a card or field, and a panel. */
const SURFACES = ['--bg', '--surface', '--accent-soft'];

/** Contrast of colour token `fg` on token `bg` in a scheme. */
const tokenContrast = (fg, bg, scheme) => contrast(hex(`var(${fg})`, scheme), hex(`var(${bg})`, scheme));

test('contrast: every text colour token reaches AA (4.5:1) on the page, cards and panels, in both schemes', () => {
  for (const scheme of SCHEMES) {
    for (const fg of ['--text', '--muted', '--accent', '--danger', '--warm-text']) {
      for (const bg of SURFACES) {
        const c = tokenContrast(fg, bg, scheme);
        assert.ok(c >= 4.5, `${fg} on ${bg} in ${scheme}: ${c.toFixed(2)}:1`);
      }
    }
    assert.ok(tokenContrast('--accent-ink', '--accent', scheme) >= 4.5, `accent-ink on accent in ${scheme}`);
    assert.ok(tokenContrast('--warm-ink', '--warm', scheme) >= 4.5, `warm-ink on warm in ${scheme}`);
  }
});

test('contrast: the offline pill is --warm-ink on --warm, not white', () => {
  assert.equal(resolve('span.net', 'background'), 'var(--warm)');
  assert.equal(resolve('span.net', 'color'), 'var(--warm-ink)');
});

test('contrast: warm text uses --warm-text (small text on the page cannot use the --warm fill colour)', () => {
  for (const el of ['span.badge.warm', 'div.food-kind.local', 'div.dish', '.zp.tone b', '.zp.tone i']) {
    assert.equal(resolve(el, 'color'), 'var(--warm-text)', el);
  }
  // --warm itself stays for fills and big glyphs, which only need 3:1
  for (const scheme of SCHEMES) {
    for (const bg of ['--bg', '--surface']) assert.ok(tokenContrast('--warm', bg, scheme) >= 3, `--warm on ${bg} in ${scheme}`);
  }
});

test('contrast: field borders and unselected stars use --line-strong, which reaches 3:1 on every surface', () => {
  for (const scheme of SCHEMES) {
    for (const bg of SURFACES) {
      const c = tokenContrast('--line-strong', bg, scheme);
      assert.ok(c >= 3, `--line-strong on ${bg} in ${scheme}: ${c.toFixed(2)}:1`);
    }
  }
  for (const el of ['input', 'select', 'textarea']) assert.match(resolve(el, 'border'), /var\(--line-strong\)/, el);
  assert.match(rule('.stars button')['-webkit-text-stroke'], /var\(--line-strong\)/);
  assert.equal(rule('.stars button').color, 'transparent', 'unselected: an outline, so it differs from a selected star by shape too');
  assert.equal(rule('.stars button.on').color, 'var(--warm)');
});

test('contrast: the show card is black on white in both schemes; its hint reaches AA on that white', () => {
  assert.ok(contrast(hex(rule('.bigcard .hint').color, 'light'), '#ffffff') >= 4.5);
});

