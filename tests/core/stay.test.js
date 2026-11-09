// app/js/stay.js: My stay, the traveler's hotel for the "Take me back" card. The hotels here are made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAY_KEY, emptyStay, normalizeStay, validateStay, readStays, telHref, staySay, cityFromAddress, stayCity,
  stayForCity, stayNear, stayHere, putStay, removeStay,
} from '../../app/js/stay.js';
import { trMsg } from '../../app/js/lang.js';
import { cityCenter } from '../../app/js/data.js';
import { places, tainanStation } from '../fixtures.js';

const tainan = { id: 'a', name: '範例旅店', address: '臺南市中西區範例路1號', phone: '06-221-0000', city: '' };
const taipei = { id: 'b', name: '測試飯店', address: '100台北市中正區測試路2號', phone: '', city: '' };
const newTaipei = { id: 'c', name: '樣本民宿', address: '新北市淡水區樣本街3號', phone: '', city: '' };
const nowhere = { id: 'd', name: '某某旅館', address: '花蓮縣花蓮市某路4號', phone: '', city: '' };
/** Taipei Main Station */
const taipeiGps = { lat: 25.0478, lng: 121.517, source: 'gps', label: 'your location' };
const pick = city => ({ ...cityCenter(places, city), source: 'pick', label: city, city });

test('the storage key and an empty form', () => {
  assert.equal(STAY_KEY, 'tg.stay.v1');
  assert.deepEqual(emptyStay(), { id: '', name: '', address: '', phone: '', city: '' });
  assert.notEqual(emptyStay(), emptyStay(), 'a fresh object each time');
});

test('normalizeStay tidies pasted text and fills missing fields; non-objects are null', () => {
  assert.deepEqual(normalizeStay({ id: ' x1 ', name: '  範例旅店\n', address: '臺南市中西區\n  範例路1號 ', phone: '\t06-221-0000', city: ' Tainan City ' }),
    { id: 'x1', name: '範例旅店', address: '臺南市中西區 範例路1號', phone: '06-221-0000', city: 'Tainan City' });
  assert.deepEqual(normalizeStay({ name: 'Hotel' }), { id: '', name: 'Hotel', address: '', phone: '', city: '' });
  assert.deepEqual(normalizeStay({ id: 7, name: 1, address: ['x'], phone: null, city: {} }), emptyStay());
  for (const bad of [null, undefined, 'stay', 3, ['a']]) assert.equal(normalizeStay(bad), null, String(bad));
  const long = normalizeStay({ name: '館'.repeat(500), address: '路'.repeat(500), phone: '1'.repeat(500) });
  assert.deepEqual([long.name.length, long.address.length, long.phone.length], [120, 200, 40]);
});

test('validateStay: a name, a Chinese address, and a phone that dials when given', () => {
  assert.equal(validateStay(tainan), null);
  assert.equal(validateStay({ ...tainan, phone: '' }), null, 'the phone is optional');
  assert.equal(validateStay({ ...tainan, name: 'Hotel Example Tainan' }), null, 'a Latin name is allowed');
  assert.equal(validateStay({ ...tainan, name: '' }), "Paste the hotel's name.");
  assert.equal(validateStay({ ...tainan, address: '' }), "Paste the hotel's address in Chinese.");
  assert.equal(validateStay({ ...tainan, address: 'No. 1, Example Rd, Tainan' }),
    'The address has no Chinese in it. Paste the Chinese one: that is what a driver reads.');
  assert.equal(validateStay({ ...tainan, phone: 'ask at desk' }), 'Check the phone number, or leave it empty.');
  assert.equal(validateStay({ ...tainan, phone: '123' }), 'Check the phone number, or leave it empty.');
});

test('every validateStay message has a Chinese translation', () => {
  const msgs = [{ name: '' }, { address: '' }, { address: 'Example Rd' }, { phone: 'x' }].map(o => validateStay({ ...tainan, ...o }));
  for (const m of msgs) {
    assert.ok(m, 'a message');
    assert.notEqual(trMsg('zh_TW', m), m, m);
    assert.equal(trMsg('en', m), m);
  }
});

