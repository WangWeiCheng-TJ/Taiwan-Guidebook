// Place page additions: the photo with its credit, the collapsed OpenStreetMap, and "Learn more" topics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../app/js/state.js';
import { renderPlace } from '../../app/js/views/place.js';
import { guidebook, chihkan as bundled } from '../fixtures.js';

// Independent of the data: the bundled place without a photo, the bundle without topics.
const { photo: _photo, ...chihkan } = bundled;
const { topics: _topics, ...base } = guidebook;

const photo = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Chihkan.jpg/800px-Chihkan.jpg',
  page: 'https://commons.wikimedia.org/wiki/File:Chihkan.jpg',
  author: 'A <b>Photographer</b>',
  license: 'CC BY-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
};
const topic = (id, places, tags) => ({
  id, places, tags,
  title: { en: `Title ${id}`, zh_TW: `標題${id}` },
  summary: { en: `Summary ${id}.`, zh_TW: `摘要${id}。` },
  body: { en: ['Body.'], zh_TW: ['內文。'] },
  metadata: { sources: [], generated_by: 'agent; pending owner review', last_updated: '2026-10-13' },
});

/**
 * Render a place page with this version of the place and these topics in the guidebook.
 * @param {object} place
 * @param {{ topics?: object[], lang?: 'en'|'zh_TW' }} [opts]
 */
function render(place, { topics, lang = 'en' } = {}) {
  state.data = { ...base, places: guidebook.places.map(p => (p.id === place.id ? place : p)), ...(topics ? { topics } : {}) };
  return renderPlace({ ...state, lang }, place.id);
}

test('photo: after the badges, before the summary, with its credit line', () => {
  const html = render({ ...chihkan, photo });
  const fig = html.indexOf('<figure class="photo">');
  assert.ok(fig > html.lastIndexOf('class="badge'), 'after the badges');
  assert.ok(fig < html.indexOf(chihkan.summary.en.slice(0, 30)), 'before the summary');
  assert.match(html, /<img class="photo" src="https:\/\/upload\.wikimedia\.org\/[^"]+" loading="lazy" alt="Chihkan Tower[^"]*">/);
  assert.ok(html.includes('Photo: A &lt;b&gt;Photographer&lt;/b&gt;, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>'));
  assert.ok(html.includes('· <a href="https://commons.wikimedia.org/wiki/File:Chihkan.jpg" target="_blank" rel="noopener">Wikimedia Commons</a>'));
  assert.ok(render({ ...chihkan, photo }, { lang: 'zh_TW' }).includes(`alt="${chihkan.name.zh_TW}"`));
  assert.ok(render({ ...chihkan, photo }, { lang: 'zh_TW' }).includes('照片：A &lt;b&gt;'));
});

test('photo: none without a photo, without a credit, or with a non-https source', () => {
  assert.ok(!render(chihkan).includes('<figure'));
  assert.ok(!render({ ...chihkan, photo: { ...photo, author: '' } }).includes('<figure'));
  assert.ok(!render({ ...chihkan, photo: { ...photo, license: undefined } }).includes('<figure'));
  assert.ok(!render({ ...chihkan, photo: { ...photo, src: 'javascript:alert(1)' } }).includes('<figure'));
  const noLinks = render({ ...chihkan, photo: { ...photo, page: 'x', license_url: 'http://x' } });
  assert.ok(noLinks.includes('<figure class="photo">') && noLinks.includes(', CC BY-SA 4.0</figcaption>'));
  assert.ok(!noLinks.includes('Wikimedia Commons'));
});

test('map: collapsed, lazy OpenStreetMap iframe and a link to the full map', () => {
  const html = render(chihkan);
  const { lat, lng } = chihkan.location.coordinates;
  assert.match(html, /<details class="map">\s*<summary>Map<\/summary>/);
  assert.ok(html.includes(`<iframe loading="lazy" title="Map of Chihkan Tower`));
  assert.ok(html.includes(`&amp;layer=mapnik&amp;marker=${lat},${lng}"></iframe>`), 'src is escaped');
  assert.ok(html.includes(`<a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lng}#map=17/${lat}/${lng}" target="_blank" rel="noopener">Open in OpenStreetMap</a>`));
  assert.ok(html.indexOf('<details class="map">') > html.indexOf(`<h2>Getting there</h2>`));
  assert.match(render(chihkan, { lang: 'zh_TW' }), /<summary>地圖<\/summary>/);
});

test('Learn more: the place\'s topics as links, last on the page; nothing without topics', () => {
  const topics = [topic('zz-listed', [chihkan.id], []), topic('aa-tagged', [], [chihkan.tags[0]]), topic('other', ['duiyue-gate'], ['nope'])];
  const html = render(chihkan, { topics });
  const h2 = html.indexOf('<h2>Learn more</h2>');
  assert.ok(h2 > html.indexOf('<summary>The story</summary>'));
  const links = [...html.slice(h2).matchAll(/href="#\/learn\/([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, ['zz-listed', 'aa-tagged']);
  assert.ok(html.includes('Title zz-listed') && html.includes('Summary aa-tagged.'));
  assert.ok(render(chihkan, { topics, lang: 'zh_TW' }).includes('<h2>延伸閱讀</h2>'));
  assert.ok(!render(chihkan, { topics: [topic('other', ['x'], ['y'])] }).includes('Learn more'));
  assert.ok(!render(chihkan).includes('Learn more'), 'a bundle without topics');
});
