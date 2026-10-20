import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localNow, localNoonUtc, localMidnightUtc, localWeekStart, addDays, daysBetween, weekStartOf } from './time';

test('localNow: Москва после полуночи по местному, ещё прошлый день по UTC', () => {
  const r = localNow('Europe/Moscow', new Date('2026-10-20T22:30:00Z'));
  assert.equal(r.dateStr, '2026-10-21');
  assert.equal(r.hhmm, '01:30');
  assert.equal(r.weekday, 2); // среда: 0=пн..6=вс
});

test('localNow: Владивосток UTC+10', () => {
  const r = localNow('Asia/Vladivostok', new Date('2026-10-20T14:30:00Z'));
  assert.equal(r.dateStr, '2026-10-21');
  assert.equal(r.hhmm, '00:30');
});

test('localNow: полночь даёт 00, а не 24', () => {
  const r = localNow('Europe/Moscow', new Date('2026-10-20T21:00:00Z'));
  assert.equal(r.hhmm, '00:00');
});

test('localNoonUtc для разных поясов', () => {
  assert.equal(localNoonUtc('2026-10-20', 'Europe/Moscow').toISOString(), '2026-10-20T09:00:00.000Z');
  assert.equal(localNoonUtc('2026-10-20', 'Asia/Vladivostok').toISOString(), '2026-10-20T02:00:00.000Z');
  assert.equal(localNoonUtc('2026-10-20', 'Europe/Kaliningrad').toISOString(), '2026-10-20T10:00:00.000Z');
});

test('localNoonUtc возвращает ту же местную дату', () => {
  const d = localNoonUtc('2026-10-20', 'Asia/Kamchatka');
  assert.equal(localNow('Asia/Kamchatka', d).dateStr, '2026-10-20');
});

test('localMidnightUtc для Москвы', () => {
  assert.equal(localMidnightUtc('2026-10-19', 'Europe/Moscow').toISOString(), '2026-10-18T21:00:00.000Z');
});

test('localWeekStart: вторник и воскресенье дают понедельник 19.10, понедельник — себя', () => {
  assert.equal(localWeekStart('Europe/Moscow', new Date('2026-10-20T09:00:00Z')), '2026-10-19');
  assert.equal(localWeekStart('Europe/Moscow', new Date('2026-10-25T09:00:00Z')), '2026-10-19');
  assert.equal(localWeekStart('Europe/Moscow', new Date('2026-10-26T09:00:00Z')), '2026-10-26');
});

test('weekStartOf: момент в воскресенье 23:30 по Москве — ещё прошлая неделя', () => {
  assert.equal(weekStartOf(new Date('2026-10-25T20:30:00Z'), 'Europe/Moscow'), '2026-10-19');
});

test('addDays и daysBetween через границу месяца и года', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2025-10-20', '2026-10-20'), 365);
  assert.equal(daysBetween('2026-10-20', '2026-10-18'), -2);
});
