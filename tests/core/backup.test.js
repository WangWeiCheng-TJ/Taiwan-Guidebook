// The backup (app/js/backup.js, exportPayload version 2 in triplog.js): the file holds the notes, the plan and the
// party size, never My stay; old files (version 1, a bare array) still import; the "Last backup" line on My trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BACKUP_KEY, backupFileName, backupMark, readMark, bumpMark, backupAge, backupLine, backupExtras, planChoice }
  from '../../app/js/backup.js';
import { EXPORT_TYPE, EXPORT_VERSION, exportPayload, mergeImport, emptyDraft } from '../../app/js/triplog.js';
import { parseTrip } from '../../app/js/trip.js';
import { tr } from '../../app/js/lang.js';
import { state } from '../../app/js/state.js';
import { renderLog } from '../../app/js/views/log.js';
import { guidebook, sampleLog } from '../fixtures.js';

const plan = parseTrip(JSON.parse(readFileSync(new URL('../../docs/sample-trip.json', import.meta.url), 'utf8'))).trip;
const otherPlan = { title: 'Other plan', days: [{ date: '2026-12-01', items: [{ name: 'Night market' }] }] };
// Local times, so the calendar-day tests hold in any time zone
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m);
const mark = (date, since = 0) => ({ at: date.toISOString(), since });

test('the backup key and file name', () => {
  assert.equal(BACKUP_KEY, 'tg.backup.v1');
  assert.equal(backupFileName('2026-11-10'), 'taiwan-trip-log-2026-11-10.json');
});

test('exportPayload version 2: notes, plan and party size; null when there is none', () => {
  const now = new Date('2026-11-10T03:00:00Z');
  const full = exportPayload(sampleLog, now, { trip: plan, party: 3 });
  assert.equal(EXPORT_VERSION, 2);
  assert.deepEqual(Object.keys(full), ['type', 'version', 'exported_at', 'entries', 'trip', 'party']);
  assert.deepEqual(full, { type: EXPORT_TYPE, version: 2, exported_at: '2026-11-10T03:00:00.000Z', entries: sampleLog, trip: plan, party: 3 });
  assert.deepEqual(exportPayload([], now), { type: EXPORT_TYPE, version: 2, exported_at: '2026-11-10T03:00:00.000Z', entries: [], trip: null, party: null });
});

test('a version 2 file round-trips on another phone: notes, plan, party', () => {
  const file = JSON.parse(JSON.stringify(exportPayload(sampleLog, new Date(), { trip: plan, party: 4 })));
  assert.deepEqual(mergeImport([], file), { log: sampleLog, added: sampleLog.length });
  assert.deepEqual(backupExtras(file), { trip: plan, party: 4, badTrip: false });
});

test('version 1 files and bare arrays still import, with no plan and no party', () => {
  const v1 = { type: EXPORT_TYPE, exported_at: '2026-11-04T00:00:00.000Z', entries: sampleLog };
  assert.equal(mergeImport([], v1).added, sampleLog.length);
  assert.deepEqual(backupExtras(v1), { trip: null, party: null, badTrip: false });
  assert.equal(mergeImport([], [...sampleLog]).added, sampleLog.length);
  assert.deepEqual(backupExtras([...sampleLog]), { trip: null, party: null, badTrip: false });
  for (const junk of [null, 'text', 42]) assert.deepEqual(backupExtras(junk), { trip: null, party: null, badTrip: false });
});

test('backupExtras: the plan is re-validated, a damaged one is left out and reported', () => {
  const messy = { title: '  Two days ', days: [{ date: '2026-11-05', items: [{ name: 'B', time: '9:30' }] }, { date: '2026-11-04', items: [] }] };
  const { trip } = backupExtras({ entries: [], trip: messy });
  assert.deepEqual(trip, parseTrip(messy).trip);
  assert.equal(trip.title, 'Two days');
  assert.deepEqual(trip.days.map(d => d.date), ['2026-11-04', '2026-11-05']);
  assert.deepEqual(backupExtras({ entries: [], trip: { title: 'No days', days: [] } }), { trip: null, party: null, badTrip: true });
  assert.deepEqual(backupExtras({ entries: [], trip: 'Tainan' }), { trip: null, party: null, badTrip: true });
  assert.equal(backupExtras({ entries: [], trip: null }).badTrip, false, 'null: the phone had no plan');
});

test('backupExtras: a party that is not a number is left out, one out of range is clamped', () => {
  const party = p => backupExtras({ entries: [], party: p }).party;
  assert.equal(party(3), 3);
  assert.equal(party(0), 1);
  assert.equal(party(25), 10);
  assert.equal(party(2.6), 3);
  for (const bad of [null, undefined, '3', NaN, Infinity]) assert.equal(party(bad), null, String(bad));
});

test('planChoice: load when the phone has none, ask before replacing a different one, skip the same one', () => {
  assert.equal(planChoice(null, null), 'none');
  assert.equal(planChoice(plan, null), 'none');
  assert.equal(planChoice(null, plan), 'load');
  assert.equal(planChoice(plan, otherPlan), 'ask');
  assert.equal(planChoice(plan, JSON.parse(JSON.stringify(plan))), 'same');
  assert.equal(planChoice(plan, backupExtras({ entries: [], trip: plan }).trip), 'same');
});

