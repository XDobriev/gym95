import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChain, suggestNextInRotation } from './chain';

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
