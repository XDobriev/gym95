import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChain, suggestNextInRotation, progressionSuggestion } from './chain';

test('progressionSuggestion: все подходы на цель — прибавить вес', () => {
  const sets = [
    { weight: 40, reps: 10 },
    { weight: 40, reps: 10 },
    { weight: 40, reps: 11 },
  ];
  assert.equal(progressionSuggestion(sets, 10), 42.5);
  assert.equal(progressionSuggestion([{ weight: 16, reps: 12 }, { weight: 16, reps: 12 }], 12), 17); // лёгкий вес — +1
});

test('progressionSuggestion: не дотянул, без веса, без цели', () => {
  assert.equal(progressionSuggestion([{ weight: 40, reps: 10 }, { weight: 40, reps: 8 }], 10), null);
  assert.equal(progressionSuggestion([{ weight: 0, reps: 20 }], 15), null);
  assert.equal(progressionSuggestion([{ weight: 40, reps: 10 }], null), null);
  assert.equal(progressionSuggestion([], 10), null);
  // разный вес в подходах — ориентируемся на рабочий (максимальный) и его подходы
  assert.equal(progressionSuggestion([{ weight: 30, reps: 12 }, { weight: 40, reps: 10 }, { weight: 40, reps: 10 }], 10), 42.5);
});

const everyOtherDay = ['2026-10-09', '2026-10-11', '2026-10-13', '2026-10-15', '2026-10-17', '2026-10-19'];

test('нет тренировок — нулевая цепочка', () => {
  assert.deepEqual(computeChain([], '2026-10-20', 2), { current: 0, best: 0, deadline: null });
});

test('через день — живая цепочка, дедлайн через maxGap+1 дней от последней', () => {
  assert.deepEqual(computeChain(everyOtherDay, '2026-10-20', 2), { current: 6, best: 6, deadline: '2026-10-22' });
});

test('несколько тренировок в один день считаются одним днём, порядок не важен', () => {
  const dates = ['2026-10-19', '2026-10-17', '2026-10-19', '2026-10-15'];
  assert.equal(computeChain(dates, '2026-10-20', 2).current, 3);
});

test('перерыв больше допустимого рвёт цепочку, рекорд сохраняется', () => {
  assert.deepEqual(computeChain(everyOtherDay, '2026-10-23', 2), { current: 0, best: 6, deadline: null });
});

test('заморозка стрика (frozenDates) защищает цепочку от разрыва', () => {
  // 2026-10-21 был заморожен как день отдыха/болезни
  const status = computeChain(everyOtherDay, '2026-10-23', 2, ['2026-10-21']);
  assert.equal(status.current, 7);
});

test('в последний допустимый день цепочка ещё жива', () => {
  assert.equal(computeChain(everyOtherDay, '2026-10-22', 2).current, 6);
});

test('новая цепочка после разрыва, рекорд — максимальная', () => {
  const dates = [...everyOtherDay, '2026-10-25', '2026-10-26'];
  assert.deepEqual(computeChain(dates, '2026-10-26', 2), { current: 2, best: 6, deadline: '2026-10-29' });
});

test('maxGap=1 строже: через два дня — разрыв', () => {
  assert.equal(computeChain(['2026-10-10', '2026-10-13'], '2026-10-13', 1).current, 1);
  assert.equal(computeChain(['2026-10-10', '2026-10-12'], '2026-10-12', 1).current, 2);
});

test('suggestNextInRotation', () => {
  assert.equal(suggestNextInRotation(['a', 'b'], null), 'a');
  assert.equal(suggestNextInRotation(['a', 'b'], 'a'), 'b');
  assert.equal(suggestNextInRotation(['a', 'b'], 'b'), 'a');
  assert.equal(suggestNextInRotation(['a', 'b'], 'zzz'), 'a');
  assert.equal(suggestNextInRotation([], null), null);
});
