import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEstimateJson, formatFoodCard, Estimate } from './foodVision';

test('parseEstimateJson: парсит полный ответ с КБЖУ и составом порций', () => {
  const raw = JSON.stringify({
    isFood: true,
    name: 'Куриная грудка с рисом и овощами',
    portion: 'тарелка ~450 г',
    kcal: 580,
    proteinG: 42,
    fatG: 12,
    carbsG: 70,
    items: [
      { name: 'Куриное филе гриль', portion: '180 г', kcal: 290, proteinG: 38, fatG: 5, carbsG: 0 },
      { name: 'Рис басмати', portion: '200 г', kcal: 240, proteinG: 5, fatG: 1, carbsG: 52 },
      { name: 'Овощной салат', portion: '70 г', kcal: 50, proteinG: 1, fatG: 4, carbsG: 3 },
    ],
  });

  const parsed = parseEstimateJson(raw);
  assert.ok(parsed);
  assert.equal(parsed.isFood, true);
  if (parsed.isFood) {
    assert.equal(parsed.name, 'Куриная грудка с рисом и овощами');
    assert.equal(parsed.portion, 'тарелка ~450 г');
    assert.equal(parsed.kcal, 580);
    assert.equal(parsed.proteinG, 42);
    assert.equal(parsed.fatG, 12);
    assert.equal(parsed.carbsG, 70);
    assert.equal(parsed.items?.length, 3);
    assert.equal(parsed.items?.[0].name, 'Куриное филе гриль');
    assert.equal(parsed.items?.[0].proteinG, 38);
  }
});

test('parseEstimateJson: очищает markdown обёртку ```json', () => {
  const raw = '```json\n{"isFood": true, "name": "Овсянка с бананом", "portion": "300 г", "kcal": 360, "proteinG": 12, "fatG": 6, "carbsG": 64}\n```';
  const parsed = parseEstimateJson(raw);
  assert.ok(parsed);
  assert.equal(parsed.isFood, true);
  if (parsed.isFood) {
    assert.equal(parsed.name, 'Овсянка с бананом');
    assert.equal(parsed.kcal, 360);
    assert.equal(parsed.proteinG, 12);
    assert.equal(parsed.fatG, 6);
    assert.equal(parsed.carbsG, 64);
  }
});

test('parseEstimateJson: корректно определяет не-еду', () => {
  const parsed = parseEstimateJson('{"isFood": false}');
  assert.deepEqual(parsed, { isFood: false });
});

test('parseEstimateJson: отклоняет невалидный JSON или ккал вне диапазона', () => {
  assert.equal(parseEstimateJson('не json'), null);
  assert.equal(parseEstimateJson('{"isFood": true, "name": "Борщ", "kcal": 10}'), null); // < 20
  assert.equal(parseEstimateJson('{"isFood": true, "name": "Слон", "kcal": 10000}'), null); // > 5000
  assert.equal(parseEstimateJson('{"isFood": true, "name": "", "kcal": 400}'), null); // пустое имя
});

test('formatFoodCard: форматирует карточку с КБЖУ, составом и датой', () => {
  const est: Extract<Estimate, { isFood: true }> = {
    isFood: true,
    name: 'Гречка с говядиной',
    portion: 'порция ~380 г',
    kcal: 510,
    proteinG: 34,
    fatG: 16,
    carbsG: 55,
    items: [
      { name: 'Говядина тушеная', portion: '150 г', kcal: 290, proteinG: 28, fatG: 14, carbsG: 0 },
      { name: 'Гречка отварная', portion: '230 г', kcal: 220, proteinG: 6, fatG: 2, carbsG: 55 },
    ],
  };

  const formatted = formatFoodCard(est, { dateStr: '2026-11-12', todayStr: '2026-11-13' });
  assert.ok(formatted.includes('Гречка с говядиной'));
  assert.ok(formatted.includes('порция ~380 г'));
  assert.ok(formatted.includes('510 ккал'));
  assert.ok(formatted.includes('Б 34г · Ж 16г · У 55г'));
  assert.ok(formatted.includes('Говядина тушеная'));
  assert.ok(formatted.includes('Гречка отварная'));
  assert.ok(formatted.includes('Запишу за 12.11.'));
});

test('formatFoodCard: очищает дублирующиеся скобки и тильды в порциях', () => {
  const est: Extract<Estimate, { isFood: true }> = {
    isFood: true,
    name: 'Творог со сметаной',
    portion: '(250 г)',
    kcal: 320,
    proteinG: 30,
    items: [
      { name: 'Творог 5%', portion: '~200 г', kcal: 240, proteinG: 28, fatG: 10, carbsG: 6 },
    ],
  };

  const formatted = formatFoodCard(est);
  assert.ok(formatted.includes('Творог со сметаной (250 г)'));
  assert.ok(!formatted.includes('((250 г))'));
  assert.ok(formatted.includes('(~200 г)'));
  assert.ok(!formatted.includes('(~~200 г)'));
});
