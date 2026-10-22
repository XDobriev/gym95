import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORKOUT_PROGRAMS, formatProgramDetails } from './programs';

test('WORKOUT_PROGRAMS: содержит программы для похудения, набора и воркаута', () => {
  assert.ok(WORKOUT_PROGRAMS.length >= 3);
  const lose = WORKOUT_PROGRAMS.find((p) => p.id === 'lose_stadium');
  assert.ok(lose);
  assert.equal(lose?.days.length, 4);
});

test('formatProgramDetails: форматирует текст программы', () => {
  const prog = WORKOUT_PROGRAMS[0];
  const text = formatProgramDetails(prog);
  assert.ok(text.includes(prog.title));
  assert.ok(text.includes('Расписание дней'));
  assert.ok(text.includes('Ходьба / Стадион'));
});