test('readStays keeps valid stored stays only, each id once', () => {
  assert.deepEqual(readStays([tainan, taipei]), [tainan, taipei]);
  assert.deepEqual(readStays([
    tainan,
    { ...taipei, id: '' },              // no id
    { ...taipei, id: 'a' },             // id taken
    { ...taipei, id: 'e', address: 'Example Rd' }, // not Chinese
    'junk', null,
    { ...newTaipei, name: '  樣本民宿 ' }, // tidied, kept
  ]), [tainan, newTaipei]);
  for (const bad of [null, undefined, {}, 'x', 3]) assert.deepEqual(readStays(bad), [], String(bad));
});

test('telHref: digits only, a leading + kept, full-width and extensions handled', () => {
  assert.equal(telHref('06-221-0000'), 'tel:062210000');
  assert.equal(telHref('(02) 2311-1234'), 'tel:0223111234');
  assert.equal(telHref('+886 (0)6 221 0000'), 'tel:+88662210000');
  assert.equal(telHref('+886-6-221-0000'), 'tel:+88662210000');
  assert.equal(telHref('０６－２２１－００００'), 'tel:062210000');
  assert.equal(telHref('＋８８６ ６ ２２１ ００００'), 'tel:+88662210000');
  assert.equal(telHref('06-221-0000 #12'), 'tel:062210000');
  assert.equal(telHref('06-221-0000 ext. 12'), 'tel:062210000');
  assert.equal(telHref('06-221-0000 分機 12'), 'tel:062210000');
  assert.equal(telHref('06-221-0000轉12'), 'tel:062210000');
  for (const bad of ['', '123', 'call us', '1'.repeat(16), null, undefined]) assert.equal(telHref(bad), '', String(bad));
});

test('staySay reads the name, then the address', () => {
  assert.equal(staySay(tainan), '範例旅店，臺南市中西區範例路1號');
  assert.equal(staySay({ ...tainan, address: '' }), '範例旅店');
});

test('cityFromAddress: the guidebook city named earliest in the address, 台 and 臺 alike', () => {
  assert.equal(cityFromAddress(tainan.address, places), 'Tainan City');
  assert.equal(cityFromAddress(taipei.address, places), 'Taipei City', '台北市 with a postcode in front');
  assert.equal(cityFromAddress(newTaipei.address, places), 'New Taipei City', 'not Taipei City');
  assert.equal(cityFromAddress('新北市板橋區臺北路5號', places), 'New Taipei City', 'a road named after Taipei');
  assert.equal(cityFromAddress('彰化縣鹿港鎮某路6號', places), 'Changhua County');
  assert.equal(cityFromAddress(nowhere.address, places), '');
  assert.equal(cityFromAddress('', places), '');
  assert.equal(cityFromAddress(tainan.address, []), '', 'no guidebook loaded');
});

test('stayCity: the picked city wins over the address', () => {
  assert.equal(stayCity(tainan, places), 'Tainan City');
  assert.equal(stayCity({ ...tainan, city: 'Taipei City' }, places), 'Taipei City');
  assert.equal(stayCity(nowhere, places), '');
});

test('stayForCity: a picked city first, then the address; the last saved wins', () => {
  assert.equal(stayForCity([tainan, taipei], 'Taipei City', places), taipei);
  assert.equal(stayForCity([tainan, taipei], 'Changhua County', places), null);
  assert.equal(stayForCity([tainan, taipei], '', places), null);
  const second = { ...tainan, id: 'a2', name: '第二家' };
  assert.equal(stayForCity([tainan, second], 'Tainan City', places), second);
  const pickedThere = { ...nowhere, city: 'Tainan City' };
  assert.equal(stayForCity([pickedThere, tainan], 'Tainan City', places), pickedThere, 'picked beats the address');
  const pickedElsewhere = { ...tainan, city: 'Taipei City' };
  assert.equal(stayForCity([pickedElsewhere], 'Tainan City', places), null, 'its address no longer counts');
});

