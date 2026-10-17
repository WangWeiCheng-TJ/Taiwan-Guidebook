// Tips tab: general tips first, then one section per city that has its own tips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTips } from '../../app/js/views/reference.js';

const tip = (id, scope, title) => ({
  id, scope, category: 'transport',
  title_en: title, title_zh: title, body_en: 'B', body_zh: 'B',
});
const place = (city_en, city_zh) => ({ location: { city_en, city_zh } });
const state = (lang, data) => ({ lang, data: { places: [], tips: [], apps: [], topics: [], ...data } });

test('city-scoped tips appear under their city, after the general tips', () => {
  const tips = [
    tip('g', 'global', 'GENERAL'),
    tip('t', ['Taipei City', 'New Taipei City'], 'MRT FIRST'),
  ];
  const places = [place('Taipei City', '臺北市'), place('New Taipei City', '新北市')];
  const html = renderTips(state('en', { tips, places }));
  const general = html.indexOf('GENERAL');
  const cityHeading = html.indexOf('<h1>Taipei City</h1>');
  assert.ok(general >= 0 && cityHeading > general, 'general tip comes before the city section');
  assert.match(html, /<h1>New Taipei City<\/h1>/);
  assert.equal(html.split('MRT FIRST').length - 1, 2, 'shared tip shows under both cities');
});

test('city names follow the language: zh_TW uses city_zh', () => {
  const tips = [tip('t', ['Tainan City'], 'X')];
  const places = [place('Tainan City', '臺南市')];
  assert.match(renderTips(state('zh_TW', { tips, places })), /<h1>臺南市<\/h1>/);
});

test('a city tip is not shown on the general part when no global tip exists', () => {
  const tips = [tip('t', ['Taipei City'], 'ONLY')];
  const html = renderTips(state('en', { tips, places: [place('Taipei City', '臺北市')] }));
  assert.equal(html.split('ONLY').length - 1, 1);
});
