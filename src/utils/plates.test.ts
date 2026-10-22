import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlates, calculateWarmupSets, formatPlatesSummary } from './plates';

test('calculatePlates: 100 кг на грифе 20 кг', () => {
  const result = calculatePlates(100, 20);
  assert.equal(result.targetWeightKg, 100);
  assert.equal(result.weightOnBarKg, 80);
  assert.equal(result.weightPerSideKg, 40);
  // 40 кг на сторону: 25 кг + 15 кг
  assert.deepEqual(result.platesPerSide, [
    { plateKg: 25, countPerSide: 1 },
    { plateKg: 15, countPerSide: 1 },
  ]);
  assert.equal(result.remainderKg, 0);
});

test('calculatePlates: 82.5 кг на грифе 20 кг', () => {
  const result = calculatePlates(82.5, 20);
  assert.equal(result.weightPerSideKg, 31.25);
  // 31.25 кг: 25 + 5 + 1.25
  assert.deepEqual(result.platesPerSide, [
    { plateKg: 25, countPerSide: 1 },
    { plateKg: 5, countPerSide: 1 },
    { plateKg: 1.25, countPerSide: 1 },
  ]);
  assert.equal(result.remainderKg, 0);
});

test('calculatePlates: пустой гриф 20 кг', () => {
  const result = calculatePlates(20, 20);
  assert.equal(result.weightPerSideKg, 0);
  assert.deepEqual(result.platesPerSide, []);
  assert.equal(result.remainderKg, 0);
});

test('calculateWarmupSets: 100 кг', () => {
  const warmups = calculateWarmupSets(100, 20);
  assert.ok(warmups.length >= 3);
  assert.equal(warmups[0].weightKg, 20); // пустой гриф
  assert.ok(warmups[warmups.length - 1].weightKg < 100); // последний разминочный меньше рабочего
});

test('formatPlatesSummary: генерирует читаемый текст', () => {
  const text = formatPlatesSummary(100, 20);
  assert.ok(text.includes('100 кг'));
  assert.ok(text.includes('40 кг'));
  assert.ok(text.includes('Схема разминки'));
});