test('stayNear: by the nearest guidebook place in each stay\'s city', () => {
  assert.equal(stayNear([tainan, taipei], tainanStation, places), tainan);
  assert.equal(stayNear([tainan, taipei], taipeiGps, places), taipei);
  assert.equal(stayNear([tainan, taipei, newTaipei], taipeiGps, places), taipei);
  assert.equal(stayNear([nowhere], tainanStation, places), null, 'no known city');
  assert.equal(stayNear([{ ...nowhere, city: 'Hualien' }], tainanStation, places), null, 'a city with no guidebook places');
  assert.equal(stayNear([], tainanStation, places), null);
  const second = { ...tainan, id: 'a2' };
  assert.equal(stayNear([tainan, second], tainanStation, places), second, 'a tie: the later saved');
});

test('stayHere: one stay always; several by the picked city or the nearest; none without a position', () => {
  assert.equal(stayHere([], tainanStation, places), null);
  assert.equal(stayHere([tainan], null, places), tainan);
  assert.equal(stayHere([tainan], taipeiGps, places), tainan, 'the only hotel, even far away');
  assert.equal(stayHere([nowhere], null, places), nowhere);
  assert.equal(stayHere([tainan, taipei], null, places), null);
  assert.equal(stayHere([tainan, taipei], tainanStation, places), tainan);
  assert.equal(stayHere([tainan, taipei], taipeiGps, places), taipei);
  assert.equal(stayHere([taipei, tainan], pick('Taipei City'), places), taipei);
  assert.equal(stayHere([taipei, tainan], pick('Tainan City'), places), tainan);
  assert.equal(stayHere([taipei, newTaipei], pick('New Taipei City'), places), newTaipei, 'the city, not the nearest');
  // A day trip to New Taipei from a Taipei hotel: the picked city has none, so the nearest
  assert.equal(stayHere([tainan, taipei], pick('New Taipei City'), places), taipei);
  assert.equal(stayHere([nowhere, { ...nowhere, id: 'd2' }], tainanStation, places), null, 'no city known');
});

test('putStay: a new stay goes last, an edit stays in place, one stay per city', () => {
  const add = putStay([tainan], taipei, places);
  assert.deepEqual(add, { stays: [tainan, taipei], replaced: [] });

  const edited = { ...tainan, phone: '' };
  assert.deepEqual(putStay([tainan, taipei], edited, places), { stays: [edited, taipei], replaced: [] });

  const moved = { ...tainan, id: 'a2', name: '新的旅店', address: '臺南市東區新路7號' };
  assert.deepEqual(putStay([tainan, taipei], moved, places), { stays: [taipei, moved], replaced: [tainan] });

  const picked = { ...nowhere, id: 'd3', city: 'Taipei City' };
  assert.deepEqual(putStay([tainan, taipei], picked, places), { stays: [tainan, picked], replaced: [taipei] });

  // An edit that moves a stay to a city that has one
  const toTaipei = { ...tainan, city: 'Taipei City' };
  assert.deepEqual(putStay([tainan, taipei], toTaipei, places), { stays: [toTaipei], replaced: [taipei] });

  // No known city: replaces nothing
  const other = { ...nowhere, id: 'd4' };
  assert.deepEqual(putStay([nowhere], other, places), { stays: [nowhere, other], replaced: [] });

  const before = [tainan, taipei];
  putStay(before, moved, places);
  assert.deepEqual(before, [tainan, taipei], 'the input is not changed');
});

test('removeStay', () => {
  assert.deepEqual(removeStay([tainan, taipei], 'a'), [taipei]);
  assert.deepEqual(removeStay([tainan], 'zzz'), [tainan]);
});
