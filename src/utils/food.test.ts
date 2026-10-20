import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFoodLine, kcalNorm, averagePerDay, parseFoodPrefix, looksLikeFoodDescription } from './food';
import { parseEstimate } from '../ai/foodEstimate';

test('parseFoodPrefix: вчера и приём пищи без числа', () => {
  assert.deepEqual(parseFoodPrefix('вчера ужин паста карбонара'), { meal: 'dinner', yesterday: true, rest: 'паста карбонара' });
  assert.deepEqual(parseFoodPrefix('гречка с курицей, тарелка'), { meal: null, yesterday: false, rest: 'гречка с курицей, тарелка' });
  assert.deepEqual(parseFoodPrefix('Обед: борщ'), { meal: 'lunch', yesterday: false, rest: 'борщ' });
});

test('looksLikeFoodDescription', () => {
  assert.equal(looksLikeFoodDescription('гречка с курицей'), true);
  assert.equal(looksLikeFoodDescription('ок'), false);
  assert.equal(looksLikeFoodDescription('123'), false);
  assert.equal(looksLikeFoodDescription('а'.repeat(201)), false);
});

test('parseEstimate: валидный ответ модели', () => {
  assert.deepEqual(
    parseEstimate('{"isFood":true,"name":"Гречка с курицей","portion":"тарелка ~350 г","kcal":521.4,"proteinG":34.6}'),
    { isFood: true, name: 'Гречка с курицей', portion: 'тарелка ~350 г', kcal: 521, proteinG: 35 }
  );
});

test('parseEstimate: не еда, мусор, ккал вне диапазона, markdown-обёртка', () => {
  assert.deepEqual(parseEstimate('{"isFood":false}'), { isFood: false });
  assert.equal(parseEstimate('не json'), null);
  assert.equal(parseEstimate('{"isFood":true,"name":"x","kcal":99999}'), null);
  assert.deepEqual(parseEstimate('```json\n{"isFood":true,"name":"Яблоко","kcal":95}\n```'), {
    isFood: true,
    name: 'Яблоко',
    portion: null,
    kcal: 95,
    proteinG: null,
  });
});

test('parseFoodLine: приём пищи и ккал', () => {
  assert.deepEqual(parseFoodLine('обед 650'), { meal: 'lunch', description: null, kcal: 650, yesterday: false });
  assert.deepEqual(parseFoodLine('Перекус 2 яблока 190'), { meal: 'snack', description: '2 яблока', kcal: 190, yesterday: false });
  assert.deepEqual(parseFoodLine('ужин: паста 820 ккал'), { meal: 'dinner', description: 'паста', kcal: 820, yesterday: false });
});

test('parseFoodLine: без приёма пищи и с «вчера»', () => {
  assert.deepEqual(parseFoodLine('гречка с курицей 520'), { meal: null, description: 'гречка с курицей', kcal: 520, yesterday: false });
  assert.deepEqual(parseFoodLine('вчера ужин 700'), { meal: 'dinner', description: null, kcal: 700, yesterday: true });
});

test('parseFoodLine: не еда', () => {
  assert.equal(parseFoodLine('650'), null); // одно число — непонятно, еда ли это
  assert.equal(parseFoodLine('40x10'), null);
  assert.equal(parseFoodLine('привет'), null);
  assert.equal(parseFoodLine('обед 5'), null); // меньше 20 ккал
  assert.equal(parseFoodLine('обед 9000'), null);
  assert.equal(parseFoodLine('7.5'), null);
});

test('kcalNorm: мужчина, похудение', () => {
  // BMR = 10*130 + 6.25*182 - 5*34 + 5 = 2272.5; ×1.375 = 3124.7; −500 = 2624.7 → 2625 (округление до 25)
  assert.equal(kcalNorm({ sex: 'male', weightKg: 130, heightCm: 182, age: 34, goal: 'lose' }), 2625);
});

test('kcalNorm: женщина, набор и поддержание', () => {
  // BMR = 10*60 + 6.25*165 - 5*30 - 161 = 1320.25; ×1.375 = 1815.3
  assert.equal(kcalNorm({ sex: 'female', weightKg: 60, heightCm: 165, age: 30, goal: 'regular' }), 1825);
  assert.equal(kcalNorm({ sex: 'female', weightKg: 60, heightCm: 165, age: 30, goal: 'gain' }), 2125);
});

test('kcalNorm: дефицит не опускает ниже BMR', () => {
  // BMR = 10*45 + 6.25*150 - 5*60 - 161 = 926.5; ×1.375 = 1273.9; −500 = 773.9 < BMR → 926.5 → 925
  assert.equal(kcalNorm({ sex: 'female', weightKg: 45, heightCm: 150, age: 60, goal: 'lose' }), 925);
});

test('averagePerDay: только дни с записями', () => {
  const entries = [
    { eaten_on: '2026-10-18', kcal: 1000 },
    { eaten_on: '2026-10-18', kcal: 1000 },
    { eaten_on: '2026-10-20', kcal: 2200 },
  ];
  assert.equal(averagePerDay(entries), 2100);
  assert.equal(averagePerDay([]), null);
});
