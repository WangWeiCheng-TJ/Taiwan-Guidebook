// Contract for adding researched attractions. Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const NEW = ['duiyue-gate', 'tainan-coral-stone-house'];
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(gov\.tw|wikipedia\.org|twtainan\.net)\//;
const example = JSON.parse(readFileSync(new URL('../../data/attractions/chihkan-tower.json', import.meta.url), 'utf8'));
const REQUIRED = ['id', 'name', 'location', 'category', 'eras', 'summary', 'historical_narrative', 'timeline',
  'cultural_significance', 'foreign_visitor_guide', 'tags', 'metadata'];

for (const id of NEW) {
  const file = new URL(`../../data/attractions/${id}.json`, import.meta.url);

  test(`${id}: exists, same shape as chihkan-tower.json`, () => {
    assert.ok(existsSync(file), `data/attractions/${id}.json missing`);
    const p = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(p.id, id);
    for (const k of REQUIRED) assert.ok(k in p, `missing ${k}`);
    for (const k of Object.keys(example.location)) assert.ok(k in p.location, `location.${k} missing`);
    for (const k of ['zh_TW', 'en']) {
      for (const f of ['name', 'summary', 'historical_narrative']) assert.ok(p[f][k]?.length > 0, `${f}.${k} empty`);
    }
    assert.equal(p.location.city_en, 'Tainan City');
    const { lat, lng } = p.location.coordinates;
    assert.ok(lat > 22.85 && lat < 23.25 && lng > 120.05 && lng < 120.45, `coordinates ${lat},${lng} not in Tainan`);
    assert.ok(Array.isArray(p.timeline) && p.timeline.length >= 2);
  });

  test(`${id}: must-see items have reasons`, () => {
    const g = JSON.parse(readFileSync(file, 'utf8')).foreign_visitor_guide;
    assert.ok(g.must_see_spots_en?.length >= 2 && g.must_see_spots_en.length === g.must_see_spots_zh.length);
    assert.equal(g.must_see.length, g.must_see_spots_en.length);
    g.must_see.forEach((m, i) => {
      assert.equal(m.name.en, g.must_see_spots_en[i]);
      assert.ok(m.why.en.length >= 30 && m.why.zh_TW.length >= 10);
    });
  });

  test(`${id}: lists the sources actually read, all on allowed sites`, () => {
    const m = JSON.parse(readFileSync(file, 'utf8')).metadata;
    assert.ok(Array.isArray(m.sources) && m.sources.length >= 2, 'metadata.sources needs at least 2 URLs');
    for (const u of m.sources) assert.match(u, ALLOWED, `source not on an allowed site: ${u}`);
    assert.equal(m.generated_by, 'agy (web research), pending owner review');
  });
}
