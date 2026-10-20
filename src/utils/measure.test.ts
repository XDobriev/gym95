import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCm, measureDiffLines, MEASURE_FIELDS, measurementDue } from './measure';
import { waterTargetMl, waterReminderDue } from './water';

test('parseCm', () => {
  assert.equal(parseCm('118'), 118);
  assert.equal(parseCm('38,5'), 38.5);
  assert.equal(parseCm('5'), null);
  assert.equal(parseCm('400'), null);
  assert.equal(parseCm('много'), null);
});

test('6 замеров в фиксированном порядке', () => {
  assert.deepEqual(MEASURE_FIELDS.map((f) => f.key), ['waist', 'belly', 'chest', 'hips', 'biceps', 'thigh']);
});

test('measureDiffLines: разница с прошлыми, пропуски', () => {
  const lines = measureDiffLines({ waist: 118, belly: 124, chest: null }, { waist: 121, belly: 124, chest: 122 });
  assert.deepEqual(lines, ['Талия: 118 см (−3)', 'Живот: 124 см (0)']);
  assert.deepEqual(measureDiffLines({ waist: 118 }, null), ['Талия: 118 см']);
});

test('measurementDue: через 30 дней или если замеров не было', () => {
  assert.equal(measurementDue(null, '2026-10-20'), true);
  assert.equal(measurementDue('2026-09-20', '2026-10-20'), true);
  assert.equal(measurementDue('2026-09-21', '2026-10-20'), false);
});

test('waterTargetMl: +500 в день тренировки', () => {
  assert.equal(waterTargetMl(2500, false), 2500);
  assert.equal(waterTargetMl(2500, true), 3000);
});

test('waterReminderDue: в своё время, если норма не набрана', () => {
  assert.equal(waterReminderDue('13:00', 1000, 2500), true);
  assert.equal(waterReminderDue('13:01', 1000, 2500), false);
  assert.equal(waterReminderDue('16:00', 2500, 2500), false);
});
