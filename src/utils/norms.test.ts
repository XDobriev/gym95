import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterNormMl } from './norms';

test('проверочные точки из спека', () => {
  assert.equal(waterNormMl({ heightCm: 182, weightKg: 95 }), 2500);
  assert.equal(waterNormMl({ heightCm: 182, weightKg: 130 }), 2750);
  assert.equal(waterNormMl({ heightCm: 160, weightKg: 50 }), 1500);
});

test('нижняя граница 1500 мл', () => {
  assert.equal(waterNormMl({ heightCm: 150, weightKg: 40 }), 1500);
});

test('верхняя граница 3000 мл', () => {
  assert.equal(waterNormMl({ heightCm: 200, weightKg: 300 }), 3000);
});

test('результат кратен 250', () => {
  for (let w = 40; w <= 200; w += 7) {
    assert.equal(waterNormMl({ heightCm: 175, weightKg: w }) % 250, 0);
  }
});
