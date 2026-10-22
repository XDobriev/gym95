import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceActionJson } from './voiceAssistant';

test('parseVoiceActionJson: парсит воду', () => {
  const json = JSON.stringify({ action: 'water', ml: 300, transcript: 'выпил 300 мл воды' });
  const result = parseVoiceActionJson(json);
  assert.equal(result?.action, 'water');
  if (result?.action === 'water') {
    assert.equal(result.ml, 300);
  }
});

test('parseVoiceActionJson: парсит еду с приёмом пищи', () => {
  const json = JSON.stringify({
    action: 'food',
    description: 'овсяная каша с черникой',
    meal: 'breakfast',
    kcal: 320,
    transcript: 'на завтрак овсяная каша 320 ккал',
  });
  const result = parseVoiceActionJson(json);
  assert.equal(result?.action, 'food');
  if (result?.action === 'food') {
    assert.equal(result.meal, 'breakfast');
    assert.equal(result.kcal, 320);
  }
});

test('parseVoiceActionJson: парсит силовую тренировку', () => {
  const json = JSON.stringify({
    action: 'workout',
    durationMinutes: 45,
    exercises: [
      {
        name: 'Жим лёжа',
        sets: [
          { weight: 80, reps: 10 },
          { weight: 80, reps: 8 },
        ],
      },
    ],
    transcript: 'тренировка жим лежа 80 на 10 и 80 на 8',
  });
  const result = parseVoiceActionJson(json);
  assert.equal(result?.action, 'workout');
  if (result?.action === 'workout') {
    assert.equal(result.exercises.length, 1);
    assert.equal(result.exercises[0].name, 'Жим лёжа');
    assert.equal(result.exercises[0].sets.length, 2);
  }
});

test('parseVoiceActionJson: парсит подходы sets', () => {
  const json = JSON.stringify({
    action: 'sets',
    sets: [
      { weight: 100, reps: 5 },
      { weight: 100, reps: 5 },
    ],
    transcript: 'два по сто на пять',
  });
  const result = parseVoiceActionJson(json);
  assert.equal(result?.action, 'sets');
  if (result?.action === 'sets') {
    assert.equal(result.sets[0].weight, 100);
    assert.equal(result.sets[0].reps, 5);
  }
});

test('parseVoiceActionJson: очищает markdown обёртку ```json', () => {
  const raw = '```json\n{"action": "weight", "kg": 82.5, "transcript": "вес 82.5"}\n```';
  const result = parseVoiceActionJson(raw);
  assert.equal(result?.action, 'weight');
  if (result?.action === 'weight') {
    assert.equal(result.kg, 82.5);
  }
});
