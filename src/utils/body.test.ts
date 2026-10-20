import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeightValue, parseSleepHours, parseValueWithDate, dailyWeights, weightStats, formatHours } from './body';

test('parseWeightValue', () => {
  assert.equal(parseWeightValue('130.4'), 130.4);
  assert.equal(parseWeightValue('130,4'), 130.4);
  assert.equal(parseWeightValue(' 95 '), 95);
  assert.equal(parseWeightValue('130.45'), 130.5);
  assert.equal(parseWeightValue('20'), null);
  assert.equal(parseWeightValue('301'), null);
  assert.equal(parseWeightValue('сто'), null);
});

test('parseSleepHours: десятичные, запятая, ч:мм', () => {
  assert.equal(parseSleepHours('7.5'), 7.5);
  assert.equal(parseSleepHours('7,5'), 7.5);
  assert.equal(parseSleepHours('7:40'), 7.67);
  assert.equal(parseSleepHours('6ч30'), 6.5);
  assert.equal(parseSleepHours('8'), 8);
  assert.equal(parseSleepHours('7:75'), null);
  assert.equal(parseSleepHours('25'), null);
  assert.equal(parseSleepHours('-1'), null);
  assert.equal(parseSleepHours('много'), null);
});

test('formatHours', () => {
  assert.equal(formatHours(7.5), '7 ч 30 мин');
  assert.equal(formatHours(8), '8 ч');
  assert.equal(formatHours(7.67), '7 ч 40 мин');
});

test('parseValueWithDate: значение и необязательная дата', () => {
  assert.deepEqual(parseValueWithDate('131.2 09.10', '2026-10-20'), { ok: true, value: '131.2', dateStr: '2026-10-09' });
  assert.deepEqual(parseValueWithDate('131.2', '2026-10-20'), { ok: true, value: '131.2', dateStr: null });
  assert.equal(parseValueWithDate('131.2 32.10', '2026-10-20').ok, false);
  assert.equal(parseValueWithDate('', '2026-10-20').ok, false);
});

test('dailyWeights: самое раннее взвешивание за местный день', () => {
  const rows = [
    { at: '2026-10-20T15:00:00Z', kg: 131 }, // 18:00 МСК
    { at: '2026-10-20T04:30:00Z', kg: 130 }, // 07:30 МСК — раньше
    { at: '2026-10-19T22:00:00Z', kg: 129.5 }, // 01:00 МСК 20-го — самое раннее за 20-е
    { at: '2026-10-18T05:00:00Z', kg: 130.8 },
  ];
  assert.deepEqual(dailyWeights(rows, 'Europe/Moscow'), [
    { dateStr: '2026-10-18', kg: 130.8 },
    { dateStr: '2026-10-20', kg: 129.5 },
  ]);
});

test('weightStats: среднее за 7 дней и изменения', () => {
  const days = [
    { dateStr: '2026-10-06', kg: 133 },
    { dateStr: '2026-10-09', kg: 132 },
    { dateStr: '2026-10-12', kg: 131.5 },
    { dateStr: '2026-10-14', kg: 131 },
    { dateStr: '2026-10-17', kg: 130.5 },
    { dateStr: '2026-10-20', kg: 130 },
  ];
  const s = weightStats(days, '2026-10-20');
  assert.equal(s.latest?.kg, 130);
  assert.equal(s.avg7, 130.5); // 14,17,20
  assert.equal(s.weekChange, -1.25); // 130.5 vs avg(09,12)=131.75
  assert.equal(s.monthChange, -3); // 130 - 133
});

test('weightStats: пусто и одна запись', () => {
  assert.deepEqual(weightStats([], '2026-10-20'), { latest: null, avg7: null, weekChange: null, monthChange: null });
  const one = weightStats([{ dateStr: '2026-10-09', kg: 131 }], '2026-10-20');
  assert.equal(one.latest?.kg, 131);
  assert.equal(one.avg7, null);
  assert.equal(one.monthChange, null);
});
