import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDietPlan, formatDietPlanSummary, formatGroceriesList } from './dietPlan';

test('calculateDietPlan: расчет для похудения (85 кг, 2000 ккал)', () => {
  const plan = calculateDietPlan(85, 2000, 'lose');
  assert.equal(plan.macros.dailyKcal, 2000);
  // Белок ~1.9 г/кг -> 85 * 1.9 = 162 г
  assert.ok(plan.macros.proteinG >= 150 && plan.macros.proteinG <= 170);
  // Жиры ~0.8 г/кг -> 85 * 0.8 = 68 г
  assert.ok(plan.macros.fatsG >= 60 && plan.macros.fatsG <= 75);
  // Углеводы > 0
  assert.ok(plan.macros.carbsG > 100);
  // Корзина покупок заполнена
  assert.ok(plan.weeklyGroceries.length >= 5);
  // Приемы пищи разбиты на 4
  assert.equal(plan.mealDistribution.length, 4);
});

test('formatDietPlanSummary: форматирует текст плана', () => {
  const text = formatDietPlanSummary(80, 1900, 'lose');
  assert.ok(text.includes('План питания'));
  assert.ok(text.includes('1900 ккал'));
  assert.ok(text.includes('Белки'));
});

test('formatGroceriesList: форматирует список продуктов', () => {
  const list = formatGroceriesList(80, 1900, 'lose');
  assert.ok(list.includes('Список продуктов'));
  assert.ok(list.includes('Куриная грудка'));
  assert.ok(list.includes('Яйца'));
  assert.ok(list.includes('Творог'));
});
