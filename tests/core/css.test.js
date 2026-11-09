// app/app.css has no browser in `npm test`, so these tests read the stylesheet itself and check what the
// audit fixes rely on: stacking order, contrast of the colour tokens in both colour schemes, tap-target
// sizes, wrapping, and that no rule targets a class nothing emits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
  for (const el of ['span.badge.warm', 'div.food-kind.local', 'div.dish', 'span.starline', 'div.starline', '.zp.tone b', '.zp.tone i']) {
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
  const panel = rule('.big-panel');
  assert.equal(hex(panel.background, 'light'), '#ffffff');
  assert.ok(contrast(hex(panel.color, 'light'), '#ffffff') >= 15, 'text is near black');
  assert.equal(panel['color-scheme'], 'light');
  // the dark scheme must not recolour the card (it is shown to someone else, often outdoors)
  for (const sel of ['.big-panel', '.bigcard .big', '.bigcard .mid', '.bigcard .hint']) {
    assert.equal(RULES.find(x => x.selector === sel && x.media === DARK), undefined, `${sel} has a dark-scheme override`);
  }
  assert.ok(contrast(hex(rule('.bigcard .hint').color, 'light'), hex(panel.background, 'light')) >= 4.5);
});

// ---------- Tap targets (audit css #6) ----------

test('tap targets: small buttons, the party stepper and stars are 44px; chips and the map row 40px', () => {
  assert.ok(px(resolve('button.btn.small', 'min-height')) >= 44, 'language toggle, sheet close, Play/Show, delete, Change/Update');
  assert.ok(px(resolve('button.btn.small', 'min-width')) >= 44, 'glyph-only buttons (the close and delete crosses) are 44px wide too');
  assert.ok(px(resolve('.btn', 'min-height')) >= 44, 'plain buttons');
  assert.ok(px(resolve('.big-bar .btn', 'min-height')) >= 44, 'show card Close / Turn / Read aloud');
  assert.ok(px(resolve('.party button.btn.small', 'min-width')) >= 44, 'party - and +');
  assert.ok(px(resolve('.party button.btn.small', 'min-height')) >= 44);
  assert.ok(px(resolve('.stars button', 'min-width')) >= 44, 'rating stars');
  assert.ok(px(resolve('.stars button', 'min-height')) >= 44);
  assert.equal(px(resolve('div.stars', 'gap')), 0, 'stars touch, so their targets do not overlap');
  assert.ok(px(resolve('button.chip', 'min-height')) >= 40);
  assert.ok(px(resolve('details.map summary', 'min-height')) >= 40);
});

test('tap targets: the speaker button stays small to look at but its invisible ring makes it 44px', () => {
  const btn = rule('.say-btn');
  const ring = rule('.say-btn::after');
  assert.equal(btn.position, 'relative', 'the ring is positioned against the button');
  assert.equal(ring.position, 'absolute');
  const outset = -px(ring.inset);
  assert.ok(outset > 0, 'inset is negative: the ring is bigger than the button');
  assert.ok(px(btn.width) + 2 * outset >= 44, 'width + ring');
  assert.ok(px(btn.height) + 2 * outset >= 44, 'height + ring');
});

test('tap targets: the top bar pads less now that the language toggle is 44px tall', () => {
  assert.match(rule('.topbar').padding, /calc\(6px \+ env\(safe-area-inset-top\)\) 16px 6px/);
});

// ---------- Wrapping (audit css #5) ----------

/** Like resolve(), for inherited properties: the nearest ancestor chain that sets it wins. "a b c" tries "a b c", "a b", "a". */
function resolveInherited(element, prop) {
  const parts = element.split(' ');
  for (let n = parts.length; n > 0; n--) {
    const v = resolve(parts.slice(0, n).join(' '), prop);
    if (v !== undefined) return v;
  }
  return undefined;
}

test('wrapping: free text in the page and in sheets wraps anywhere; a log entry text column can shrink', () => {
  for (const el of ['main.view div.card.entry div', 'main.view ol.stops li', 'main.view div.panel', 'div.sheet-body div.card']) {
    assert.equal(resolveInherited(el, 'overflow-wrap'), 'anywhere', el);
  }
  assert.equal(rule('.entry > div:first-child')['min-width'], '0');
});

