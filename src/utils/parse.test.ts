import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBodyLine, parseDayMonth } from './parse';

test('parseBodyLine: пробелы', () => {
  assert.deepEqual(parseBodyLine('182 95 34'), { ok: true, heightCm: 182, weightKg: 95, age: 34 });
});

test('parseBodyLine: дробный вес через запятую и точку, разделители-запятые', () => {
  assert.deepEqual(parseBodyLine('182 95,5 34'), { ok: true, heightCm: 182, weightKg: 95.5, age: 34 });
  assert.deepEqual(parseBodyLine('182, 95.5, 34'), { ok: true, heightCm: 182, weightKg: 95.5, age: 34 });
});

test('parseBodyLine: не три числа', () => {
  assert.equal(parseBodyLine('182 95').ok, false);
  assert.equal(parseBodyLine('182 95 34 1').ok, false);
  assert.equal(parseBodyLine('рост 182').ok, false);
});

test('parseBodyLine: диапазоны', () => {
  assert.equal(parseBodyLine('100 95 34').ok, false);
  assert.equal(parseBodyLine('182 20 34').ok, false);
  assert.equal(parseBodyLine('182 95 8').ok, false);
  assert.equal(parseBodyLine('182 301 34').ok, false);
});

const TODAY = '2026-10-20';

test('parseDayMonth: дд.мм в этом году', () => {
  assert.deepEqual(parseDayMonth('18.10', TODAY), { ok: true, dateStr: '2026-10-18' });
  assert.deepEqual(parseDayMonth('20.10', TODAY), { ok: true, dateStr: '2026-10-20' });
});

test('parseDayMonth: дата позже сегодняшней без года — прошлый год', () => {
  assert.deepEqual(parseDayMonth('25.12', TODAY), { ok: true, dateStr: '2025-12-25' });
});

test('parseDayMonth: явный год', () => {
  assert.deepEqual(parseDayMonth('01.03.2026', TODAY), { ok: true, dateStr: '2026-03-01' });
});

test('parseDayMonth: будущее и старше года — ошибка', () => {
  assert.equal(parseDayMonth('21.10.2026', TODAY).ok, false);
  assert.equal(parseDayMonth('19.10.2025', TODAY).ok, false);
  assert.deepEqual(parseDayMonth('20.10.2025', TODAY), { ok: true, dateStr: '2025-10-20' });
});

test('parseDayMonth: несуществующие даты и мусор', () => {
  assert.equal(parseDayMonth('31.04', TODAY).ok, false);
  assert.equal(parseDayMonth('29.02', TODAY).ok, false); // 2026 не високосный
  assert.equal(parseDayMonth('вчера', TODAY).ok, false);
  assert.equal(parseDayMonth('1810', TODAY).ok, false);
});
