// Contract for backfilling foreign_visitor_guide.must_see. Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const dir = new URL('../../data/attractions/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
const load = f => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const atBase = f => JSON.parse(execFileSync('git', ['show', `HEAD:data/attractions/${f}`], { encoding: 'utf8' }));
const withoutMustSee = p => { const c = structuredClone(p); delete c.foreign_visitor_guide.must_see; return c; };

for (const f of files) {
  test(`${f}: must_see matches must_see_spots and has reasons in both languages`, () => {
    const g = load(f).foreign_visitor_guide;
    assert.ok(Array.isArray(g.must_see), 'must_see missing');
    assert.equal(g.must_see.length, g.must_see_spots_en.length);
    g.must_see.forEach((m, i) => {
      assert.equal(m.name.en, g.must_see_spots_en[i], `item ${i + 1} name.en`);
      assert.equal(m.name.zh_TW, g.must_see_spots_zh[i], `item ${i + 1} name.zh_TW`);
      assert.ok(typeof m.why?.en === 'string' && m.why.en.length >= 40 && m.why.en.length <= 320, `item ${i + 1} why.en length ${m.why?.en?.length}`);
      assert.ok(typeof m.why?.zh_TW === 'string' && m.why.zh_TW.length >= 15 && m.why.zh_TW.length <= 160, `item ${i + 1} why.zh_TW length ${m.why?.zh_TW?.length}`);
      assert.match(m.why.zh_TW, /\p{Script=Han}/u, `item ${i + 1} why.zh_TW is not Chinese`);
    });
  });

  test(`${f}: nothing else changed`, () => {
    const base = atBase(f);
    if (f === 'chihkan-tower.json') return assert.deepEqual(load(f), base, 'chihkan-tower.json must stay as it is');
    assert.deepEqual(withoutMustSee(load(f)), withoutMustSee(base));
  });
}