test('the mark: made at a backup, re-validated from storage, counting notes since', () => {
  const now = new Date('2026-11-10T03:00:00Z');
  assert.deepEqual(backupMark(now), { at: '2026-11-10T03:00:00.000Z', since: 0 });
  assert.deepEqual(readMark({ at: '2026-11-10T03:00:00.000Z', since: 5 }), { at: '2026-11-10T03:00:00.000Z', since: 5 });
  assert.deepEqual(readMark({ at: '2026-11-10T03:00:00.000Z', since: -2 }), { at: '2026-11-10T03:00:00.000Z', since: 0 });
  assert.deepEqual(readMark({ at: '2026-11-10T03:00:00.000Z', since: 2.7 }), { at: '2026-11-10T03:00:00.000Z', since: 2 });
  assert.deepEqual(readMark({ at: '2026-11-10T03:00:00.000Z' }), { at: '2026-11-10T03:00:00.000Z', since: 0 });
  for (const bad of [null, [], 'x', { since: 3 }, { at: 'yesterday', since: 1 }, { at: 12345 }]) assert.equal(readMark(bad), null, JSON.stringify(bad));

  const m = backupMark(now);
  assert.deepEqual(bumpMark(m, 1), { ...m, since: 1 });
  assert.deepEqual(bumpMark(bumpMark(m, 1), 3), { ...m, since: 4 });
  assert.equal(bumpMark(m, 0), m, 'nothing added: the same mark');
  assert.equal(bumpMark(m, -1), m);
  assert.equal(bumpMark(null, 2), null, 'never backed up: the line counts every note');
});

test('backupAge counts local calendar days, not 24-hour periods', () => {
  assert.equal(backupAge(mark(at(10, 0, 5)), at(10, 23, 55)), 0);
  assert.equal(backupAge(mark(at(9, 23, 50)), at(10, 0, 10)), 1, 'just after midnight: yesterday');
  assert.equal(backupAge(mark(at(7, 8)), at(10, 7)), 3);
  assert.equal(backupAge(mark(at(12, 8)), at(10, 7)), 0, 'a backup stamped in the future counts as today');
});

test('backupLine: never backed up', () => {
  const now = at(10, 12);
  assert.equal(backupLine(null, 0, false, now, 'en'), '', 'nothing to back up');
  assert.equal(backupLine(undefined, 0, false, now, 'en'), '');
  assert.equal(backupLine(null, 0, true, now, 'en'), 'No backup yet');
  assert.equal(backupLine(null, 1, false, now, 'en'), 'No backup yet · 1 note');
  assert.equal(backupLine(null, 5, true, now, 'en'), 'No backup yet · 5 notes');
  assert.equal(backupLine(null, 5, false, now, 'zh_TW'), '還沒備份過 · 5 則筆記');
});

test('backupLine: when the last backup was and the notes since', () => {
  const now = at(10, 12);
  assert.equal(backupLine(mark(at(7, 9), 5), 9, false, now, 'en'), 'Last backup 3 days ago · 5 notes since');
  assert.equal(backupLine(mark(at(10, 9), 0), 9, false, now, 'en'), 'Last backup today · no new notes since');
  assert.equal(backupLine(mark(at(9, 21), 1), 0, false, now, 'en'), 'Last backup yesterday · 1 note since');
  assert.equal(backupLine(mark(at(7, 9), 5), 9, false, now, 'zh_TW'), '上次備份：3 天前 · 之後新增 5 則筆記');
  assert.equal(backupLine(mark(at(10, 9), 0), 0, false, now, 'zh_TW'), '上次備份：今天 · 之後沒有新筆記');
  assert.equal(backupLine(mark(at(9, 9), 1), 0, false, now, 'zh_TW'), '上次備份：昨天 · 之後新增 1 則筆記');
});

test('My trip shows the line in the Backup section, and none when there is nothing to back up', () => {
  state.data = guidebook;
  const s = over => ({ ...state, lang: 'en', draft: emptyDraft(''), log: [], trip: null, backup: null, ...over });
  assert.doesNotMatch(renderLog(s({})), /No backup yet/);
  const out = renderLog(s({ log: sampleLog }));
  assert.ok(out.includes(`<p class="small">No backup yet · ${sampleLog.length} notes</p>`));
  assert.ok(out.indexOf('No backup yet') > out.indexOf(`<h2>${tr('en', 'backup')}</h2>`), 'under the Backup heading');
  assert.match(renderLog(s({ backup: backupMark(new Date()) })), /<p class="small">Last backup today · no new notes since<\/p>/);
  assert.match(renderLog(s({ lang: 'zh_TW', backup: { at: new Date().toISOString(), since: 2 } })), /上次備份：今天 · 之後新增 2 則筆記/);
  assert.doesNotThrow(() => renderLog(s({ backup: undefined })), 'a state without the field (older tests) renders');
});