// ---------- Collapsible cards (audit css #7) ----------

test('details: the summary is pulled over the card padding, so the whole card face toggles it', () => {
  const pad = rule('details').padding;
  assert.equal(pad, '10px 14px');
  assert.equal(rule('details.must').padding, pad, 'the .must card must keep the same padding the summary margins undo');
  const summary = rule('details:not(.map) > summary');
  assert.equal(summary.margin, '-10px -14px', 'the negative of the card padding');
  assert.equal(summary.padding, pad);
  // open: no bottom padding, so the body starts right under the title as before
  const open = rule('details[open]:not(.map) > summary');
  assert.equal(open['margin-bottom'], '0');
  assert.equal(open['padding-bottom'], '0');
});

// ---------- Toast (audit css #8) ----------

test('toast: bounded by left and right, centred by auto margins (left: 50% would shrink it to half the width)', () => {
  const t = rule('.toast');
  assert.equal(t.left, '16px');
  assert.equal(t.right, '16px');
  assert.equal(t['margin-inline'], 'auto');
  assert.equal(t.width, 'fit-content');
  assert.equal(t.transform, undefined);
});

// ---------- Dead and ineffective selectors (audit css #9) ----------

/** Text of every file under app/ that can emit markup: index.html and app/js/**, scripts only. */
function emitterSource() {
  const out = [readFileSync(join(appDir, 'index.html'), 'utf8')];
  const walk = dir => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.js')) out.push(readFileSync(p, 'utf8'));
    }
  };
  walk(join(appDir, 'js'));
  return out.join('\n');
}

test('no rule targets a class that no view, script or page emits', () => {
  const source = emitterSource();
  const classes = new Set();
  for (const r of RULES) for (const m of r.selector.matchAll(/\.([a-z_][\w-]*)/gi)) classes.add(m[1]);
  const dead = [...classes].filter(c => !new RegExp(`(^|[^\\w-])${c}($|[^\\w-])`).test(source));
  assert.deepEqual(dead, [], 'remove the rule, or emit the class');
});

test('no rule targets <output> (the party stepper uses <b class="party-n">)', () => {
  assert.ok(!RULES.some(r => /(^|[\s>+~])output\b/.test(r.selector)));
});

test('"More phrases" (button.linklike.small) is 14px and 44px tall: `font: inherit` must not outrank .small', () => {
  assert.ok(px(resolve('button.linklike.small', 'min-height')) >= 44);
  assert.equal(resolve('button.linklike.small', 'font-size'), '14px');
  // a link-style button without .small still follows the surrounding text
  assert.equal(resolve('button.linklike', 'font-size'), 'inherit');
});

// ---------- Bottom sheet in dark mode (audit css #10) ----------

/** The rule for this selector inside the dark-scheme @media block. */
function darkRule(selector) {
  const r = RULES.find(x => x.selector === selector && x.media === DARK);
  assert.ok(r, `no dark-scheme rule for "${selector}"`);
  return r.decls;
}

test('sheet: in dark mode the panel gets a visible outline and the page behind is dimmed more', () => {
  // --bg is the page colour too, so only an outline (and a stronger dimming) tells the panel from the page
  assert.match(darkRule('.sheet-panel')['box-shadow'], /0 0 0 1px var\(--line-strong\)/);
  const alpha = value => Number(value.match(/rgba\(0,\s*0,\s*0,\s*([\d.]+)\)/)[1]);
  assert.ok(alpha(darkRule('.sheet-backdrop').background) > alpha(rule('.sheet-backdrop').background));
});

// ---------- Show card in landscape (audit css #11) ----------

test('show card: type sizes are capped by the viewport height too, so a phone on its side needs less scrolling', () => {
  assert.match(rule('.bigcard .big')['font-size'], /^clamp\(\s*36px,\s*min\(\s*11vw,\s*\d+vh\s*\),\s*72px\s*\)$/);
  assert.match(rule('.bigcard .mid')['font-size'], /^clamp\(\s*22px,\s*min\(\s*6vw,\s*\d+vh\s*\),\s*36px\s*\)$/);
  assert.equal(rule('.big-panel').overflow, 'auto', 'what still does not fit scrolls inside the panel');
});
