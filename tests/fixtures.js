// Shared test data: the real built guidebook plus a few hand-made entries.
import { readFileSync } from 'node:fs';

/** @type {import('../app/js/types.js').Guidebook} */
export const guidebook = JSON.parse(readFileSync(new URL('../app/data/guidebook.json', import.meta.url), 'utf8'));
export const places = guidebook.places;

export const chihkan = places.find(p => p.id === 'chihkan-tower');
export const dadaocheng = places.find(p => p.id === 'dadaocheng-dihua-street');

/** Tainan Station, roughly 1 km from Chihkan Tower */
export const tainanStation = { lat: 22.9971, lng: 120.2127, source: 'gps', label: 'your location' };

/** @type {import('../app/js/types.js').LogEntry[]} */
export const sampleLog = [
  { id: 'b', date: '2026-11-03', placeId: 'lukang-longshan-temple', name: '', stars: 2, note: 'boring for me' },
  { id: 'c', date: '2026-11-03', placeId: null, name: 'Curry shop', stars: null, note: 'too salty' },
  { id: 'a', date: '2026-11-02', placeId: 'jiufen-gold-mountain', name: '', stars: 5, note: 'loved the views' },
];
